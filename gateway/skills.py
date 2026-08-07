"""
Skill registry: SKILL.md packages (AgentSkills / OpenClaw / Claude Code compatible).

A skill is a directory containing SKILL.md (YAML frontmatter + markdown body)
and optionally scripts/, references/, assets/. Agents reference skills by name;
the runtime expands each skill into:
  - a catalog entry (name + description) in the system prompt, and
  - executable tools for each script in scripts/ (skill__<skill>__<script>).

Format follows the AgentSkills standard (agentskills.io):
  ---
  name: <lowercase-hyphen, must match dir name>
  description: <what it does and when to use it>
  license: <optional>
  compatibility: <optional>
  metadata: <optional map>
  allowed-tools: <optional space-separated>
  ---
  <markdown body: how to use the skill>
"""

import asyncio
import re
import sys
from pathlib import Path

import yaml

from gateway.config import settings

_frontmatter_re = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def _skills_root() -> Path:
    return Path(settings.data_dir) / "skills"


def _read_skill_dir(skill_dir: Path) -> dict | None:
    """Parse a skill directory into a dict, or None if SKILL.md is missing/invalid."""
    md_path = skill_dir / "SKILL.md"
    if not md_path.exists():
        return None

    text = md_path.read_text(encoding="utf-8")
    m = _frontmatter_re.match(text)
    if not m:
        return None

    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None

    name = str(fm.get("name", "")).strip().lower()
    if not name:
        name = skill_dir.name
    name = re.sub(r"[^a-z0-9-]", "-", name)

    scripts = sorted(
        p.name for p in (skill_dir / "scripts").glob("*") if p.is_file()
    ) if (skill_dir / "scripts").is_dir() else []

    return {
        "name": name,
        "description": str(fm.get("description", "")).strip(),
        "license": str(fm.get("license", "")).strip(),
        "compatibility": str(fm.get("compatibility", "")).strip(),
        "metadata": fm.get("metadata") or {},
        "allowed_tools": (fm.get("allowed-tools") or "").split() if fm.get("allowed-tools") else [],
        "body": text[m.end():].strip(),
        "path": str(skill_dir),
        "scripts": scripts,
    }


def list_skills() -> list[dict]:
    """List all skills available on disk (SKILL.md folders)."""
    root = _skills_root()
    if not root.exists():
        return []
    result = []
    for child in sorted(root.iterdir()):
        if child.is_dir():
            skill = _read_skill_dir(child)
            if skill:
                result.append(skill)
    return result


def get_skill(name: str) -> dict | None:
    """Get a skill by name (matches dir name or frontmatter name)."""
    for skill in list_skills():
        if skill["name"] == name or (Path(skill["path"]).name == name):
            return skill
    return None


def script_tool_name(skill_name: str, script_name: str) -> str:
    """OpenAI-valid function name for a skill script: skill__<skill>__<script>."""
    safe_skill = re.sub(r"[^a-zA-Z0-9_-]", "_", skill_name)
    safe_script = re.sub(r"[^a-zA-Z0-9_-]", "_", script_name)
    return f"skill__{safe_skill}__{safe_script}"


def resolve_script(skill: dict, script_ref: str) -> str | None:
    """Resolve a sanitized script name (search_py) back to the real file (search.py)."""
    for actual in skill.get("scripts", []):
        if actual == script_ref:
            return actual
        if re.sub(r"[^a-zA-Z0-9_-]", "_", actual) == script_ref:
            return actual
    return None


def skill_view_tool_def() -> dict:
    """OpenAI function def for the skill_view tool (progressive disclosure).

    The agent calls this to load a skill's SKILL.md body on demand, so it
    learns how and when to use the skill instead of guessing.
    """
    return {
        "type": "function",
        "function": {
            "name": "skill_view",
            "description": (
                "Read the instructions for a skill (its SKILL.md body). "
                "Call this BEFORE using a skill's script tools to learn how to use them, "
                "what arguments they expect, and when the skill applies. "
                "Pass the exact skill name from the available skills list."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The skill name to load instructions for.",
                    },
                },
                "required": ["name"],
            },
        },
    }


async def view_skill(skill_name: str) -> str:
    """Return a skill's SKILL.md body + script list for the agent to read."""
    skill = get_skill(skill_name)
    if not skill:
        return f"Skill '{skill_name}' not found."
    body = skill.get("body", "")
    scripts = skill.get("scripts", [])
    parts = [f"# {skill['name']}", f"## Description\n{skill.get('description', '')}"]
    if scripts:
        parts.append("## Scripts\n" + "\n".join(f"- {s}" for s in scripts))
    if body:
        parts.append("## Instructions\n" + body)
    return "\n\n".join(parts)


def get_script_tool_defs(skill: dict, max_args: int = 6) -> list[dict]:
    """Build OpenAI function tool defs for a skill's scripts.

    Scripts accept JSON args passed via argv (key=value pairs), keeping the
    function-calling interface generic without needing a schema per script.
    """
    defs = []
    for script in skill.get("scripts", []):
        name = script_tool_name(skill["name"], script)
        defs.append({
            "type": "function",
            "function": {
                "name": name,
                "description": f"Run the '{script}' script from the '{skill['name']}' skill. Args are passed as key=value on the command line. Use to execute the skill's bundled logic.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "args": {
                            "type": "object",
                            "description": "Key-value arguments passed to the script.",
                            "additionalProperties": True,
                        },
                    },
                    "required": ["args"],
                },
            },
        })
    return defs


async def execute_script(skill_name: str, script_name: str, args: dict) -> str:
    """Run a skill script as a subprocess, passing args as key=value on argv."""
    skill = get_skill(skill_name)
    if not skill:
        return f"Skill '{skill_name}' not found"
    actual = resolve_script(skill, script_name)
    if not actual:
        return f"Script '{script_name}' not found in skill '{skill_name}'"
    script_path = Path(skill["path"]) / "scripts" / actual

    arg_list = []
    for k, v in (args or {}).items():
        arg_list.append(f"{k}={v}")

    try:
        cmd = _command_for(script_path, arg_list)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(script_path.parent),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        if proc.returncode != 0:
            return f"script error ({proc.returncode}): {stderr.decode(errors='replace')[:500]}"
        return stdout.decode(errors="replace")
    except asyncio.TimeoutError:
        return "script timed out after 60s"
    except Exception as e:  # noqa: BLE001
        return f"script execution error: {str(e)}"


def _command_for(script_path: Path, arg_list: list[str]) -> list[str]:
    """Build the command to run a script based on its extension."""
    suffix = script_path.suffix.lower()
    interpreter = {
        ".py": sys.executable,
        ".sh": "bash",
        ".js": "node",
    }.get(suffix, "bash")
    return [interpreter, str(script_path)] + arg_list

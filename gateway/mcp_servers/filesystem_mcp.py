"""
Workspace filesystem MCP server -- lets an agent read/write files in a
sandboxed project directory. Pure Python (stdlib only), no npx/Node --
replaces the old broken `npx @modelcontextprotocol/server-filesystem` entry,
which silently failed because the production image has no Node.js runtime.

All paths are relative to WORKSPACE_ROOT and cannot escape it (checked by
resolved-path containment, not string matching, so `..` segments and
absolute-path overrides are both rejected).

Registered in data/mcp.json as a stdio server:
  "filesystem": {"command": "python3", "args": ["-m", "gateway.mcp_servers.filesystem_mcp"]}
"""

import json
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from gateway.config import settings

mcp = FastMCP("workspace")

WORKSPACE_ROOT = Path(settings.data_dir) / "workspace"


def _resolve(rel_path: str) -> Path:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    root = WORKSPACE_ROOT.resolve()
    candidate = (root / rel_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"'{rel_path}' escapes the workspace root")
    return candidate


@mcp.tool()
def write_file(path: str, content: str) -> str:
    """Create or overwrite a file. `path` is relative to the workspace root, e.g. "expense-tracker/index.html". Creates parent directories as needed."""
    try:
        target = _resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return json.dumps({"path": path, "bytes_written": len(content.encode("utf-8"))})
    except (ValueError, OSError) as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def read_file(path: str) -> str:
    """Read a text file's contents. `path` is relative to the workspace root."""
    try:
        target = _resolve(path)
        if not target.is_file():
            return json.dumps({"error": f"'{path}' is not a file"})
        return json.dumps({"path": path, "content": target.read_text(encoding="utf-8")})
    except (ValueError, OSError) as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def list_files(path: str = "") -> str:
    """List files and subdirectories directly inside `path` (relative to the workspace root; "" for the root itself)."""
    try:
        target = _resolve(path)
        if not target.is_dir():
            return json.dumps({"error": f"'{path}' is not a directory"})
        entries = [
            {"name": p.name, "is_dir": p.is_dir(), "size": p.stat().st_size if p.is_file() else None}
            for p in target.iterdir()
        ]
        entries.sort(key=lambda e: e["name"])
        return json.dumps(entries)
    except (ValueError, OSError) as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def delete_file(path: str) -> str:
    """Delete a single file (not directories). `path` is relative to the workspace root."""
    try:
        target = _resolve(path)
        if not target.is_file():
            return json.dumps({"error": f"'{path}' is not a file"})
        target.unlink()
        return json.dumps({"deleted": path})
    except (ValueError, OSError) as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")

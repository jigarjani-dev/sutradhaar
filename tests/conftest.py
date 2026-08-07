"""Shared test fixtures. Creates a temp data dir + a temp skill per test."""

import tempfile
from pathlib import Path

import pytest

from gateway.config import settings


@pytest.fixture(autouse=True)
def isolate_data_dir(monkeypatch, tmp_path):
    """Point the gateway at a temp data dir for each test."""
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    yield tmp_path


@pytest.fixture
def sample_skill(tmp_path):
    """Create a test skill with a script and return its name."""
    skill_dir = tmp_path / "skills" / "test-skill"
    skill_dir.mkdir(parents=True)
    scripts = skill_dir / "scripts"
    scripts.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\n"
        "name: test-skill\n"
        "description: A test skill that echoes a message.\n"
        "---\n\n"
        "# Test Skill\n\n"
        "Run scripts/echo.py with text=hello\n",
        encoding="utf-8",
    )
    (scripts / "echo.py").write_text(
        "import sys, json\n"
        "args = {}\n"
        "for a in sys.argv[1:]:\n"
        "    if '=' in a:\n"
        "        k, v = a.split('=', 1)\n"
        "        args[k] = v\n"
        "print(json.dumps({'echo': args.get('text', '')}))\n",
        encoding="utf-8",
    )
    return "test-skill"

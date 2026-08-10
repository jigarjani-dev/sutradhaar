"""Tests for gateway/skills.py: parsing, listing, script execution."""

from gateway.skills import (
    create_skill,
    delete_skill,
    get_skill,
    list_skills,
    execute_script,
    view_skill,
    script_tool_name,
    validate_skill_name,
)


async def test_list_skills_discovers_skill(sample_skill):
    skills = list_skills()
    assert any(s["name"] == "test-skill" for s in skills)


async def test_get_skill_by_name(sample_skill):
    skill = get_skill("test-skill")
    assert skill is not None
    assert skill["description"].startswith("A test skill")
    assert skill["scripts"] == ["echo.py"]
    assert "# Test Skill" in skill["body"]


async def test_execute_script_runs_script(sample_skill):
    result = await execute_script("test-skill", "echo.py", {"text": "hello"})
    assert '"hello"' in result


async def test_execute_script_resolves_sanitized_name(sample_skill):
    # sanitized name (echo_py) should resolve back to echo.py
    result = await execute_script("test-skill", "echo_py", {"text": "world"})
    assert '"world"' in result


async def test_execute_script_missing_skill():
    result = await execute_script("nope", "echo.py", {})
    assert "not found" in result


async def test_view_skill_returns_body(sample_skill):
    content = await view_skill("test-skill")
    assert "# Test Skill" in content
    assert "echo.py" in content


def test_script_tool_name_sanitizes():
    assert script_tool_name("test-skill", "echo.py") == "skill__test-skill__echo_py"


def test_validate_skill_name():
    assert validate_skill_name("My Skill") == "my-skill"
    assert validate_skill_name("abc123") == "abc123"


def test_create_and_delete_skill(tmp_path, monkeypatch):
    monkeypatch.setattr("gateway.skills.settings.data_dir", str(tmp_path))
    created = create_skill("demo-skill", "Demo description", "# Demo\n\nSteps.")
    assert created["name"] == "demo-skill"
    assert get_skill("demo-skill") is not None
    assert delete_skill("demo-skill") is True
    assert get_skill("demo-skill") is None


def test_create_skill_rejects_duplicate(tmp_path, monkeypatch):
    monkeypatch.setattr("gateway.skills.settings.data_dir", str(tmp_path))
    create_skill("dup", "one", "")
    try:
        create_skill("dup", "two", "")
        assert False, "expected ValueError"
    except ValueError as e:
        assert "already exists" in str(e)
    delete_skill("dup")

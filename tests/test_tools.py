"""Tests for gateway/tools.py: capability expansion + dispatch."""

from gateway.tools import get_tool_definitions, execute_tool


async def test_skill_view_always_present():
    defs = get_tool_definitions([])
    names = [d["function"]["name"] for d in defs]
    assert "skill_view" in names


async def test_skill_ref_expands_to_script_tools(sample_skill):
    defs = get_tool_definitions(["test-skill"])
    names = [d["function"]["name"] for d in defs]
    assert "skill__test-skill__echo_py" in names


async def test_skill_view_dispatch(sample_skill):
    result = await execute_tool("skill_view", {"name": "test-skill"})
    assert "# Test Skill" in result


async def test_script_dispatch(sample_skill):
    result = await execute_tool("skill__test-skill__echo_py", {"args": {"text": "hi"}})
    assert '"hi"' in result


async def test_unknown_tool():
    result = await execute_tool("not_a_real_tool", {})
    assert "Unknown tool" in result

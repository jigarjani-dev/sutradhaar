"""Tests for gateway/cardgen.py: A2A card generation with skills."""

import pytest

from gateway.cardgen import build_agent_card, _tool_to_skill


def test_card_has_skills_with_nested_tools(sample_skill):
    card = build_agent_card({"name": "a1", "description": "Test", "skills": ["test-skill"]}, "# a1")
    assert card["name"] == "a1"
    assert any(s["id"] == "test-skill" for s in card["skills"])
    assert any("echo.py" in s.get("tools", []) for s in card["skills"])


def test_card_legacy_tools_map_to_skills():
    card = build_agent_card({"name": "a1", "tools": ["gmail_reader"]}, "# a1")
    assert any(s["id"] == "gmail_reader" for s in card["skills"])
    assert card.get("tools") == ["gmail_reader"]


def test_tool_to_skill_known():
    s = _tool_to_skill("sheets_writer")
    assert s is not None
    assert s["name"] == "Google Sheets Writer"


def test_tool_to_skill_unknown_returns_none():
    assert _tool_to_skill("definitely_not_a_tool") is None


def test_card_interfaces():
    card = build_agent_card({"name": "a1", "description": "d", "skills": []}, "# a1")
    assert card["supportedInterfaces"][0]["url"] == "http://localhost:8192/a2a/a1"

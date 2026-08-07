"""Tests for gateway/providers.py: key masking, model parsing, presets."""

import pytest

from gateway.db import init
from gateway.providers import (
    mask_key,
    _parse_model_list,
    PRESETS,
    seed_presets,
    list_providers,
)


@pytest.fixture(autouse=True)
async def setup_db(isolate_data_dir):
    await init(isolate_data_dir)


def test_mask_key():
    assert mask_key("") == ""
    assert mask_key("short") == "****"
    assert mask_key("sk-abcdefgh1234") == "sk-a****1234"


def test_parse_model_list_openai_shape():
    payload = {"object": "list", "data": [{"id": "gpt-4o"}, {"id": "gpt-4.1"}]}
    assert _parse_model_list(payload) == ["gpt-4o", "gpt-4.1"]


def test_parse_model_list_anthropic_shape():
    payload = {"data": [{"id": "claude-sonnet-4-6", "type": "model"}]}
    assert _parse_model_list(payload) == ["claude-sonnet-4-6"]


def test_parse_model_list_empty():
    assert _parse_model_list({}) == []
    assert _parse_model_list({"data": []}) == []


async def test_seed_presets(isolate_data_dir):
    await seed_presets()
    providers = await list_providers()
    ids = {p["id"] for p in providers}
    assert {"openai", "anthropic", "deepseek", "opencode-zen", "opencode-go"} <= ids


def test_presets_have_expected_urls():
    assert PRESETS["opencode-zen"]["base_url"] == "https://opencode.ai/zen/v1"
    assert PRESETS["opencode-go"]["base_url"] == "https://opencode.ai/zen/go/v1"
    assert PRESETS["anthropic"]["base_url"].startswith("https://api.anthropic.com")

"""
LLM engine: OpenAI-compatible async client with tool-calling loop.

Supports any OpenAI-compatible API (DeepSeek, Ollama, OpenCode Go/Zen, OpenAI,
Anthropic's OpenAI-compat layer, etc.) configured via a provider registry.

Clients are cached per (base_url, api_key) so agents can use different providers.
"""

import json

from openai import AsyncOpenAI

from gateway.config import settings
from gateway.providers import get_provider_with_key
from gateway.tools import execute_tool, get_tool_definitions
from gateway.ws import ws_manager


class LLMEngine:
    def __init__(self):
        self._clients: dict[tuple[str, str], AsyncOpenAI] = {}

    def _client_for(self, base_url: str | None, api_key: str | None) -> AsyncOpenAI:
        base = base_url or settings.openai_base_url
        key = api_key if api_key is not None else settings.openai_api_key
        cache_key = (base, key or "")
        if cache_key not in self._clients:
            self._clients[cache_key] = AsyncOpenAI(base_url=base, api_key=key or "none")
        return self._clients[cache_key]

    async def _resolve(self, provider: str | None, provider_override: dict | None,
                       model: str | None) -> tuple[AsyncOpenAI, str]:
        """Resolve a client + model from agent provider config, falling back to global."""
        # per-agent inline override takes highest precedence
        if provider_override and (provider_override.get("base_url") or provider_override.get("api_key")):
            client = self._client_for(
                provider_override.get("base_url") or settings.openai_base_url,
                provider_override.get("api_key"),
            )
            return client, model or provider_override.get("model") or settings.llm_model

        if provider:
            prov = await get_provider_with_key(provider)
            if prov:
                client = self._client_for(prov.get("base_url"), prov.get("api_key", "") or None)
                return client, model or prov.get("model") or settings.llm_model

        return self._client_for(None, None), model or settings.llm_model

    async def chat(
        self,
        messages: list[dict],
        tools: list[str] | None = None,
        model: str | None = None,
        provider: str | None = None,
        provider_override: dict | None = None,
        agent_name: str | None = None,
    ) -> str:
        """
        Send messages to the LLM with optional tool calling.
        Returns the final text response after tool calls are resolved.
        """
        client, resolved_model = await self._resolve(provider, provider_override, model)
        tool_defs = get_tool_definitions(tools or [])

        full_messages = list(messages)

        # allow up to 5 tool-call roundtrips to prevent infinite loops
        for _ in range(5):
            kwargs = {
                "model": resolved_model,
                "messages": full_messages,
            }
            if tool_defs:
                kwargs["tools"] = tool_defs

            response = await client.chat.completions.create(**kwargs)
            msg = response.choices[0].message

            # if no tool calls, return text
            if not msg.tool_calls:
                return msg.content or ""

            # process tool calls
            full_messages.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                await ws_manager.emit_tool_call(
                    agent_name or "unknown", tc.function.name, args, "running"
                )
                result = await execute_tool(tc.function.name, args)
                await ws_manager.emit_tool_call(
                    agent_name or "unknown", tc.function.name, args, result
                )
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

        return full_messages[-1].get("content", "") if full_messages else ""

    async def chat_stream(
        self,
        messages: list[dict],
        tools: list[str] | None = None,
        model: str | None = None,
        provider: str | None = None,
        provider_override: dict | None = None,
        agent_name: str | None = None,
    ):
        """
        Stream response tokens from the LLM.
        Yields text chunks. Tool calls are resolved before streaming final text.
        """
        client, resolved_model = await self._resolve(provider, provider_override, model)
        tool_defs = get_tool_definitions(tools or [])

        full_messages = list(messages)

        for _ in range(5):
            kwargs = {
                "model": resolved_model,
                "messages": full_messages,
                "stream": True,
            }
            if tool_defs:
                kwargs["tools"] = tool_defs

            stream = await client.chat.completions.create(**kwargs)

            tool_calls = []
            content_parts = []

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                if delta.content:
                    content_parts.append(delta.content)
                    yield delta.content

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        while len(tool_calls) <= idx:
                            tool_calls.append({"id": "", "function": {"name": "", "arguments": ""}})
                        if tc.id:
                            tool_calls[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls[idx]["function"]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls[idx]["function"]["arguments"] += tc.function.arguments

            # if no tool calls, we're done
            if not tool_calls:
                return

            # process tool calls
            full_messages.append({
                "role": "assistant",
                "content": "".join(content_parts) or None,
                "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": tc["function"]}
                    for tc in tool_calls
                ],
            })

            for tc in tool_calls:
                try:
                    args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    args = {}
                await ws_manager.emit_tool_call(
                    agent_name or "unknown", tc["function"]["name"], args, "running"
                )
                result = await execute_tool(tc["function"]["name"], args)
                await ws_manager.emit_tool_call(
                    agent_name or "unknown", tc["function"]["name"], args, result
                )
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

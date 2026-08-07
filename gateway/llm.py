"""
LLM engine: OpenAI-compatible async client with tool-calling loop.

Supports any OpenAI-compatible API (DeepSeek, Ollama, OpenAI, etc.)
configured via OPENAI_BASE_URL + OPENAI_API_KEY env vars.
"""

import json
from openai import AsyncOpenAI
from gateway.config import settings
from gateway.tools import execute_tool, get_tool_definitions


class LLMEngine:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.openai_base_url,
            api_key=settings.openai_api_key,
        )

    async def chat(
        self,
        messages: list[dict],
        tools: list[str] | None = None,
        model: str | None = None,
    ) -> str:
        """
        Send messages to the LLM with optional tool calling.
        Returns the final text response after tool calls are resolved.
        """
        model = model or settings.llm_model
        tool_defs = get_tool_definitions(tools or [])

        full_messages = list(messages)

        # allow up to 5 tool-call roundtrips to prevent infinite loops
        for _ in range(5):
            kwargs = {
                "model": model,
                "messages": full_messages,
            }
            if tool_defs:
                kwargs["tools"] = tool_defs

            response = await self.client.chat.completions.create(**kwargs)
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
                result = await execute_tool(tc.function.name, args)
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
    ):
        """
        Stream response tokens from the LLM.
        Yields text chunks. Tool calls are resolved before streaming final text.
        """
        model = model or settings.llm_model
        tool_defs = get_tool_definitions(tools or [])

        full_messages = list(messages)

        for _ in range(5):
            kwargs = {
                "model": model,
                "messages": full_messages,
                "stream": True,
            }
            if tool_defs:
                kwargs["tools"] = tool_defs

            stream = await self.client.chat.completions.create(**kwargs)

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
                result = await execute_tool(tc["function"]["name"], args)
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

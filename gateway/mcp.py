"""
MCP (Model Context Protocol) bridge.

Connects to configured MCP servers at startup (stdio subprocess or Streamable
HTTP), lists their tools, and exposes them to the LLM as OpenAI function tools
namespaced mcp__<server>__<tool>.

Config file: data/mcp.json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
    },
    "weather": { "url": "http://weather-mcp:8000/mcp", "headers": { "Authorization": "Bearer x" } }
  }
}
"""

import json
import logging
from pathlib import Path

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamable_http_client

from gateway.config import settings

logger = logging.getLogger(__name__)

def _mcp_config_path() -> Path:
    return Path(settings.data_dir) / "mcp.json"


def _load_config() -> dict:
    path = _mcp_config_path()
    if not path.exists():
        return {"servers": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"servers": {}}


class McpServerHandle:
    def __init__(self, name: str, config: dict):
        self.name = name
        self.config = config
        self._transport_ctx = None
        self._session: ClientSession | None = None

    async def connect(self):
        cfg = self.config
        if cfg.get("url"):
            headers = cfg.get("headers") or {}
            http_client = None
            if headers:
                http_client = httpx.AsyncClient(headers=headers, timeout=30)
            self._transport_ctx = streamable_http_client(cfg["url"], http_client=http_client)
        else:
            params = StdioServerParameters(
                command=cfg["command"],
                args=cfg.get("args", []),
                env=cfg.get("env") or None,
            )
            self._transport_ctx = stdio_client(params)

        read, write = await self._transport_ctx.__aenter__()
        self._session = ClientSession(read, write)
        await self._session.__aenter__()
        await self._session.initialize()
        logger.info("MCP server '%s' connected", self.name)

    async def list_tools(self):
        if not self._session:
            return []
        try:
            result = await self._session.list_tools()
            return list(result.tools)
        except Exception as e:  # noqa: BLE001
            logger.warning("MCP %s list_tools failed: %s", self.name, e)
            return []

    async def call_tool(self, name: str, arguments: dict) -> dict:
        result = await self._session.call_tool(name, arguments or {})
        texts = [b.text for b in result.content if getattr(b, "text", None)]
        return {
            "text": "\n".join(texts),
            "structured": getattr(result, "structuredContent", None),
            "is_error": getattr(result, "isError", False),
        }

    async def close(self):
        try:
            if self._session:
                await self._session.__aexit__(None, None, None)
            if self._transport_ctx:
                await self._transport_ctx.__aexit__(None, None, None)
        except Exception:  # noqa: BLE001
            pass


class McpBridge:
    def __init__(self, config: dict | None = None):
        cfg = config or _load_config()
        self.servers = {
            name: McpServerHandle(name, s) for name, s in (cfg.get("servers") or {}).items()
        }
        self.tool_defs: list[dict] = []
        self._tool_map: dict[str, tuple[str, str]] = {}

    async def start(self):
        for name, handle in self.servers.items():
            try:
                await handle.connect()
            except Exception as e:  # noqa: BLE001
                logger.warning("MCP server '%s' failed to connect: %s", name, e)
                continue
            for tool in await handle.list_tools():
                exposed = f"mcp__{name}__{tool.name}"
                self.tool_defs.append({
                    "type": "function",
                    "function": {
                        "name": exposed,
                        "description": tool.description or "",
                        "parameters": tool.inputSchema or {"type": "object", "properties": {}},
                    },
                })
                self._tool_map[exposed] = (name, tool.name)
        logger.info("MCP bridge ready: %d tools from %d servers", len(self.tool_defs), len(self.servers))

    async def call(self, exposed_name: str, arguments: dict) -> str:
        if exposed_name not in self._tool_map:
            return f"MCP tool '{exposed_name}' not found"
        server_name, tool_name = self._tool_map[exposed_name]
        handle = self.servers.get(server_name)
        if not handle:
            return f"MCP server '{server_name}' not connected"
        result = await handle.call_tool(tool_name, arguments)
        if result["is_error"]:
            return f"MCP tool error: {result['text']}"
        return result["text"] or json.dumps(result["structured"])

    async def stop(self):
        for handle in self.servers.values():
            await handle.close()

    def reset(self):
        cfg = _load_config()
        self.servers = {
            name: McpServerHandle(name, s) for name, s in (cfg.get("servers") or {}).items()
        }
        self.tool_defs = []
        self._tool_map = {}


def get_server_config() -> dict:
    """Public view of the MCP server config (no secrets leaked)."""
    cfg = _load_config()
    servers = {}
    for name, s in (cfg.get("servers") or {}).items():
        view = dict(s)
        if view.get("env"):
            view["env"] = {k: ("***" if v else "") for k, v in view["env"].items()}
        servers[name] = view
    return {"servers": servers}


def save_server_config(servers: dict) -> dict:
    """Persist the MCP server config to data/mcp.json."""
    path = _mcp_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"servers": servers}
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {"servers": servers}


async def reload_servers() -> None:
    """Re-read config and reconnect all MCP servers."""
    await mcp_bridge.stop()
    mcp_bridge.reset()
    await mcp_bridge.start()


# singleton
mcp_bridge = McpBridge()

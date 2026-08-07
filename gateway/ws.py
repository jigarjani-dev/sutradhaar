"""
WebSocket manager for broadcasting real-time events to the dashboard.

Event types broadcast to all connected clients:
- agent_created, agent_updated, agent_deleted
- message_sent, message_received
- tool_called
- handoff_event
- debug_log
"""

import json
from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, event_type: str, data: dict):
        message = json.dumps({"type": event_type, "data": data})
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def emit_agent_created(self, agent: dict):
        await self.broadcast("agent_created", {
            "name": agent["name"],
            "status": agent.get("status", "idle"),
            "card_url": f"/a2a/{agent['name']}/.well-known/agent.json",
        })

    async def emit_agent_deleted(self, name: str):
        await self.broadcast("agent_deleted", {"name": name})

    async def emit_message(self, agent_name: str, role: str, content: str):
        await self.broadcast("message", {
            "agent": agent_name,
            "role": role,
            "content": content,
        })

    async def emit_thinking(self, agent_name: str, content: str):
        await self.broadcast("thinking", {
            "agent": agent_name,
            "content": content,
        })

    async def emit_tool_call(self, agent_name: str, tool: str, args: dict, result: str):
        """Broadcast a tool invocation. result == 'running' means started."""
        await self.broadcast("tool_call", {
            "agent": agent_name,
            "tool": tool,
            "args": args,
            "status": "running" if result == "running" else "done",
            "result": "" if result == "running" else result[:500],
        })

    async def emit_agent_status(self, agent_name: str, status: str):
        await self.broadcast("agent_status", {
            "agent": agent_name,
            "status": status,
        })

    async def emit_handoff(self, from_agent: str, to_agent: str, message: str):
        await self.broadcast("handoff", {
            "from": from_agent,
            "to": to_agent,
            "message": message,
        })

    async def emit_debug(self, agent_name: str, event_type: str, payload: dict):
        await self.broadcast("debug_log", {
            "agent": agent_name,
            "event_type": event_type,
            "payload": payload,
        })


# singleton
ws_manager = WebSocketManager()

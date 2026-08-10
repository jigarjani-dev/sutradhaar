"""Long-polling Telegram bots bound 1:1 to gateway agents."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

import httpx

from gateway import telegram_store
from gateway.agent_chat import process_agent_chat
from gateway.ws import ws_manager

if TYPE_CHECKING:
    from gateway.llm import LLMEngine

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"
POLL_TIMEOUT = 25


class TelegramManager:
    def __init__(self):
        self._llm: LLMEngine | None = None
        self._tasks: dict[str, asyncio.Task] = {}
        self._stop = asyncio.Event()

    def set_llm(self, engine: LLMEngine) -> None:
        self._llm = engine

    async def start(self) -> None:
        self._stop.clear()
        rows = await telegram_store.list_all()
        for row in rows:
            if row.get("bot_token"):
                self._ensure_poller(row["agent_name"])

    async def stop(self) -> None:
        self._stop.set()
        for name, task in list(self._tasks.items()):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._tasks.clear()

    def _ensure_poller(self, agent_name: str) -> None:
        existing = self._tasks.get(agent_name)
        if existing and not existing.done():
            return
        self._tasks[agent_name] = asyncio.create_task(
            self._poll_loop(agent_name),
            name=f"telegram-{agent_name}",
        )

    def _stop_poller(self, agent_name: str) -> None:
        task = self._tasks.pop(agent_name, None)
        if task and not task.done():
            task.cancel()

    async def validate_token(self, token: str) -> dict:
        url = f"{TELEGRAM_API}/bot{token}/getMe"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            data = resp.json()
        if not data.get("ok"):
            desc = data.get("description") or "Invalid bot token"
            raise ValueError(desc)
        return data["result"]

    async def connect(self, agent_name: str, bot_token: str) -> dict:
        bot_token = bot_token.strip()
        if not bot_token:
            raise ValueError("Bot token is required")

        other = await telegram_store.find_agent_for_token(bot_token, exclude_agent=agent_name)
        if other:
            raise ValueError(f"This bot token is already linked to agent '{other}'")

        me = await self.validate_token(bot_token)
        username = me.get("username") or me.get("first_name") or "bot"

        prev = await telegram_store.get_by_agent(agent_name)
        allowed = telegram_store._parse_chat_ids(prev.get("allowed_chat_ids") if prev else None)
        status = "connected" if allowed else "pending_chat"
        offset = int(prev.get("poll_offset") or 0) if prev else 0

        await telegram_store.upsert(
            agent_name,
            bot_token,
            username,
            status=status,
            allowed_chat_ids=allowed,
            poll_offset=offset,
        )

        self._ensure_poller(agent_name)

        public = telegram_store.public_status(await telegram_store.get_by_agent(agent_name))
        await ws_manager.broadcast("telegram_status", {"agent": agent_name, **public})

        if allowed:
            await self.send_text(
                agent_name,
                allowed[0],
                f"Telegram is linked to agent `{agent_name}` on Sutradhaar. Send a message anytime.",
            )

        return public

    async def disconnect(self, agent_name: str) -> None:
        self._stop_poller(agent_name)
        await telegram_store.delete(agent_name)
        await ws_manager.broadcast(
            "telegram_status",
            {"agent": agent_name, **telegram_store.public_status(None)},
        )

    async def send_text(self, agent_name: str, chat_id: int, text: str) -> None:
        row = await telegram_store.get_by_agent(agent_name)
        if not row or not row.get("bot_token"):
            return
        token = row["bot_token"]
        url = f"{TELEGRAM_API}/bot{token}/sendMessage"
        payload = {"chat_id": chat_id, "text": text[:4096]}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(url, json=payload)
        except Exception:
            logger.exception("Telegram send failed for agent %s", agent_name)

    async def _poll_loop(self, agent_name: str) -> None:
        logger.info("Telegram poller started for agent %s", agent_name)
        try:
            while not self._stop.is_set():
                row = await telegram_store.get_by_agent(agent_name)
                if not row or not row.get("bot_token"):
                    break
                token = row["bot_token"]
                offset = int(row.get("poll_offset") or 0)
                url = f"{TELEGRAM_API}/bot{token}/getUpdates"
                try:
                    async with httpx.AsyncClient(timeout=POLL_TIMEOUT + 10) as client:
                        resp = await client.get(
                            url,
                            params={"offset": offset, "timeout": POLL_TIMEOUT},
                        )
                        data = resp.json()
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Telegram poll error for %s", agent_name)
                    await asyncio.sleep(3)
                    continue

                if not data.get("ok"):
                    logger.warning("Telegram getUpdates not ok for %s: %s", agent_name, data)
                    await asyncio.sleep(5)
                    continue

                for upd in data.get("result", []):
                    upd_id = upd.get("update_id", 0)
                    next_offset = upd_id + 1
                    await telegram_store.set_poll_offset(agent_name, next_offset)
                    await self._handle_update(agent_name, upd)

                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
        finally:
            logger.info("Telegram poller stopped for agent %s", agent_name)

    async def _handle_update(self, agent_name: str, upd: dict) -> None:
        msg = upd.get("message") or upd.get("edited_message")
        if not msg:
            return
        text = (msg.get("text") or "").strip()
        if not text:
            return
        chat = msg.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return

        row = await telegram_store.get_by_agent(agent_name)
        if not row:
            return

        allowed = telegram_store._parse_chat_ids(row.get("allowed_chat_ids"))
        if chat_id not in allowed:
            if allowed:
                return
            allowed = await telegram_store.add_chat_id(agent_name, int(chat_id))
            public = telegram_store.public_status(await telegram_store.get_by_agent(agent_name))
            await ws_manager.broadcast("telegram_status", {"agent": agent_name, **public})
            await self.send_text(
                agent_name,
                int(chat_id),
                f"Connected. You are now chatting with agent `{agent_name}` on Sutradhaar.",
            )

        if not self._llm:
            logger.error("LLM engine not set; ignoring Telegram message")
            return

        try:
            reply = await process_agent_chat(
                self._llm,
                agent_name,
                text,
                message_source="telegram",
                sender="telegram",
            )
            await self.send_text(agent_name, int(chat_id), reply)
        except Exception:
            logger.exception("Telegram chat failed for agent %s", agent_name)
            await self.send_text(
                agent_name,
                int(chat_id),
                "Something went wrong processing your message. Check gateway logs.",
            )


telegram_manager = TelegramManager()

---
name: telegram-sender
description: Send a message via a Telegram bot. Use when the user wants to send a message or notification to a Telegram chat.
license: Apache-2.0
metadata:
  vendor: workshop-agent-gateway
  version: "1.0"
---

# Telegram Sender

Send messages through a Telegram bot using the Bot API.

## When to use
- "send me a message on telegram", "notify my chat"

## Scripts
- `scripts/send.py` — send a message. Args: `chat_id`, `text`.

## Procedure
1. Run `scripts/send.py` with `chat_id` and `text`.
2. Report success/failure to the user.

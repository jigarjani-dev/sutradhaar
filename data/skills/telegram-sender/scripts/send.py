#!/usr/bin/env python3
"""Send a Telegram message via Bot API. Args passed as key=value."""
import json
import os
import sys

import httpx


def main():
    args = {}
    for a in sys.argv[1:]:
        if "=" in a:
            k, v = a.split("=", 1)
            args[k] = v

    chat_id = args.get("chat_id", "")
    text = args.get("text", "")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")

    if not chat_id or not text:
        print(json.dumps({"error": "chat_id and text are required"}))
        return
    if not token:
        print(json.dumps({"error": "TELEGRAM_BOT_TOKEN not set"}))
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = httpx.post(url, json={"chat_id": chat_id, "text": text}, timeout=10)
        print(json.dumps({"status": resp.status_code, "body": resp.text[:500]}))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()

---
name: gmail-reader
description: Search and read emails from a Gmail inbox via Google Workspace. Use when the user asks about their emails, inbox, or messages from Gmail.
license: Apache-2.0
metadata:
  vendor: workshop-agent-gateway
  version: "1.0"
---

# Gmail Reader

Search and read emails from a Gmail inbox using the `gws` Google Workspace CLI.

## When to use
- "check my emails", "what did X send me", "find the invoice email"

## Scripts
- `scripts/search.py` — search messages. Args: `query` (Gmail search string), `max_results` (default 5).

## Procedure
1. Run `scripts/search.py` with a `query` like `subject:invoice` or `from:boss@example.com`.
2. Read the returned message list and summarize for the user.

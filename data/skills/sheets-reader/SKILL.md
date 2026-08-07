---
name: sheets-reader
description: Read values from a Google Sheets spreadsheet. Use when the user asks to read, fetch, or check data in a spreadsheet.
license: Apache-2.0
metadata:
  vendor: workshop-agent-gateway
  version: "1.0"
---

# Google Sheets Reader

Read cell ranges from a Google Sheets spreadsheet using the `gws` CLI.

## When to use
- "what's in the budget sheet", "fetch the expenses range"

## Scripts
- `scripts/read.py` — read a range. Args: `spreadsheet_id`, `range` (default `Sheet1!A1:Z100`).

## Procedure
1. Run `scripts/read.py` with `spreadsheet_id` and optionally `range`.
2. Summarize the returned rows for the user.

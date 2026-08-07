---
name: sheets-writer
description: Append rows to a Google Sheets spreadsheet. Use when the user wants to add, log, or write data into a spreadsheet.
license: Apache-2.0
metadata:
  vendor: workshop-agent-gateway
  version: "1.0"
---

# Google Sheets Writer

Append rows to a Google Sheets spreadsheet using the `gws` CLI.

## When to use
- "add 20 rupees for coffee", "log this expense", "write these rows to the sheet"

## Scripts
- `scripts/append.py` — append values. Args: `spreadsheet_id`, `range` (default `Sheet1!A1`), `values` (JSON array of arrays).

## Procedure
1. Run `scripts/append.py` with `spreadsheet_id`, `range`, and `values` (JSON list of rows).
2. Confirm the append succeeded and tell the user.

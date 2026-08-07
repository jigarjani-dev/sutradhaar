#!/usr/bin/env python3
"""Google Sheets range reader via gws CLI."""
import json
import subprocess
import sys


def main():
    args = {}
    for a in sys.argv[1:]:
        if "=" in a:
            k, v = a.split("=", 1)
            args[k] = v

    spreadsheet_id = args.get("spreadsheet_id", "")
    rng = args.get("range", "Sheet1!A1:Z100")

    if not spreadsheet_id:
        print(json.dumps({"error": "spreadsheet_id is required"}))
        return

    try:
        cmd = ["gws", "sheets", "spreadsheets.values", "get",
               "--params", json.dumps({"spreadsheetId": spreadsheet_id, "range": rng})]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            print(json.dumps({"error": out.stderr[:500]}))
            return
        print(out.stdout)
    except FileNotFoundError:
        print(json.dumps({"error": "gws CLI not found; install it or set MOCK_TOOLS=true"}))
    except subprocess.TimeoutExpired:
        print(json.dumps({"error": "gws timed out"}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Gmail message search via gws CLI. Args passed as key=value."""
import json
import shlex
import subprocess
import sys


def main():
    args = {}
    for a in sys.argv[1:]:
        if "=" in a:
            k, v = a.split("=", 1)
            args[k] = v

    query = args.get("query", "")
    max_results = int(args.get("max_results", "5"))

    if not query:
        print(json.dumps({"error": "query is required"}))
        return

    try:
        cmd = ["gws", "gmail", "users", "messages", "list",
               "--params", json.dumps({"q": query, "maxResults": max_results})]
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

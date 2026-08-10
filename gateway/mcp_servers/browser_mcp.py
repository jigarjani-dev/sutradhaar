"""
Browser MCP server -- loads a workspace HTML file in a real headless
Chromium and can fill/click/read the actual DOM. This is REAL execution:
it catches JS runtime errors and logic bugs that reading source code never
will. Use this to verify an app works, not just that the file looks right.

Uses Playwright's async API, not sync -- FastMCP's stdio server already runs
its own asyncio event loop, and Playwright's sync API refuses to start
inside a thread that has one running.

Registered in data/mcp.json as a stdio server:
  "browser": {"command": "python3", "args": ["-m", "gateway.mcp_servers.browser_mcp"]}
"""

import json
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from playwright.async_api import async_playwright

from gateway.config import settings

mcp = FastMCP("browser")

WORKSPACE_ROOT = Path(settings.data_dir) / "workspace"


def _resolve(rel_path: str) -> Path:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    root = WORKSPACE_ROOT.resolve()
    candidate = (root / rel_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"'{rel_path}' escapes the workspace root")
    return candidate


@mcp.tool()
async def test_page(path: str, actions: list[dict] | None = None) -> str:
    """
    Load an HTML file (path relative to the workspace root, e.g.
    "expense-tracker/index.html") in a real headless browser and run an
    optional sequence of actions against it, then report what actually
    happened. This executes the real JS -- use it before claiming something
    works.

    Each action in `actions` is one of:
      {"action": "fill", "selector": "<css>", "value": "<text>"}
      {"action": "click", "selector": "<css>"}
      {"action": "select", "selector": "<css>", "value": "<option value>"}
      {"action": "read_text", "selector": "<css>"} -- captured in the "reads" result
      {"action": "wait", "ms": 300}

    Returns JSON: {"console_errors": [...], "page_errors": [...],
    "reads": {selector: text}, "body_text": "<visible page text after all actions>"}.
    Any JS exception or console.error means something is actually broken.
    """
    try:
        target = _resolve(path)
    except ValueError as e:
        return json.dumps({"error": str(e)})
    if not target.is_file():
        return json.dumps({"error": f"'{path}' is not a file"})

    console_errors: list[str] = []
    page_errors: list[str] = []
    reads: dict[str, str] = {}

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                page = await browser.new_page()
                # These are local static files with everything loaded synchronously --
                # no reason to wait Playwright's 30s default for a selector that's
                # simply wrong. Fail fast so a bad guess costs seconds, not half a minute.
                page.set_default_timeout(4000)
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("pageerror", lambda exc: page_errors.append(str(exc)))
                await page.goto(f"file://{target}")
                await page.wait_for_load_state("networkidle")

                for step in (actions or []):
                    act = step.get("action")
                    selector = step.get("selector")
                    if act == "fill":
                        await page.fill(selector, step.get("value", ""))
                    elif act == "click":
                        await page.click(selector)
                    elif act == "select":
                        await page.select_option(selector, step.get("value", ""))
                    elif act == "read_text":
                        reads[selector] = await page.inner_text(selector)
                    elif act == "wait":
                        await page.wait_for_timeout(int(step.get("ms", 200)))
                    else:
                        return json.dumps({"error": f"unknown action '{act}'"})

                body_text = await page.inner_text("body")
            finally:
                await browser.close()
    except Exception as e:  # noqa: BLE001
        error = str(e)
        if "Timeout" in error and "waiting for locator" in error:
            error += ("\nHint: this selector doesn't match anything on the page -- it's not "
                      "a tool failure. Re-check the actual HTML (read_file it again if unsure) "
                      "and retry with a selector that really exists, e.g. a structural one like "
                      "\"form#expense-form button[type=submit]\" if the element has no id.")
        return json.dumps({
            "error": error,
            "console_errors": console_errors,
            "page_errors": page_errors,
        })

    return json.dumps({
        "console_errors": console_errors,
        "page_errors": page_errors,
        "reads": reads,
        "body_text": body_text[:3000],
    })


if __name__ == "__main__":
    mcp.run(transport="stdio")

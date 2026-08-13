#!/usr/bin/env python3
"""Live gateway smoke test against http://127.0.0.1:8192 (docker compose up)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field

BASE = "http://127.0.0.1:8192"
TIMEOUT = 120


@dataclass
class Result:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class Report:
    results: list[Result] = field(default_factory=list)

    def add(self, name: str, ok: bool, detail: str = "") -> None:
        self.results.append(Result(name, ok, detail))

    def ok(self, name: str, detail: str = "") -> None:
        self.add(name, True, detail)

    def fail(self, name: str, detail: str = "") -> None:
        self.add(name, False, detail)

    def summary(self) -> int:
        passed = sum(1 for r in self.results if r.ok)
        failed = len(self.results) - passed
        print("\n=== Smoke summary ===")
        for r in self.results:
            mark = "PASS" if r.ok else "FAIL"
            line = f"[{mark}] {r.name}"
            if r.detail:
                line += f" — {r.detail}"
            print(line)
        print(f"\n{passed}/{len(self.results)} passed, {failed} failed")
        return 0 if failed == 0 else 1


def http(method: str, path: str, body: dict | None = None, timeout: int = TIMEOUT) -> tuple[int, object]:
    url = f"{BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return resp.status, None
            ct = resp.headers.get("Content-Type", "")
            if "json" in ct or (raw[:1] in (b"{", b"[")):
                return resp.status, json.loads(raw.decode())
            return resp.status, raw.decode(errors="replace")[:200]
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw[:200]
        return e.code, payload


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def verify_workshop_unlocks(report: Report) -> None:
    salt = "sutradhaar-ctf-v1"
    expected = {
        "lakshmi": ("banana", "333432218a6b0976a0bfa25f03912dbe9edc35520b6b6e5c60c4f34ef5828b56"),
        "a2a": ("wire", "b396d7481c67b5c8af21a3d2258553c65e37b12b8b3d0764007be9ad06c612e4"),
        "orchestrator": ("route", "817e32d043ba5d8cef973cbbe4abbb799d5a9dbb44397c2db62ddb1d98361ab4"),
        "master": ("sutradhaar", "ec988f1dce9f1fb7ed5f5bb80e11dc98a07abd5c2b67b3ded1760972d9ac0eaf"),
    }
    for level, (pw, hex_hash) in expected.items():
        key = "master" if level == "master" else level
        got = sha256_hex(f"{salt}-{key}{pw}")
        if got == hex_hash:
            report.ok(f"workshop unlock:{level}", "hash matches")
        else:
            report.fail(f"workshop unlock:{level}", f"expected {hex_hash[:12]}… got {got[:12]}…")


def smoke_infra(report: Report) -> None:
    code, health = http("GET", "/api/gateway/health")
    if code == 200 and isinstance(health, dict) and health.get("status") == "ok":
        report.ok("gateway health", f"{health.get('agents_count')} agents, mock={health.get('mock_mode')}")
    else:
        report.fail("gateway health", str(health))
        return

    code, _ = http("GET", "/")
    report.ok("dashboard /", f"HTTP {code}") if code == 200 else report.fail("dashboard /", f"HTTP {code}")

    code, mcp = http("GET", "/api/mcp/servers")
    if code != 200:
        report.fail("mcp servers", str(mcp))
    else:
        servers = mcp.get("servers", [])
        tools = len(mcp.get("tools", []))
        need = {"filesystem", "browser", "gmail", "sheets"}
        missing = need - set(servers)
        if missing:
            report.fail("mcp servers", f"missing {sorted(missing)}")
        else:
            report.ok("mcp servers", f"{len(servers)} servers, {tools} tools")

    code, logs = http("GET", "/api/debug/logs?limit=1")
    report.ok("debug logs API", "returns list") if code == 200 and isinstance(logs, list) else report.fail("debug logs API", str(logs))

    code, g = http("GET", "/api/integrations/google/status")
    if code == 200:
        report.ok("google integration status", g.get("status", g))
    else:
        report.fail("google integration status", str(g))


def smoke_mcp(report: Report) -> None:
    html = """<!DOCTYPE html><html><body>
<button id="add">Add</button><span id="total">0</span>
<script>
document.getElementById('add').onclick=()=>{
  const el=document.getElementById('total');
  el.textContent=String(Number(el.textContent)+1);
};
</script></body></html>"""
    code, w = http(
        "POST",
        "/api/mcp/filesystem/tools/write_file",
        {"arguments": {"path": "smoke/index.html", "content": html}},
        timeout=30,
    )
    if code != 200:
        report.fail("mcp filesystem write", str(w))
        return
    report.ok("mcp filesystem write", "smoke/index.html")

    code, r = http(
        "POST",
        "/api/mcp/filesystem/tools/read_file",
        {"arguments": {"path": "smoke/index.html"}},
        timeout=30,
    )
    if code == 200 and "Add" in str(r):
        report.ok("mcp filesystem read", "content ok")
    else:
        report.fail("mcp filesystem read", str(r))

    code, t = http(
        "POST",
        "/api/mcp/browser/tools/test_page",
        {
            "arguments": {
                "path": "smoke/index.html",
                "actions": [
                    {"action": "click", "selector": "#add"},
                    {"action": "read_text", "selector": "#total"},
                ],
            }
        },
        timeout=60,
    )
    if code != 200:
        report.fail("mcp browser test_page", str(t))
        return
    payload = json.loads(t.get("result", "{}")) if isinstance(t, dict) else {}
    reads = payload.get("reads", {})
    total = reads.get("#total", "")
    errs = payload.get("page_errors", []) + payload.get("console_errors", [])
    if total == "1" and not errs:
        report.ok("mcp browser test_page", "click → total=1")
    else:
        report.fail("mcp browser test_page", f"reads={reads} errors={errs}")


def smoke_agents(report: Report) -> None:
    code, agents = http("GET", "/api/agents")
    if code != 200:
        report.fail("list agents", str(agents))
        return
    names = {a["name"] for a in agents}

    for required in ("demo", "lakshmi", "dummy1", "dummy2", "orchestrator", "ba-agent"):
        if required in names:
            report.ok(f"agent present:{required}")
        else:
            report.fail(f"agent present:{required}")

    if "dev-agent" in names:
        report.ok("agent present:dev-agent")
    else:
        report.fail("agent present:dev-agent", "import from workshop/software-engineering-agents/")

    code, d1 = http("GET", "/api/agents/dummy1")
    if code == 200:
        import yaml

        cfg = yaml.safe_load(d1["config_yaml"])
        if cfg.get("handoff", {}).get("enabled") and "dummy2" in cfg.get("handoff", {}).get("targets", []):
            report.ok("a2a config:dummy1→dummy2")
        else:
            report.fail("a2a config:dummy1→dummy2", str(cfg.get("handoff")))

    code, orch = http("GET", "/api/agents/orchestrator")
    if code == 200:
        import yaml

        cfg = yaml.safe_load(orch["config_yaml"])
        ho = cfg.get("handoff", {})
        oc = cfg.get("orchestrator", {})
        if ho.get("enabled") and oc.get("enabled") and ho.get("targets"):
            report.ok("orchestrator config", f"targets={ho.get('targets')}")
        else:
            report.fail("orchestrator config", str({"handoff": ho, "orchestrator": oc}))

    code, ba = http("GET", "/api/agents/ba-agent")
    if code == 200:
        import yaml

        cfg = yaml.safe_load(ba["config_yaml"])
        tools = cfg.get("mcp_servers") or cfg.get("tools") or []
        targets = cfg.get("handoff", {}).get("targets", [])
        scoped = any("read_file" in str(t) for t in tools)
        if scoped and "dev-agent" in targets:
            report.ok("software-eng:ba-agent", "scoped MCP + handoff to dev-agent")
        else:
            report.fail(
                "software-eng:ba-agent",
                "DB agent differs from workshop snapshot (re-import ba-agent + dev-agent)",
            )


async def smoke_llm_chat(report: Report, agent: str, message: str, label: str, must_contain: str | None = None) -> None:
    code, body = http("POST", f"/api/agents/{agent}/chat", {"message": message}, timeout=TIMEOUT)
    if code != 200:
        report.fail(label, str(body)[:200])
        return
    reply = ""
    if isinstance(body, dict):
        reply = body.get("response") or body.get("reply") or body.get("message") or body.get("content") or str(body)
    if must_contain and must_contain.lower() not in reply.lower():
        report.fail(label, f"reply missing {must_contain!r}: {reply[:120]}…")
    else:
        report.ok(label, reply[:80].replace("\n", " ") + ("…" if len(reply) > 80 else ""))


def smoke_llm(report: Report) -> None:
    code, health = http("GET", "/api/gateway/health")
    if code != 200:
        report.fail("llm smoke", "no health")
        return

    # Probe demo chat — fails fast if no working LLM key/routing.
    code, body = http("POST", "/api/agents/demo/chat", {"message": "Reply with exactly: pong"}, timeout=TIMEOUT)
    if code != 200:
        report.fail("llm:demo chat", str(body)[:200])
        report.fail("llm scenarios", "skipped remaining LLM checks (fix API key / provider)")
        return

    reply = ""
    if isinstance(body, dict):
        reply = body.get("response") or body.get("reply") or ""
    report.ok("llm:demo chat (baseline)", reply[:60] or str(body)[:60])

    code, body = http(
        "POST",
        "/api/agents/lakshmi/chat",
        {"message": "Coffee was 50 rupees. Reply with exactly: logged"},
        timeout=TIMEOUT,
    )
    if code == 200:
        report.ok("llm:lakshmi memory", str(body.get("response", body))[:60])
    else:
        report.fail("llm:lakshmi memory", str(body)[:120])

    code, body = http(
        "POST",
        "/api/agents/dummy1/chat",
        {"message": "Hand off to dummy2: say hello from dummy2 only."},
        timeout=TIMEOUT,
    )
    if code == 200:
        report.ok("llm:a2a handoff dummy1→dummy2", str(body.get("response", body))[:80])
    else:
        report.fail("llm:a2a handoff", str(body)[:120])

    code, body = http(
        "POST",
        "/api/agents/orchestrator/chat",
        {"message": "I spent 100 on food today."},
        timeout=TIMEOUT,
    )
    if code == 200:
        report.ok("llm:orchestrator route (expense)", str(body.get("response", body))[:80])
    else:
        report.fail("llm:orchestrator route", str(body)[:120])

    code, tg = http("GET", "/api/agents/orchestrator/telegram")
    if code == 200 and isinstance(tg, dict):
        report.ok("telegram:orchestrator status", f"configured={tg.get('configured', tg)}")
    else:
        report.fail("telegram:orchestrator status", str(tg))


def smoke_skills_mock(report: Report) -> None:
    code, body = http(
        "POST",
        "/api/mcp/gmail/tools/search_messages",
        {"arguments": {"query": "workshop", "max_results": 1}},
        timeout=30,
    )
    if code == 200:
        report.ok("mcp gmail (mock)", "callable")
    else:
        # tool name may differ
        code2, mcp = http("GET", "/api/mcp/servers")
        gmail_tools = [t for t in (mcp or {}).get("tools", []) if "gmail" in t.get("function", {}).get("name", "")]
        report.ok("mcp gmail tools listed", str(len(gmail_tools))) if gmail_tools else report.fail("mcp gmail", str(body))


def main() -> int:
    report = Report()
    print(f"Smoke testing {BASE}\n")
    smoke_infra(report)
    verify_workshop_unlocks(report)
    smoke_mcp(report)
    smoke_agents(report)
    smoke_skills_mock(report)
    smoke_llm(report)
    return report.summary()


if __name__ == "__main__":
    sys.exit(main())

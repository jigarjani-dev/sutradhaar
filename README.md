# Workshop Agent Gateway

A lightweight, visual agent gateway for learning multi-agent patterns (OpenClaw concepts, A2A protocol, MCP tools). Build agents with SOUL.md personas, wire them together with A2A handoffs, and watch them communicate in real time on a live dashboard.

> Full reference (architecture, API, directory structure, connecting real Gmail/Sheets/Telegram) lives in [`docs/README.full.md`](docs/README.full.md). This README covers only what you need **before** the workshop.

## Before the Workshop: Set This Up

Please do this ahead of time so we don't spend workshop time on downloads and installs.

### 1. Install Docker

[Docker Desktop](https://www.docker.com/products/docker-desktop/), or [Colima](https://github.com/abiosoft/colima) if you prefer a lighter CLI-only setup. Make sure it's running before you start.

### 2. Have a Telegram account

No bot yet -- we'll create the bot token together during the workshop.

### 3. Have a Google account (Gmail + Sheets)

No OAuth setup yet -- we'll walk through enabling the Gmail/Sheets APIs and authorizing the app together during the workshop.

## Verify Your Setup Works

Clone the repo and bring the gateway up once, ahead of time, to make sure Docker works.

```bash
git clone <this-repo-url>
cd sutradhaar
docker compose up -d --build
```

No `.env` file needed. Open **http://localhost:8192** and confirm the dashboard loads.

If the dashboard loads, you're ready for the workshop.

```bash
docker compose down
```

(You can leave it running too -- either is fine, we'll bring it back up at the start of the workshop.)

See [`docs/README.full.md`](docs/README.full.md) for the full architecture, API reference, and service-connection details -- useful during and after the workshop.

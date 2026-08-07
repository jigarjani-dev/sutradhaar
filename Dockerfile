# Stage 1: Build React frontend
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# install gws (Google Workspace CLI). Optional -- mock mode works without it.
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  TARGET="x86_64-unknown-linux-gnu" ;; \
      aarch64) TARGET="aarch64-unknown-linux-gnu" ;; \
      *)       echo "unsupported arch: $ARCH, skipping gws"; exit 0 ;; \
    esac && \
    GWS_VER="0.22.5" && \
    GWS_URL="https://github.com/googleworkspace/cli/releases/download/v${GWS_VER}/google-workspace-cli-${TARGET}.tar.gz" && \
    echo "Downloading gws from $GWS_URL" && \
    curl -fsSL "$GWS_URL" -o /tmp/gws.tar.gz && \
    tar xzf /tmp/gws.tar.gz -C /usr/local/bin gws && \
    chmod +x /usr/local/bin/gws && \
    rm /tmp/gws.tar.gz && \
    echo "gws installed: $(gws --version 2>&1 || true)" || \
    echo "gws not available -- set MOCK_TOOLS=true for offline mode"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=frontend /build/dist static/
COPY gateway/ gateway/
COPY templates/ templates/
COPY samples/ samples/
COPY app.py .

RUN mkdir -p /app/data/agents /app/data/credentials

VOLUME ["/app/data"]
EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]

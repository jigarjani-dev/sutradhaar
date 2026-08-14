# Stage 1: Build React frontend
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
ENV PIP_ROOT_USER_ACTION=ignore
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=frontend /build/dist static/
COPY gateway/ gateway/
COPY templates/ templates/
COPY app.py .
COPY tests/ tests/
COPY pytest.ini .

RUN mkdir -p /app/data/agents /app/data/credentials

VOLUME ["/app/data"]
EXPOSE 8192

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8192"]

# SFC-Quant

Standalone local-first AI/Agent quant trading workstation built around explainability, paper-first safety, and a premium operator dashboard.

Repository/runtime identifier: `dSFC-Quant`

## What Ships in v1.2

`SFC-Quant` now includes the shipped v1 baseline plus the current v1.2 release-hardening additions:

- FastAPI backend control plane with typed runtime, market, analysis, execution, risk, strategy, health, and diagnostics surfaces
- Vite + React dashboard with zh/en runtime switching, locale-aware formatting, live KPI cards, price/P&L charts, signal tape, heatmap, factor radar, thesis evidence, and strategy review panels
- PrimoAgent-style role outputs for data, technical, news/geopolitics, and risk/decision reasoning
- Paper-trading execution loop with guarded live-mode enablement
- Optional review-first Strategy Factory workspace for RD-Agent(Q)-style future extension
- Replayable JSONL event logging, WebSocket streaming, structured stdout logs, and contributor-ready smoke tests

## Repository Layout

- `backend/` - FastAPI control plane, runtime services, tests, and local diagnostics
- `frontend/` - Vite/React operator dashboard
- `docs/plans/` - phase design documents
- `docs/runbooks/` - operator and release readiness guides
- `.planning/` - project roadmap, state, and phase artifacts
- `docker-compose.yml` - local two-service startup

## Quick Start

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start the local stack:

   ```bash
   docker compose up --build
   ```

3. Open the main surfaces:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- Backend readiness: `http://localhost:8000/health/ready`
- Diagnostics summary: `http://localhost:8000/api/diagnostics/summary`

## Runtime Defaults

The project stays safe by default:

- `APP_MODE=mock`
- `MARKET_DATA_MODE=real`
- `EXECUTION_MODE=paper`
- `LIVE_TRADING_ENABLED=false`
- `AI_PROVIDER=mock`
- `STRATEGY_FACTORY_ENABLED=false`

To use an OpenAI-compatible provider, set `AI_PROVIDER=openai_compatible` plus `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `.env`.

The default release profile requests real market data through the existing ccxt seam while
keeping execution paper-first. The backend reports requested/effective market source and
runtime status truthfully through `/health`, `/health/ready`, `/api/diagnostics/summary`,
and `/api/market/snapshot`. If exchange reads fail, the system degrades honestly instead
of treating mock data as live market data.

To enable the real RD-Agent(Q) path inside the backend container, use the
optional Compose override that installs the extra and mounts Docker access:

```bash
docker compose -f docker-compose.yml -f docker-compose.rdagent.yml up --build
```

When `STRATEGY_FACTORY_PROVIDER=rd_agent_q`, the backend now attempts to invoke
`STRATEGY_FACTORY_RD_AGENT_COMMAND` and stores invocation inputs/logs beside the
review artifact. If the command is unavailable or the container cannot reach a
Docker daemon, the service falls back to `mock_rdq` and reports that status
honestly.

## Key Backend Endpoints

### Runtime + diagnostics

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /api/diagnostics/summary`
- `GET /api/events/recent`
- `GET /api/market/snapshot`
- `GET /ws`

### Analysis + execution

- `POST /api/analysis/run`
- `GET /api/analysis/latest`
- `POST /api/execution/dispatch`
- `GET /api/execution/status`
- `POST /api/execution/control`

### Risk + strategy factory

- `GET /api/risk/status`
- `POST /api/risk/policy`
- `POST /api/risk/halt`
- `POST /api/risk/live-mode`
- `GET /api/strategy/status`
- `POST /api/strategy/config`
- `POST /api/strategy/generate`
- `GET /api/strategy/artifacts`

## Local Development

### Backend

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e backend[dev]
uvicorn app.main:app --app-dir backend --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Testing

### Targeted smoke checks

```bash
python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py
```

### Full backend suite

```bash
python3 -m pytest -q backend/tests
```

### Frontend production build

```bash
cd frontend && npm run build
```

### Full release verification

```bash
python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null
```

## Diagnostics and Logs

- Backend emits structured JSON logs to stdout for startup, shutdown, and event publication
- `/api/diagnostics/summary` returns runtime, market-data truth, websocket, event-count, execution, risk, and strategy state in one payload
- Event replay is persisted under `EVENT_LOG_DIR` as JSONL for local inspection

## Safety Notes

- Paper trading is the default path; treat live mode as opt-in and heavily gated
- Strategy Factory writes review artifacts only; it does not auto-adopt strategies into execution
- Keep all secrets in `.env`; never commit API keys or exchange credentials

## Runbooks

- Operator guide: `docs/runbooks/operator-runbook.md`
- Live trading readiness: `docs/runbooks/live-trading-readiness.md`
- Release checklist: `docs/runbooks/release-readiness-checklist.md`

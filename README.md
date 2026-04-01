# dSFC-Quant

Standalone AI/Agent quant trading platform focused on local-first operation, explainable runtime state, and a custom trader-grade frontend.

## Overview

`dSFC-Quant` is a single-repo platform with:

- `backend/` — FastAPI control plane for runtime state, future PrimoAgent orchestration, and execution integration
- `frontend/` — Vite + React shell for the custom trading workstation UI
- `docker-compose.yml` — one-command local startup for `backend` and `frontend`

The repo now includes the Phase 1 local runtime foundation, the Phase 2 market-data/event backbone, the Phase 3 PrimoAgent analysis core, the Phase 4 paper-trading execution loop, and the Phase 5 server-side risk guardrails/live-gating layer. The final pro dashboard still lands in later phases.

## Tech Stack

- Backend: Python, FastAPI, `pydantic-settings`, Uvicorn, ccxt-backed adapter seam
- Frontend: Vite, React, Tailwind CSS, Framer Motion, Lightweight Charts
- Runtime: Docker Compose with `backend` and `frontend`

## Quick Start

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start the local stack:

   ```bash
   docker compose up --build
   ```

3. Open the services:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`

## Environment

The root `.env.example` is the source of truth for runtime configuration.

Important keys:

- `APP_MODE=mock`
- `LIVE_TRADING_ENABLED=false`
- `AI_PROVIDER=mock`
- `AI_BASE_URL=`
- `AI_MODEL=gpt-5.4`
- `AI_TIMEOUT_SECONDS=30`
- `EXCHANGE_ID=binance`
- `EXECUTION_MODE=paper`
- `EXECUTION_ADAPTER=freqtrade_mock`
- `EXECUTION_PAPER_STARTING_BALANCE=10000`
- `EXECUTION_ORDER_NOTIONAL_USD=500`
- `RISK_MAX_POSITION_NOTIONAL_USD=1000`
- `RISK_MAX_CONCURRENT_TRADES=3`
- `RISK_DAILY_LOSS_LIMIT_USD=250`
- `RISK_REQUIRE_AGENT_APPROVAL=true`
- `FRONTEND_API_URL=http://backend:8000`
- `FRONTEND_WS_URL=ws://backend:8000/ws`
- `MARKET_SYMBOLS=BTC/USDT,ETH/USDT`
- `MARKET_TIMEFRAMES=1m,5m`
- `EVENT_LOG_DIR=./var/events`

Copy `.env.example` to `.env` and edit values there. Do not commit secrets.

## Runtime Modes

The platform still defaults to `mock-safe` startup:

- Missing exchange credentials keep the backend in a safe non-live state
- `LIVE_TRADING_ENABLED=false` keeps live trading disabled by default
- `AI_PROVIDER=mock` allows startup without third-party AI credentials
- Set `AI_PROVIDER=openai_compatible` together with `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` to call an OpenAI-compatible vendor

The backend exposes the resolved runtime state through `/health`, serves normalized market state from `/api/market/snapshot`, replayable recent events from `/api/events/recent`, supports on-demand multi-agent analysis through `POST /api/analysis/run`, exposes paper-trading control/status routes under `/api/execution/*`, exposes risk policy/live-gating controls under `/api/risk/*`, returns the last stored analysis through `/api/analysis/latest`, and streams live updates over `/ws`.

## Current Phase Scope

Current shipped scope includes:

- backend and frontend workspace scaffolding
- env-driven backend settings
- mock-safe runtime resolution
- typed market snapshot and event contracts
- JSONL-backed replayable event logging
- websocket broadcast for backend market state changes
- typed PrimoAgent role outputs with rationale, confidence, and recommendation metadata
- swappable AI provider boundary with mock and OpenAI-compatible modes
- on-demand multi-agent analysis persistence and latest-result retrieval
- paper-trading execution status, lifecycle events, and operator pause/resume control
- configurable server-side risk limits, risk-approval enforcement, kill-switch halt, and guarded live-mode enablement
- frontend live market monitoring shell
- Dockerfiles and a two-service `docker-compose.yml`
- backend smoke testing and startup documentation

Still intentionally excluded:

- PrimoAgent role orchestration
- live trading enablement flows
- the full trader dashboard and analytics surfaces
- full dashboard execution/risk UX

## Local Development

If you want to run services without Docker:

### Backend

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e backend[dev]
cd backend && pytest -q
uvicorn app.main:app --app-dir backend --reload
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

## Safety Notes

- Paper-first and mock-safe operation are the intended defaults
- Live trading is disabled in Phase 1 and should remain off until later risk-gated phases land
- Secrets belong in `.env`, never in committed source files

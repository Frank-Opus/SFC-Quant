# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Internal service HTTP:**
- Backend runtime snapshot API - the frontend loads `GET /health` from `backend/app/api/routes/health.py` and renders it through `frontend/src/lib/runtime.ts` and `frontend/src/App.tsx`
  - SDK/Client: browser `fetch` in `frontend/src/lib/runtime.ts`
  - Auth: None
- Backend root snapshot API - the backend also exposes runtime metadata at `GET /` in `backend/app/main.py`
  - SDK/Client: FastAPI route handler in `backend/app/main.py`
  - Auth: None

**AI provider seam (configuration only):**
- Swappable AI provider slot - `AI_PROVIDER` and `AI_API_KEY` are accepted by `backend/app/core/config.py`, and safe-mode warnings are emitted by `backend/app/core/runtime.py`
  - SDK/Client: Not detected; no third-party AI SDK imports or provider packages are present in `backend/pyproject.toml` or `backend/app/`
  - Auth: `AI_API_KEY`

**Exchange seam (configuration only):**
- Exchange selection slot - `EXCHANGE_ID`, `EXCHANGE_API_KEY`, and `EXCHANGE_API_SECRET` are accepted by `backend/app/core/config.py`, with `binance` as the default identifier
  - SDK/Client: Not detected; `ccxt` and `freqtrade` are not present in `backend/pyproject.toml` and no exchange imports exist in `backend/app/`
  - Auth: `EXCHANGE_API_KEY`, `EXCHANGE_API_SECRET`

**Realtime seam (configuration only):**
- Reserved WebSocket endpoint - `FRONTEND_WS_URL` and `VITE_WS_URL` point to `ws://backend:8000/ws` in `docker-compose.yml`, `frontend/Dockerfile`, and `backend/app/core/config.py`
  - SDK/Client: Not detected; no WebSocket server or browser WebSocket client is implemented under `backend/app/` or `frontend/src/`
  - Auth: None

**Container health probing:**
- Local self-check loop - backend containers probe `http://127.0.0.1:8000/health` in `docker-compose.yml` and `backend/Dockerfile`
  - SDK/Client: Python standard library `urllib.request`
  - Auth: None

No runtime calls to third-party AI APIs, exchange APIs, databases, or webhook providers are implemented in the Phase 1 source files under `backend/app/` and `frontend/src/`.

## Data Storage

**Databases:**
- Not detected
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local filesystem only; project files and container files are used from `backend/`, `frontend/`, and the repo root

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None
  - Implementation: No auth middleware, identity provider client, token exchange, or session store is present in `backend/app/main.py`, `backend/app/api/routes/health.py`, or `frontend/src/`

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Default process and container logs only; runtime observability currently comes from `/health` in `backend/app/api/routes/health.py` and `/` in `backend/app/main.py`

## CI/CD & Deployment

**Hosting:**
- Local Docker Compose deployment using the `backend` and `frontend` services in `docker-compose.yml`

**CI Pipeline:**
- None; no `.github/workflows/`, GitLab CI, or other pipeline configuration files are present at the repo root

## Environment Configuration

**Required env vars:**
- `APP_ENV`
- `APP_MODE`
- `LIVE_TRADING_ENABLED`
- `AI_PROVIDER`
- `AI_API_KEY`
- `EXCHANGE_ID`
- `EXCHANGE_API_KEY`
- `EXCHANGE_API_SECRET`
- `FRONTEND_API_URL`
- `FRONTEND_WS_URL`
- `VITE_API_BASE_URL`
- `VITE_WS_URL`

**Secrets location:**
- Root `.env` is the live runtime location loaded by `backend/app/core/config.py` and consumed by `docker-compose.yml`
- Root `.env.example` exists as the committed developer template
- Keep live API keys and exchange credentials out of `frontend/src/` and other committed source files

## Webhooks & Callbacks

**Incoming:**
- `GET /` in `backend/app/main.py`
- `GET /health` in `backend/app/api/routes/health.py`

**Outgoing:**
- Browser `fetch` from `frontend/src/lib/runtime.ts` to the backend `GET /health` endpoint
- Local backend health probes from `docker-compose.yml` and `backend/Dockerfile` to `http://127.0.0.1:8000/health`

---

*Integration audit: 2026-04-01*

# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- Python `>=3.10` with a Python 3.12 container runtime - backend control-plane code in `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/runtime.py`, and `backend/app/api/routes/health.py`
- TypeScript `^5.9.2` - frontend SPA code and compiler config in `frontend/src/App.tsx`, `frontend/src/lib/runtime.ts`, `frontend/src/main.tsx`, and `frontend/tsconfig.app.json`

**Secondary:**
- CSS with Tailwind CSS 4 import syntax - frontend styling in `frontend/src/styles.css`
- YAML - local service orchestration in `docker-compose.yml`
- TOML and JSON - package, build, and compiler metadata in `backend/pyproject.toml`, `frontend/package.json`, and `frontend/tsconfig.json`

## Runtime

**Environment:**
- Python 3.12-slim - backend container base image in `backend/Dockerfile`
- Node.js 22-alpine - frontend container base image in `frontend/Dockerfile`
- Browser SPA + Uvicorn API - Vite serves the frontend on port `5173` and Uvicorn serves the backend on port `8000` per `frontend/vite.config.ts`, `frontend/Dockerfile`, and `backend/Dockerfile`

**Package Manager:**
- `pip` with PEP 621 metadata and Hatchling packaging - backend install flow defined by `backend/pyproject.toml`
- `npm` - frontend install and build flow defined by `frontend/package.json`
- Lockfile: `frontend/package-lock.json` present (`lockfileVersion: 3`); Python lockfile not detected

## Frameworks

**Core:**
- FastAPI `>=0.116.0,<1.0.0` - HTTP control plane in `backend/app/main.py` and `backend/app/api/routes/health.py`
- Pydantic Settings `>=2.10.0,<3.0.0` - environment loading and normalization in `backend/app/core/config.py`
- React `^19.1.1` - frontend runtime shell in `frontend/src/App.tsx` and `frontend/src/main.tsx`

**Testing:**
- pytest `>=8.4.0,<9.0.0` - backend test runner configured in `backend/pyproject.toml`
- FastAPI `TestClient` with `httpx` `>=0.28.0,<1.0.0` - backend HTTP assertions in `backend/tests/test_health.py`

**Build/Dev:**
- Uvicorn `>=0.35.0,<1.0.0` with `standard` extras - backend ASGI server in `backend/Dockerfile` and `README.md`
- Vite `^7.1.3` with `@vitejs/plugin-react` `^5.0.0` - frontend bundler and dev server in `frontend/package.json` and `frontend/vite.config.ts`
- Tailwind CSS `^4.1.12` with `@tailwindcss/vite` `^4.1.12` - frontend styling pipeline in `frontend/src/styles.css` and `frontend/vite.config.ts`
- TypeScript project references - split app/node compiler setup in `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, and `frontend/tsconfig.node.json`

## Key Dependencies

**Critical:**
- `fastapi` `>=0.116.0,<1.0.0` - exposes the current `/` and `/health` API surface from `backend/app/main.py`
- `pydantic-settings` `>=2.10.0,<3.0.0` - centralizes env contracts and safe defaults in `backend/app/core/config.py`
- `react` and `react-dom` `^19.1.1` - render the frontend shell from `frontend/src/main.tsx`
- `lightweight-charts` `^5.0.8` - installed in `frontend/package.json` for planned chart work; no imports are present under `frontend/src/`
- `framer-motion` `^12.23.12` - installed in `frontend/package.json` for planned motion work; no imports are present under `frontend/src/`

**Infrastructure:**
- Docker Compose - two-service local runtime and health ordering in `docker-compose.yml`
- Browser `fetch` - frontend-to-backend runtime snapshot loading in `frontend/src/lib/runtime.ts`
- Python standard-library `urllib.request` - container health probes in `backend/Dockerfile` and `docker-compose.yml`

## Configuration

**Environment:**
- Backend settings load root `.env` and parent `../.env` via `SettingsConfigDict` in `backend/app/core/config.py`
- Use the env contract implemented by `backend/app/core/config.py`, `backend/app/core/runtime.py`, and `docker-compose.yml`: `APP_ENV`, `APP_MODE`, `LIVE_TRADING_ENABLED`, `AI_PROVIDER`, `AI_API_KEY`, `EXCHANGE_ID`, `EXCHANGE_API_KEY`, `EXCHANGE_API_SECRET`, `FRONTEND_API_URL`, and `FRONTEND_WS_URL`
- Frontend containers also receive `VITE_API_BASE_URL` and `VITE_WS_URL` in `docker-compose.yml` and `frontend/Dockerfile`, but the current frontend code resolves `http://${host}:8000` directly in `frontend/src/lib/runtime.ts`
- `.env` and `.env.example` exist at the repo root; keep live values out of committed source and out of `frontend/src/`

**Build:**
- Backend build config lives in `backend/pyproject.toml` and `backend/Dockerfile`
- Frontend build config lives in `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, and `frontend/Dockerfile`
- Compose startup, health checks, and container env injection live in `docker-compose.yml`

## Platform Requirements

**Development:**
- Docker Engine with Compose support is the primary bootstrap path documented in `README.md` and encoded in `docker-compose.yml`
- Local backend development requires Python `>=3.10` per `backend/pyproject.toml`
- Local frontend development requires Node.js and npm; `frontend/Dockerfile` establishes Node 22 as the container baseline

**Production:**
- Local-first deployment target is a single host running the `backend` and `frontend` services from `docker-compose.yml`
- PrimoAgent, Freqtrade, ccxt, Tremor, shadcn/ui, and a live WebSocket implementation are planned in `AGENTS.md` and `.planning/ROADMAP.md`, but the current repository only ships the FastAPI runtime shell, env seams, and React frontend baseline in `backend/app/` and `frontend/src/`

---

*Stack analysis: 2026-04-01*

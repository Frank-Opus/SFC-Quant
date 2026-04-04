# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Local-first monorepo with a thin FastAPI control plane, a single-page React shell, and Docker Compose orchestration at the repository root.

**Key Characteristics:**
- Runtime composition happens in `docker-compose.yml`, with service-specific container builds in `backend/Dockerfile` and `frontend/Dockerfile`.
- Backend request handling stays thin in `backend/app/main.py` and `backend/app/api/routes/health.py`; environment normalization and runtime classification live in `backend/app/core/config.py` and `backend/app/core/runtime.py`.
- Frontend bootstrapping stays minimal in `frontend/src/main.tsx`; the rendered shell in `frontend/src/App.tsx` reads backend state through `frontend/src/lib/runtime.ts`.
- Shared runtime contracts are duplicated across the stack instead of extracted into a shared package: `backend/app/core/runtime.py` defines the backend model and `frontend/src/lib/runtime.ts` mirrors the browser-side TypeScript shape.
- Repo-level planning and delivery artifacts live beside runtime code in `.planning/`, while product code stays isolated under `backend/` and `frontend/`.

## Layers

**Local orchestration layer:**
- Purpose: Start the two runtime services and inject environment variables into each container.
- Location: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`
- Contains: Compose service wiring, container commands, port exposure, and backend health checks.
- Depends on: Root environment files (`.env` and `.env.example` exist at the repo root), `backend/pyproject.toml`, and `frontend/package.json`.
- Used by: Contributor bootstrap flow in `README.md` and container-based local startup.

**Backend API layer:**
- Purpose: Create the ASGI application and mount HTTP route modules.
- Location: `backend/app/main.py`, `backend/app/api/routes/health.py`
- Contains: `FastAPI(...)`, the root route, and the `/health` route.
- Depends on: `backend/app/core/config.py` and `backend/app/core/runtime.py`.
- Used by: Browser clients, Docker health checks, and backend smoke tests in `backend/tests/test_health.py`.

**Backend core layer:**
- Purpose: Centralize environment-backed settings and convert them into a typed runtime snapshot.
- Location: `backend/app/core/config.py`, `backend/app/core/runtime.py`
- Contains: The cached `Settings` object, validators, the `RuntimeSnapshot` model, and runtime-mode resolution logic.
- Depends on: `pydantic`, `pydantic-settings`, and process environment variables.
- Used by: `backend/app/main.py` and `backend/app/api/routes/health.py`.

**Backend model namespace:**
- Purpose: Reserve a package boundary for backend-owned schemas beyond runtime metadata.
- Location: `backend/app/models/__init__.py`
- Contains: Package scaffold only; no concrete models are defined under `backend/app/models/`.
- Depends on: Backend application package layout.
- Used by: Future backend route and service code that needs reusable typed payloads.

**Frontend application layer:**
- Purpose: Bootstrap the browser app and render the operator shell.
- Location: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css`
- Contains: React root mounting, the runtime dashboard shell, and the global visual system.
- Depends on: `frontend/src/lib/runtime.ts`, React, and browser fetch APIs.
- Used by: The browser entry declared in `frontend/index.html`.

**Frontend integration layer:**
- Purpose: Encapsulate backend health loading and provide a safe fallback contract to the UI.
- Location: `frontend/src/lib/runtime.ts`
- Contains: The TypeScript `RuntimeSnapshot` type, `fallbackRuntimeSnapshot`, backend URL resolution, and `loadRuntimeSnapshot()`.
- Depends on: The `/health` endpoint exposed from `backend/app/api/routes/health.py`.
- Used by: `frontend/src/App.tsx`.

**Planning and process layer:**
- Purpose: Store roadmap, project state, completed phase plans, and generated codebase maps beside the runtime code.
- Location: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/codebase/`
- Contains: Product decisions, requirement traceability, execution state, and mapper outputs.
- Depends on: The GSD workflow captured in `AGENTS.md`.
- Used by: Repository automation and future implementation planning.

## Data Flow

**Runtime status flow:**

1. `docker-compose.yml` starts `backend` and `frontend`, wiring ports `8000` and `5173` and passing runtime-related environment variables into both services.
2. `backend/app/main.py` creates the FastAPI app and mounts `health_router` from `backend/app/api/routes/health.py`.
3. Requests to `/` and `/health` call `get_settings()` from `backend/app/core/config.py` and then `resolve_runtime()` from `backend/app/core/runtime.py`.
4. `backend/app/core/runtime.py` converts environment-backed settings into the typed `RuntimeSnapshot` payload and computes warnings plus the final runtime mode.
5. `frontend/src/lib/runtime.ts` derives the backend base URL from `window.location.hostname`, requests `/health`, and falls back to a local snapshot when the request fails.
6. `frontend/src/App.tsx` stores the result in component state and renders runtime cards plus the first warning, if present.

**Backend health verification flow:**

1. `docker-compose.yml` and `backend/Dockerfile` both probe `http://127.0.0.1:8000/health` as the backend readiness signal.
2. `backend/tests/test_health.py` clears the cached settings object, starts `TestClient(app)`, and asserts that `/health` reports the expected mock-safe payload.
3. The same payload shape is consumed by the browser through `frontend/src/lib/runtime.ts`, so the smoke test and the UI share one HTTP contract.

**State Management:**
- Backend runtime state is derived from the cached `Settings` object returned by `get_settings()` in `backend/app/core/config.py`; request handlers rebuild a fresh `RuntimeSnapshot` from that configuration.
- Frontend state lives in local React component state inside `frontend/src/App.tsx`; no client-side store, router, or data cache layer exists under `frontend/src/`.
- Cross-service state persistence is not detected; there is no database, queue, or filesystem event store under `backend/app/`.

## Key Abstractions

**`Settings`:**
- Purpose: Represent the backend's environment contract in one typed object.
- Examples: `backend/app/core/config.py`
- Pattern: `BaseSettings` with `@field_validator` normalization and `@lru_cache` memoization.

**`RuntimeSnapshot`:**
- Purpose: Represent the backend runtime state that both health routes serialize and the frontend displays.
- Examples: `backend/app/core/runtime.py`, `frontend/src/lib/runtime.ts`
- Pattern: Backend `BaseModel` mirrored by a TypeScript object type.

**`resolve_runtime()`:**
- Purpose: Convert raw settings into operator-facing runtime modes and warnings.
- Examples: `backend/app/core/runtime.py`
- Pattern: Pure decision function that derives flags such as `runtime_mode` and `live_trading_enabled` from validated config.

**`loadRuntimeSnapshot()`:**
- Purpose: Isolate backend fetch logic from the UI shell.
- Examples: `frontend/src/lib/runtime.ts`
- Pattern: Boundary helper that returns either live backend data or a local fallback payload with the same shape.

## Entry Points

**Compose startup:**
- Location: `docker-compose.yml`
- Triggers: `docker compose up --build`
- Responsibilities: Build `backend` and `frontend`, expose ports, pass runtime env vars, and gate frontend startup on backend health.

**Backend ASGI app:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --host 0.0.0.0 --port 8000` from `backend/Dockerfile` or local development commands in `README.md`
- Responsibilities: Construct the FastAPI app, mount routes, and return root runtime metadata.

**Frontend browser bootstrap:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite dev server or built frontend entry referenced from `frontend/index.html`
- Responsibilities: Mount React into `#root`, load global CSS, and render `App` inside `React.StrictMode`.

**Frontend shell component:**
- Location: `frontend/src/App.tsx`
- Triggers: Initial browser render
- Responsibilities: Load runtime metadata on mount and render the current local-runtime dashboard shell.

## Error Handling

**Strategy:** Fail soft at the application edges and expose degraded state through typed runtime metadata instead of aborting startup.

**Patterns:**
- `backend/app/core/runtime.py` converts missing credentials and invalid live-trading combinations into warnings plus safe runtime modes (`mock-safe` or `credentials-missing`) instead of raising route-level exceptions.
- `frontend/src/lib/runtime.ts` catches fetch errors and returns `fallbackRuntimeSnapshot`, so the UI keeps rendering even when the backend is unavailable.
- `backend/tests/test_health.py` resets the cached settings object before and after assertions to keep environment-sensitive behavior deterministic.
- Custom exception middleware, structured error envelopes, and retry layers are not detected under `backend/app/` or `frontend/src/`.

## Cross-Cutting Concerns

**Logging:** Framework-default logs only. No dedicated logging module exists under `backend/app/`, and the frontend renders state without a browser-side logging utility under `frontend/src/`.

**Validation:** `backend/app/core/config.py` validates environment input with `BaseSettings`, `Field`, and `@field_validator`; `backend/app/core/runtime.py` validates outbound runtime payloads with `RuntimeSnapshot`.

**Authentication:** Not detected. Routes in `backend/app/main.py` and `backend/app/api/routes/health.py` are unauthenticated local-runtime endpoints.

**Realtime transport:** Not implemented yet. `FRONTEND_WS_URL` appears in `backend/app/core/config.py` and `docker-compose.yml`, but no WebSocket route or server module exists under `backend/app/`.

---

*Architecture analysis: 2026-04-01*

# Phase 1: Foundation & Local Runtime - Research

**Date:** 2026-04-01
**Status:** Complete
**Confidence:** High

## Objective

Research how to plan and implement a runnable monorepo baseline for `dSFC-Quant` that satisfies `PLAT-01`, `PLAT-02`, `PLAT-03`, and `OPS-01` without overbuilding later-phase concerns.

## What Matters For Planning

### 1. Keep the baseline monorepo deliberately thin

Phase 1 should establish conventions and startup reliability, not future-proof every subsystem. The lowest-risk path is a root workspace with `backend/` and `frontend/` as first-class applications, plus a small set of shared root assets for local ops:

- `docker-compose.yml`
- root `.env.example`
- root `README.md`
- root `.gitignore`
- optional lightweight helper files such as `Makefile` or `scripts/`

Additional future-facing directories such as `strategies/`, `data/`, or `docs/` can be added only if they directly support local runtime or onboarding in this phase.

### 2. Backend shell should expose the operational seams, not full features

The backend should be a FastAPI control-plane shell with:

- typed settings loader from environment
- health endpoint
- basic API metadata route or config introspection route
- WebSocket placeholder endpoint
- mock-safe runtime mode when exchange or AI credentials are missing

This creates the right integration seam for later PrimoAgent, Freqtrade, and provider adapters without pretending those subsystems exist yet.

### 3. Frontend shell should be custom and composable, not template-bound

The frontend should not start from a heavy admin/dashboard framework. Research and context both point to a trader workstation with bespoke layout and high visual flexibility. Phase 1 should therefore:

- scaffold Vite + React + Tailwind
- initialize shadcn/ui and baseline app structure
- add a lightweight shell page that proves startup and future dashboard direction
- avoid overcommitting to final dashboard information architecture

Tremor and Lightweight Charts can be installed or reserved as dependencies, but the phase only needs enough UI structure to validate startup and future extension.

### 4. Mock-safe behavior must be explicit, not accidental

`PLAT-03` is a core requirement, so missing secrets cannot produce broken startup. The plan should define a settings contract with explicit toggles such as:

- runtime mode: `mock` by default
- exchange provider mode disabled or paper-safe when credentials absent
- AI provider mode disabled or mock-safe when keys absent
- live trading hard-disabled by default

The startup path should make the resulting mode visible in logs and API responses so developers understand what is running.

### 5. Docker Compose remains the primary operator path

The repo can support local dev commands, but the documented default should be:

- `docker compose up --build`

To satisfy `OPS-01`, Compose should boot exactly two services:

- `backend`
- `frontend`

Health checks should validate that backend is reachable and frontend can serve the app shell. This keeps local onboarding stable and aligned with project constraints.

## Recommended File/Layout Direction

### Root

- `backend/`
- `frontend/`
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `.gitignore`
- optional `Makefile`

### Backend

- `backend/app/main.py`
- `backend/app/api/`
- `backend/app/core/config.py`
- `backend/app/core/logging.py`
- `backend/app/models/`
- `backend/tests/`
- `backend/Dockerfile`
- `backend/pyproject.toml`
- `backend/.env.example` or root-driven env contract

### Frontend

- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/`
- `frontend/src/lib/`
- `frontend/src/hooks/`
- `frontend/public/`
- `frontend/Dockerfile`
- `frontend/package.json`

## Risks To Account For In Plans

### Overbuilding Phase 1

The main planning risk is letting Phase 1 absorb Phase 2-6 concerns. The plan should stop at shells, contracts, and local runtime proof.

### Secret/config drift

If `.env` contracts are split between services without a clear documented source of truth, onboarding will degrade quickly. The plan should define one documented env story and keep names explicit.

### Docker-first but not Docker-verified

A compose file without health endpoints, correct ports, or startup instructions does not satisfy the phase. Verification must include an end-to-end startup check.

### Faux frontend progress

Using a canned admin template would accelerate the wrong thing and create migration cost later. The plan should scaffold a clean custom shell instead.

## Planning Implications

The phase should likely break into four executable plans:

1. Monorepo/application scaffolding
2. Settings/env contracts and mock-safe defaults
3. Dockerfiles, compose, and health plumbing
4. Bootstrap docs and startup verification

Those map cleanly to the roadmap and keep responsibilities narrow.

## Validation Architecture

Phase 1 needs quick feedback that focuses on startup integrity rather than deep business logic. The preferred validation mix is:

- backend smoke check: import/app startup plus health route
- frontend smoke check: build or serve verification
- compose verification: service definitions and container health
- docs verification: bootstrap steps and env examples present

Automated checks can stay lightweight:

- backend: `pytest` for minimal API/config smoke tests
- frontend: `npm run build` or `npm run test` if a thin test setup exists
- infrastructure/docs: grep-based acceptance criteria in plans

## Canonical Inputs Reviewed

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/01-foundation-local-runtime/01-CONTEXT.md`
- `AGENTS.md`

## Recommendation

Plan Phase 1 as a thin, deterministic runtime foundation with visible mock-safe behavior and a custom UI shell. Do not spend planning budget on real trading logic, full dashboard composition, or optional design-skill dependencies.

## RESEARCH COMPLETE

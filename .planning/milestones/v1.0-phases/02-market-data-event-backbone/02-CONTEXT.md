# Phase 2: Market Data & Event Backbone - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Autonomous (balanced progression)

<domain>
## Phase Boundary

Build the normalized market and event layer that both the agent system and the future dashboard depend on. This phase covers market snapshot generation, a ccxt-facing adapter boundary with mock-safe fallback, replayable event persistence, and WebSocket delivery of backend state changes. It does not yet implement PrimoAgent orchestration, execution logic, or the premium dashboard visuals planned for later phases.

</domain>

<decisions>
## Implementation Decisions

### Market data contract
- **D-01:** Define normalized backend models for candles, ticker snapshots, symbol snapshots, phase events, and WebSocket envelopes under `backend/app/models/` so later phases reuse typed contracts instead of ad-hoc dict payloads.
- **D-02:** Keep the public API narrow in Phase 2: one HTTP snapshot route, one recent-events route, and one WebSocket stream route are sufficient.
- **D-03:** Include both symbol-level market data and system/runtime metadata in snapshot responses so the frontend and later agent phases can share the same contract surface.

### Adapter strategy
- **D-04:** Introduce a ccxt-facing adapter boundary now, but keep mock generation as the default runtime path when `APP_MODE=mock` or exchange access is unavailable.
- **D-05:** Use deterministic mock-safe market generation for local startup and tests, while preserving a separate adapter implementation for real exchange reads in later non-mock runs.

### Event backbone
- **D-06:** Persist emitted events to local JSONL files for replay/debugging rather than introducing a database in Phase 2.
- **D-07:** Keep an in-memory recent-event buffer for fast HTTP/WebSocket fanout while treating JSONL as the replay source.
- **D-08:** Broadcast normalized events over `/ws` so the frontend can react without polling.

### Frontend integration
- **D-09:** Extend the frontend shell into a live market-monitoring surface that proves WebSocket-driven updates without prematurely building the final dashboard information architecture.
- **D-10:** Fix the existing frontend API base URL resolution so configured backend URLs are respected before falling back to browser-host inference.

### the agent's Discretion
- Exact naming of internal service classes and helper modules
- Whether the WebSocket sends an initial snapshot as one frame or multiple typed frames
- The specific visual arrangement of the Phase 2 frontend shell as long as operator clarity stays high

</decisions>

<specifics>
## Specific Ideas

- Keep the backend contracts inspectable and auditable; later agent and execution phases should consume the same event envelope shape.
- Favor a local-first event log (`jsonl`) over heavier infra such as Redis or Postgres.
- The frontend can remain a shell, but it should visibly prove that live backend market changes arrive over WebSocket.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and requirements
- `.planning/PROJECT.md` — Product identity, local-first constraints, required backend/frontend stacks, and safety boundaries
- `.planning/REQUIREMENTS.md` — Phase-linked requirements `DATA-01`, `DATA-02`, `DATA-03`, and `WS-01`
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown
- `.planning/STATE.md` — Current continuity state and carried concerns

### Codebase conventions
- `.planning/codebase/ARCHITECTURE.md` — Current backend/frontend layering and extension seams
- `.planning/codebase/STRUCTURE.md` — Where new backend services, models, and frontend helpers should live
- `.planning/codebase/CONVENTIONS.md` — Naming, style, and error-handling patterns
- `.planning/codebase/TESTING.md` — Existing pytest-first verification style and testing gaps
- `.planning/codebase/CONCERNS.md` — Known issues to address, including missing schema sharing and missing WebSocket backbone

### Phase 1 foundation
- `.planning/phases/01-foundation-local-runtime/01-CONTEXT.md` — Established monorepo/runtime decisions
- `.planning/phases/01-foundation-local-runtime/01-RESEARCH.md` — Thin baseline direction and local-first operating assumptions
- `.planning/phases/01-foundation-local-runtime/01-VERIFICATION.md` — Verified constraints from the current running baseline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/core/config.py` — existing env-driven settings object to extend with market/event configuration
- `backend/app/core/runtime.py` — current runtime snapshot logic that can be composed into broader snapshot responses
- `backend/app/main.py` — existing FastAPI entrypoint where lifespan, routes, and WebSocket registration can be layered in
- `frontend/src/lib/runtime.ts` — current backend health fetch path and runtime type definitions to evolve into richer backend client helpers
- `frontend/src/App.tsx` — current single-shell UI that can be expanded into a live monitoring surface without changing the overall app bootstrap

### Established Patterns
- Backend code uses typed Pydantic models and thin route modules around core logic
- Frontend currently uses a single React component with local state and one mount-time effect; this phase can introduce a small hook/util layer without forcing a global store yet
- The repo stays local-first and lightweight, so file persistence and in-process broadcasting are preferred over new infrastructure services

### Integration Points
- New backend API routes should register under `backend/app/api/routes/`
- Shared market/event models should live under `backend/app/models/`
- Runtime services should live under `backend/app/services/` and be wired from the FastAPI lifespan/app state
- Frontend live data hooks/helpers should live under `frontend/src/lib/` and/or `frontend/src/hooks/`

</code_context>

<deferred>
## Deferred Ideas

- Full dashboard charts and analytics surfaces — later UI phases
- PrimoAgent consumption of the event backbone — Phase 3
- Execution/order event flows — Phase 4+
- Database-backed historical storage and richer replay tooling — later hardening phases

</deferred>

---
*Phase: 02-market-data-event-backbone*
*Context gathered: 2026-04-01*

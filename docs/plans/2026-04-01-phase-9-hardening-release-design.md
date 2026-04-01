# Phase 9 Design: Hardening, Tests & Release Docs

**Date:** 2026-04-01
**Mode:** Autonomous continuation
**Status:** Approved by standing user preference to continue without further confirmation

## Problem

By the end of Phase 8, the product is feature-rich enough to demo, but the final v1 requirements still need explicit hardening:

1. a developer needs a clear smoke-test path that exercises REST, WebSocket, and paper-trade behavior
2. operators need multiple health/diagnostics surfaces rather than a single basic `/health` response
3. contributors need up-to-date startup, testing, diagnostics, and safety documentation before open-source handoff

## Constraints

- Keep the stack local-first and lightweight; no new external observability dependency
- Preserve inspectability; diagnostics should reflect real backend state instead of synthetic summaries
- Reuse the current FastAPI app state and replayable event bus rather than building a second runtime model
- Documentation should be practical, task-oriented, and explicit about paper-first safety boundaries

## Approaches Considered

### Option A — Documentation-only release polish
Treat existing tests and `/health` as sufficient, then mostly rewrite docs.

- Pros: fastest
- Cons: weak OPS-02/OPS-03 coverage; no explicit WebSocket smoke or diagnostics expansion

### Option B — Focused hardening layer (**recommended**)
Add dedicated smoke coverage, structured stdout logging, richer health/diagnostics endpoints, and release-facing docs.

- Pros: satisfies requirements directly while staying lean
- Cons: modest amount of backend plumbing and doc work

### Option C — Full observability stack
Add Prometheus/Grafana/log aggregation and a much larger release checklist.

- Pros: richer operations story
- Cons: violates local-first simplicity and overreaches v1 scope

## Chosen Design

Adopt Option B.

## Architecture

### 1. Smoke coverage
- Add a dedicated smoke test module that validates:
  - REST health + diagnostics responses
  - WebSocket handshake and initial snapshot delivery
  - analysis → paper-dispatch path end-to-end
- Keep smoke tests inside `pytest` so developers can run a single familiar command

### 2. Health and diagnostics surfaces
- Expand health endpoints to include:
  - `/health`
  - `/health/live`
  - `/health/ready`
- Add `/api/diagnostics/summary` for an operator-facing diagnostic snapshot including:
  - runtime mode
  - websocket connection count
  - event log path
  - recent event counts
  - warnings
  - execution/risk/strategy state summaries

### 3. Structured logging
- Configure a lightweight JSON formatter for backend stdout logs
- Log startup/shutdown and event publication with structured fields so local users can inspect runtime behavior without extra infrastructure

### 4. Documentation
- Update `README.md` to reflect Phases 1-9 shipped state, test commands, and diagnostics endpoints
- Expand `backend/README.md` for backend-only development and smoke-test workflow
- Add an operator runbook covering startup, health checks, smoke tests, and safety steps
- Add a release-readiness checklist documenting what "ready to publish" means for this repo

## Testing Strategy

- `python3 -m pytest -q backend/tests`
- `cd frontend && npm run build`
- `docker compose config >/dev/null`
- Human check: inspect `/health/ready`, `/api/diagnostics/summary`, and a WebSocket session while the app runs

## Deferred

- external metrics backends
- persistent tracing or log shipping
- authenticated multi-user operations surfaces

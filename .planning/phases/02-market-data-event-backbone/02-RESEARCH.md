# Phase 2: Market Data & Event Backbone - Research

**Date:** 2026-04-01
**Status:** Complete
**Confidence:** High

## Objective

Research how to add a normalized market/event backbone on top of the Phase 1 local runtime without breaking mock-safe startup, local-first deployment, or future agent/execution extensibility.

## What Matters For Planning

### 1. Phase 2 should introduce contracts before complexity

The biggest Phase 2 risk is letting ccxt connectivity, event persistence, WebSocket fanout, and frontend consumption evolve as unrelated ad-hoc payloads. The backend should define typed event and market models first, then make every HTTP and WebSocket payload flow through those types.

### 2. Mock-safe defaults still govern the runtime

Even though this phase adds a ccxt-facing adapter layer, the default app path must remain safe and runnable with no external credentials and no network assumptions. The easiest way to satisfy both `DATA-02` and `PLAT-03` is:

- keep a real exchange adapter boundary backed by ccxt
- default to a deterministic mock adapter in `APP_MODE=mock`
- make route/service code depend on the adapter interface, not on ccxt directly

### 3. JSONL persistence is the right local-first event store

Requirements ask for replay/debugging support, not a full database. A local JSONL append-only event log is enough for this phase because it is:

- inspectable by humans
- easy to mount or archive later
- cheap to write during local development
- simple to replay into future analysis tooling

### 4. WebSocket delivery should build on an in-process event hub

Phase 2 only needs one backend process and one frontend process. A small in-process broadcast hub keeps the architecture lightweight and still provides the correct seam for later fanout infrastructure if the project grows.

### 5. Frontend should prove realtime, not overbuild the final dashboard

This phase only needs to prove that backend state changes land in the browser without polling. A focused market monitor shell with connection state, live prices, and an event tape is enough and keeps the more polished dashboard work for later phases.

## Recommended Build Order

1. Define typed market/event contracts and backend config additions
2. Add adapter boundary + mock adapter + runtime market service
3. Add event persistence and WebSocket broadcast hub
4. Expose HTTP snapshot/recent-event routes and wire the frontend to fetch + subscribe
5. Add backend tests for snapshot, replay, and WebSocket flow

## Key Risks

- Background market streaming tasks can complicate tests unless startup behavior is controllable and deterministic
- Frontend/backend contract drift will worsen if the frontend mirrors backend types manually without a stable payload shape
- Hardcoding API URLs will undermine Compose or future preview environments; this phase should fix the current fallback logic

## Recommendation

Implement a narrow but typed Phase 2 backbone: a `MarketRuntimeService` with mock-safe generation, a `JsonlEventStore`, an in-process WebSocket hub, and a frontend shell that subscribes to the live stream. This satisfies the roadmap while keeping the system ready for Phase 3 agent ingestion and Phase 4 execution events.

## RESEARCH COMPLETE

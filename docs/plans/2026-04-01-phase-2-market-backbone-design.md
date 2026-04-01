# Phase 2 Market Backbone Design

## Approved Direction

Use a balanced autonomous implementation for Phase 2 that preserves GSD artifacts while moving quickly. The backend should expose a typed market and event backbone with a ccxt-facing adapter seam, deterministic mock-safe defaults, replayable JSONL event storage, and websocket fanout to the frontend shell.

## Architecture

- `backend/app/models/` defines normalized candle, market snapshot, and event envelope contracts
- `backend/app/services/market.py` owns adapter selection, snapshot refresh, recent-event buffering, and websocket publication
- `backend/app/services/event_store.py` persists append-only JSONL replay logs
- `backend/app/services/realtime.py` manages in-process websocket fanout
- `backend/app/api/routes/` exposes `/api/market/snapshot`, `/api/events/recent`, and `/ws`
- `frontend/src/hooks/useMarketRuntime.ts` fetches the initial snapshot and upgrades to websocket-driven updates

## Key Decisions

1. Keep the default runtime mock-safe even after introducing the exchange adapter seam
2. Use JSONL replay storage instead of a database in Phase 2
3. Keep frontend scope focused on proving realtime delivery rather than building the final dashboard layout
4. Preserve local-first deployment by keeping the phase within the existing two-service compose topology

## Validation

- Backend tests verify snapshot shape, event replay persistence, and websocket bootstrap
- Frontend build verifies the live shell compiles against the new contracts
- Compose config validation ensures runtime env wiring remains consistent

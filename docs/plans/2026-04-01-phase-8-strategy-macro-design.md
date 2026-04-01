# Phase 8 Design: Strategy Factory & Macro Extensions

**Date:** 2026-04-01
**Mode:** Autonomous continuation
**Status:** Approved by standing user preference to continue without further confirmation

## Problem

Phase 7 leaves two major gaps in the v1 promise:

1. the multi-agent thesis still exposes only placeholder macro/news context without source-linked provenance
2. the optional RD-Agent(Q) seam does not exist yet, so operators cannot review generated strategy artifacts before adoption

Phase 8 needs to close both gaps without overstating external data fidelity or turning the local-first stack into a cloud-dependent subsystem.

## Constraints

- Keep the core stack unchanged: FastAPI backend, React/Tremor dashboard, PrimoAgent role visibility, Freqtrade + ccxt execution seam
- Preserve explainability: evidence and strategy outputs must be inspectable, typed, and auditable
- Keep RD-Agent(Q) optional and honest; do not claim real autonomous quant research when the provider is disabled
- Keep the platform useful in mock/local mode with no external services configured
- Reuse existing dashboard runtime state where possible instead of inventing a broad dashboard-only aggregate API

## Approaches Considered

### Option A — UI-only mock panel
Add frontend-only macro cards and a fake strategy panel populated from local constants.

- Pros: fastest implementation
- Cons: fails AGENT-05 and STRAT-01/02 in spirit; not reviewable or trustworthy

### Option B — Dedicated backend seam with deterministic artifacts (**recommended**)
Expand analysis output with structured macro evidence and add a local strategy-factory subsystem that writes reviewable artifacts to disk and exposes typed API routes.

- Pros: satisfies explainability, keeps local-first honesty, introduces real extension points for later provider-backed work
- Cons: slightly broader Phase 8 scope than a UI-only patch

### Option C — Full provider-backed research generation now
Attempt real upstream news ingestion plus provider-generated strategy code by default.

- Pros: ambitious end-state behavior
- Cons: fragile, secret-heavy, and misaligned with local-first safe mode; too much dependency risk for current milestone

## Chosen Design

Adopt Option B.

Phase 8 will deliver a real backend subsystem and a real dashboard surface, but remain conservative about what is mock versus external.

## Architecture

### 1. Thesis evidence model
- Extend agent analysis contracts with richer evidence metadata:
  - evidence entries keep `label`, `detail`, `kind`
  - source references include `title`, `kind`, `url`, `note`
- Add a compact macro thesis block for the `news_geopolitics` role that groups:
  - regime summary
  - catalysts
  - watch items
  - linked sources
- Preserve backward compatibility so existing role cards and tests still work

### 2. Analysis service behavior
- Replace the Phase 3 placeholder macro output with deterministic but structured source-linked evidence
- In mock mode, clearly label generated/internal evidence as simulated local context
- Allow provider-generated role payloads to pass through the same schema when upstream returns valid evidence/sources

### 3. Strategy factory subsystem
- Add env-configured optional settings:
  - `STRATEGY_FACTORY_ENABLED`
  - `STRATEGY_FACTORY_PROVIDER`
  - `STRATEGY_FACTORY_WORKSPACE`
  - `STRATEGY_FACTORY_AUTO_GENERATE`
- Introduce a service that can:
  - report status
  - toggle config at runtime
  - generate strategy artifacts from the latest analysis for a symbol/timeframe
  - list previously generated artifacts
- Generated artifacts land under a local review workspace, with one run per directory containing:
  - `strategy.md` review memo
  - `strategy.json` structured metadata
  - `strategy.py` scaffold stub for later runtime adoption

### 4. API surface
- `GET /api/strategy/status`
- `POST /api/strategy/config`
- `POST /api/strategy/generate`
- `GET /api/strategy/artifacts`

The API returns honest status and enablement reasons so the frontend can explain whether the subsystem is active, mock-backed, or disabled.

### 5. Frontend integration
- Extend dashboard runtime hook to load strategy status and artifact listings
- Add a thesis evidence panel to surface macro/news provenance in the same workspace as the existing thesis card
- Add a strategy-factory panel showing:
  - enablement state
  - provider/workspace
  - latest generation status
  - artifact count
  - generate action
  - recent artifacts list

## Data Flow

1. operator selects market and runs analysis
2. backend produces typed role outputs, including richer `news_geopolitics` evidence and sources
3. frontend renders the thesis evidence panel directly from the selected analysis payload
4. operator can enable strategy factory and request artifact generation
5. backend writes reviewable files to local workspace, emits strategy events, and returns artifact metadata
6. frontend refreshes strategy status/artifacts and displays the reviewable outputs

## Error Handling

- Missing latest analysis for generation returns a safe 404/400-style API error, not a fabricated strategy
- Disabled strategy factory still returns status and explains why generation is unavailable
- Mock/generated evidence remains clearly labeled in sources/notes
- Artifact generation failures emit warning/status fields without affecting analysis or execution core flows

## Testing Strategy

- Backend tests for macro/news source-linked evidence presence
- Backend tests for strategy-factory status/config behavior
- Backend tests for artifact generation and workspace persistence
- Full existing validation remains required:
  - `python3 -m pytest -q backend/tests`
  - `cd frontend && npm run build`
  - `docker compose config >/dev/null`

## Deferred

- Live external news ingestion and ranking
- Automatic strategy adoption into runtime execution
- Multi-artifact diff/review UI
- Real RD-Agent(Q) execution pipeline

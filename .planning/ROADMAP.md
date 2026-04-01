# Roadmap: dSFC-Quant

## Overview

dSFC-Quant moves from a local-first foundation to a fully explainable AI quant workstation in nine phases. The build order prioritizes trustworthy infrastructure first: reproducible startup, normalized event flow, typed agent decisions, realistic paper execution, and hard risk gates. Only after those foundations exist do the premium dashboard and optional strategy-factory features layer on top.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Local Runtime** - Create the repo runtime, service skeletons, env contracts, and compose startup flow. (completed 2026-04-01)
- [x] **Phase 2: Market Data & Event Backbone** - Normalize market data, define event contracts, and stream backend state. (completed 2026-04-01)
- [x] **Phase 3: PrimoAgent Core Graph** - Build the multi-agent analysis and provider abstraction layer. (completed 2026-04-01)
- [x] **Phase 4: Execution Engine & Paper Trading** - Integrate Freqtrade/ccxt into a realistic dry-run trade loop. (completed 2026-04-01)
- [x] **Phase 5: Risk Guardrails & Live Gating** - Add hard risk policies and explicit live-trading controls. (completed 2026-04-01)
- [x] **Phase 6: Pro Trading Dashboard Shell** - Deliver the operator dashboard with KPI cards, charts, controls, and live updates. (completed 2026-04-01)
- [x] **Phase 7: Advanced Visual Analytics** - Add heatmap, factor radar, richer overlays, and premium signal UX. (completed 2026-04-01)
- [x] **Phase 8: Strategy Factory & Macro Extensions** - Add optional RD-Agent(Q) workflow and deeper news/macro evidence panels. (completed 2026-04-01)
- [x] **Phase 9: Hardening, Tests & Release Docs** - Finish smoke tests, diagnostics, and contributor-facing documentation. (completed 2026-04-01)

## Phase Details

### Phase 1: Foundation & Local Runtime
**Goal**: Deliver a runnable monorepo baseline with backend/frontend shells, env-driven config, and one-command local startup.
**Depends on**: Nothing (first phase)
**Requirements**: [PLAT-01, PLAT-02, PLAT-03, OPS-01]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Developer can clone the repo and boot backend/frontend through the documented local flow.
  2. The stack can start without live secrets by using mock-safe defaults.
  3. Docker Compose brings up `backend` and `frontend` successfully.
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold backend and frontend workspaces with runtime shells and smoke verification
- [x] 01-02-PLAN.md — Add root env contracts, backend settings, and explicit mock-safe runtime visibility
- [x] 01-03-PLAN.md — Create Dockerfiles and a two-service compose topology
- [x] 01-04-PLAN.md — Document bootstrap flow and add automated startup verification

### Phase 2: Market Data & Event Backbone
**Goal**: Build the normalized market/event layer that both agents and dashboard depend on.
**Depends on**: Phase 1
**Requirements**: [DATA-01, DATA-02, DATA-03, WS-01]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Backend can normalize selected symbol/timeframe market streams through ccxt-facing adapters.
  2. Signal/market/trade events are persisted in a replayable format.
  3. Frontend can receive backend events over WebSocket without polling.
**Plans**: 4 plans

Plans:
- [x] 02-01: Design shared event schemas and storage contracts
- [x] 02-02: Implement market-data ingestion and normalization services
- [x] 02-03: Add WebSocket hub and publish/subscribe event routing
- [x] 02-04: Validate replay/debug paths and state serialization

### Phase 3: PrimoAgent Core Graph
**Goal**: Deliver a typed, explainable PrimoAgent workflow with swappable AI providers.
**Depends on**: Phase 2
**Requirements**: [AGENT-01, AGENT-02, AGENT-03, AGENT-04]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. User can trigger a multi-agent analysis for a selected symbol.
  2. Each agent role returns inspectable rationale and confidence metadata.
  3. Supported AI providers can be swapped via backend configuration without changing UI contracts.
**Plans**: 4 plans

Plans:
- [x] 03-01: Define PrimoAgent role graph and typed decision contracts
- [x] 03-02: Implement provider adapter boundary for third-party AI vendors
- [x] 03-03: Add orchestration services for manual and scheduled analysis runs
- [x] 03-04: Persist and expose per-agent rationale/status payloads

### Phase 4: Execution Engine & Paper Trading
**Goal**: Route approved signals through a realistic Freqtrade-backed paper-trading loop.
**Depends on**: Phase 3
**Requirements**: [EXEC-01, EXEC-03, EXEC-04]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. User can paper trade without risking real funds.
  2. Order states and fills are visible as live backend events.
  3. Operator can pause or resume execution through a control action.
**Plans**: 4 plans

Plans:
- [x] 04-01: Implement Freqtrade execution adapter and config handoff
- [x] 04-02: Wire signal-to-order translation for paper mode
- [x] 04-03: Stream order lifecycle and execution status events
- [x] 04-04: Add execution pause/resume controls and safeguards

### Phase 5: Risk Guardrails & Live Gating
**Goal**: Enforce pre-trade risk policy and explicitly gate real-money execution.
**Depends on**: Phase 4
**Requirements**: [EXEC-02, RISK-01, RISK-02, RISK-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. User can configure hard risk limits that affect runtime behavior.
  2. No trade is submitted without risk approval when the guard is enabled.
  3. Live mode cannot activate without explicit confirmation and valid credentials.
**Plans**: 4 plans

Plans:
- [x] 05-01: Implement risk-policy schemas and server-side enforcement
- [x] 05-02: Add trade-approval workflow between agents and execution
- [x] 05-03: Add global halt / kill-switch behavior for breached limits
- [x] 05-04: Add guarded live-mode enablement flow and audit events

### Phase 6: Pro Trading Dashboard Shell
**Goal**: Deliver the operator dashboard shell with premium controls, KPI cards, and live chart surfaces.
**Depends on**: Phase 5
**Requirements**: [DASH-01, DASH-02, DASH-04, WS-02]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can view live KPI cards for core trading metrics.
  2. User can inspect live price/P&L charts with signal overlays.
  3. User can control agent/runtime state from dashboard cards and see connection health.
**Plans**: 5 plans

Plans:
- [x] 06-01: Build the dashboard layout, theme system, and shadcn/Tremor shell
- [x] 06-02: Implement glassmorphism operator cards and runtime controls
- [x] 06-03: Add Lightweight Charts wrappers for price and P&L series
- [x] 06-04: Connect WebSocket state to frontend stores with reconnect UI
- [x] 06-05: Polish motion, hierarchy, and responsive behavior for desktop/mobile

### Phase 7: Advanced Visual Analytics
**Goal**: Add richer market and portfolio visualizations without sacrificing operator clarity.
**Depends on**: Phase 6
**Requirements**: [DASH-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can inspect signal logs, a positions heatmap, and a factor radar in the same workspace.
  2. Visual analytics remain synchronized with the live event stream.
  3. The UI stays legible under frequent updates and animation.
**Plans**: 3 plans

Plans:
- [x] 07-01: Implement animated signal log and timeline affordances
- [x] 07-02: Build positions heatmap and factor radar components
- [x] 07-03: Integrate advanced analytics into the dashboard without layout regressions

### Phase 8: Strategy Factory & Macro Extensions
**Goal**: Extend the platform with optional strategy generation and richer thesis evidence.
**Depends on**: Phase 5
**Requirements**: [AGENT-05, STRAT-01, STRAT-02]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. User can inspect macro/news evidence linked to a trade thesis.
  2. RD-Agent(Q) can be toggled on or off as an optional subsystem.
  3. Generated strategy artifacts land in a reviewable workspace before runtime adoption.
**Plans**: 4 plans

Plans:
- [x] 08-01: Add thesis-evidence schemas and backend/news provenance surfacing
- [x] 08-02: Integrate optional RD-Agent(Q) entrypoint and config switches
- [x] 08-03: Create strategy artifact workspace and review flow
- [x] 08-04: Expose strategy-factory state in the operator dashboard

### Phase 9: Hardening, Tests & Release Docs
**Goal**: Make the project demonstrable, diagnosable, and contributor-ready.
**Depends on**: Phase 8
**Requirements**: [OPS-02, OPS-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Developer can run smoke tests for API, WebSocket, and paper trading.
  2. Health endpoints and structured logs make backend state diagnosable.
  3. Documentation explains startup, testing, risk warnings, and common troubleshooting paths.
**Plans**: 4 plans

Plans:
- [x] 09-01: Add smoke-test coverage for core backend/frontend flows
- [x] 09-02: Implement health, diagnostics, and structured logging surfaces
- [x] 09-03: Write contributor and operator documentation
- [x] 09-04: Validate release readiness for an open-source first publish

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Local Runtime | 4/4 | Complete    | 2026-04-01 |
| 2. Market Data & Event Backbone | 4/4 | Complete    | 2026-04-01 |
| 3. PrimoAgent Core Graph | 4/4 | Complete    | 2026-04-01 |
| 4. Execution Engine & Paper Trading | 4/4 | Complete    | 2026-04-01 |
| 5. Risk Guardrails & Live Gating | 4/4 | Complete    | 2026-04-01 |
| 6. Pro Trading Dashboard Shell | 5/5 | Complete    | 2026-04-01 |
| 7. Advanced Visual Analytics | 3/3 | Complete    | 2026-04-01 |
| 8. Strategy Factory & Macro Extensions | 4/4 | Complete    | 2026-04-01 |
| 9. Hardening, Tests & Release Docs | 4/4 | Complete    | 2026-04-01 |

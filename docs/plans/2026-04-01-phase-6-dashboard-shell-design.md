# Phase 6 Dashboard Shell Design

**Date:** 2026-04-01  
**Phase:** 6 — Pro Trading Dashboard Shell  
**Status:** approved for autonomous execution

## Goal

Deliver a trader-grade operator shell that turns the existing backend runtime into an inspectable, controllable dashboard with live KPI cards, chart surfaces, operator controls, and explicit realtime connection feedback.

## Chosen Approach

Build the Phase 6 shell directly on top of the existing market, analysis, execution, risk, and websocket contracts instead of inventing a new aggregate backend endpoint. The frontend will fetch the current snapshot/status surfaces on load, keep them fresh through websocket-triggered refetches, and render them in a premium cockpit layout using React, Tailwind/CSS, Framer Motion, Lightweight Charts, Tremor primitives, and shadcn-style UI components.

Why this approach:

- keeps the backend contracts explainable and phase-aligned instead of hiding state behind a dashboard-only facade
- proves the dashboard can orchestrate the real paper/risk runtime already built in Phases 3–5
- satisfies WS-02 by making websocket lifecycle state a first-class UI surface with reconnect affordances
- leaves Phase 7 free to deepen analytics rather than rework shell-level state management

## Alternatives Considered

### 1. Recommended: frontend-composed dashboard from existing backend routes

Pros:
- lowest backend churn
- preserves typed service boundaries already verified in prior phases
- easiest to extend with richer panels later

Cons:
- frontend hook needs to orchestrate multiple status surfaces

### 2. Create a backend-only dashboard aggregate endpoint

Pros:
- fewer frontend requests
- server can precompute view models

Cons:
- duplicates state that already exists in market/execution/risk/analysis services
- adds a dashboard-specific backend abstraction too early

### 3. Ship a mostly static shell and defer real controls to later phases

Pros:
- faster visual delivery

Cons:
- fails the product brief because operator controls and live runtime visibility are core requirements now

## Architecture

### Frontend state model

- `useMarketRuntime` evolves into a dashboard runtime hook that owns:
  - initial market/execution/risk/bootstrap fetches
  - selected symbol/timeframe state
  - latest analysis for the active instrument
  - websocket reconnect lifecycle and UI notifications
  - dashboard actions for analysis, dispatch, execution control, halt control, and live-mode requests

### Visual regions

- **Hero / command deck:** product identity, mode surface, connection banner, selected market, and primary runtime facts
- **KPI rail:** positions, gross exposure, unrealized P&L, and computed risk score
- **Chart deck:** Lightweight Charts price surface with signal/order markers plus a derived P&L line for open exposure
- **Operator rail:** pause/resume, run-analysis, dispatch, halt, and live-mode controls in glassmorphism cards
- **Telemetry tape:** recent event stream with readable event summaries and connection diagnostics

### UX rules

- connection drop/reconnect state stays visible, never hidden in a tiny icon
- risky actions remain explicit; live-mode enablement requires typed confirmation in the UI as well as backend confirmation
- fallback/mock conditions remain inspectable through badges and warning text
- mobile collapses into stacked panels without losing the primary control surfaces

## Testing Plan

- frontend build passes with the new dashboard component tree and chart wrappers
- backend tests still pass after frontend-driven API usage assumptions
- websocket disconnect/reconnect state is represented in the hook and visible in the UI
- operator controls call the real execution/risk/analysis endpoints and refresh local state

## Deferred

- heatmap, factor radar, and advanced signal log choreography (Phase 7)
- richer macro evidence panels and strategy-factory surfaces (Phase 8)
- end-to-end browser smoke automation (Phase 9)

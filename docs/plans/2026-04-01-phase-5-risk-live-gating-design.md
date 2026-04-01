# Phase 5 Risk Guardrails and Live Gating Design

**Date:** 2026-04-01  
**Phase:** 5 — Risk Guardrails & Live Gating  
**Status:** approved for autonomous execution

## Goal

Enforce server-side trading guardrails, require risk approval for execution when configured, and keep live mode behind explicit confirmation plus valid credentials.

## Chosen Approach

Add a dedicated `RiskService` that owns mutable risk policy, halt state, realized-loss tracking, and guarded live-mode enablement. Integrate it into the existing `ExecutionService` as a pre-trade approval gate and post-fill risk monitor.

Why this approach:

- keeps policy enforcement centralized instead of scattering checks across routes
- reuses the Phase 4 pause/halt seam for automated kill-switch behavior
- makes risk decisions inspectable through typed status routes and replayable events
- keeps live mode impossible to enable accidentally in mock-safe startup

## Alternatives Considered

### 1. Recommended: dedicated risk service + execution integration

Pros:
- clean API boundary for policy updates and live-mode control
- easy to test with backend-only flows
- sets up future dashboard and audit features

Cons:
- adds another runtime service to wire through app state

### 2. Hardcode checks inside the execution service

Pros:
- fewer files initially

Cons:
- mixes risk logic with order handling
- makes later policy management and UI status harder

### 3. Defer all risk policy until a frontend exists

Pros:
- less backend work now

Cons:
- violates the roadmap and leaves execution behavior under-protected

## Architecture

### Core services

- `RiskService`: owns policy, halt state, live-mode state, and realized P&L guardrails
- `ExecutionService`: asks `RiskService` for pre-trade approval and reports sell fills back for realized-loss tracking
- `EventBus`: carries approval granted/denied, halt, and live-mode audit events

### API surface

- `GET /api/risk/status` — current policy, halt state, realized P&L, live-mode state
- `POST /api/risk/policy` — update risk guardrails
- `POST /api/risk/halt` — manual halt or clear halt
- `POST /api/risk/live-mode` — guarded live-mode enable/disable flow

### Guardrails

- max position notional
- max concurrent trades
- daily realized loss limit
- blocked symbols
- required risk-agent approval with minimum confidence threshold

## Testing Plan

- blocked symbol policy denies dispatch and triggers halt
- fallback/low-confidence risk decision denies execution without placing an order
- realized loss beyond the daily limit auto-halts trading
- live mode only enables with explicit confirmation text and credentials outside mock mode

## Deferred

- persistent policy storage beyond runtime memory
- multi-step human approval UX for live mode
- dashboard risk controls and visual audit history

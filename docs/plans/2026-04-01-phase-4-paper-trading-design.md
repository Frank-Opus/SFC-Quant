# Phase 4 Paper Trading Execution Design

**Date:** 2026-04-01  
**Phase:** 4 — Execution Engine & Paper Trading  
**Status:** approved for autonomous execution

## Goal

Turn Phase 3 risk decisions into inspectable paper orders without risking real funds, while publishing lifecycle events and allowing operator pause/resume control.

## Chosen Approach

Implement a backend-only paper execution loop that uses the existing analysis service as the signal source, routes decisions through a Freqtrade-shaped adapter seam, and persists order/position state in-memory plus the shared event bus.

Why this approach:

- keeps the stack local-first and runnable with no real exchange credentials
- preserves the mandated Freqtrade + ccxt direction through an execution adapter boundary
- reuses the shared JSONL + websocket event path from Phase 2 and 3
- creates the right control seam for later risk guardrails and live gating

## Alternatives Considered

### 1. Recommended: paper execution service with a mock Freqtrade adapter

Pros:
- easy to validate locally
- produces realistic order lifecycle events now
- leaves room for deeper Freqtrade supervision later

Cons:
- in-memory portfolio state is intentionally lightweight for this phase

### 2. Route orders directly to ccxt in dry-run mode

Pros:
- more exchange-flavored immediately

Cons:
- couples execution too early to external market credentials and APIs
- weakens the intended Freqtrade-centered control plane

### 3. Wait for full live-risk policy before adding any execution loop

Pros:
- avoids rework on risk hooks

Cons:
- delays proving the signal-to-order path the roadmap explicitly requires in Phase 4

## Architecture

### Core services

- `ExecutionService`: owns pause/resume state, paper cash/positions, and dispatch flow
- `MockFreqtradeExecutionAdapter`: simulates the Freqtrade paper-order submission seam
- `AnalysisService`: remains the source of typed multi-agent decisions
- `EventBus`: publishes signal approval, order lifecycle, and position updates

### API surface

- `GET /api/execution/status` — current paper runtime, balances, positions, recent orders
- `POST /api/execution/control` — pause or resume execution
- `POST /api/execution/dispatch` — run analysis and, when approved, place a paper order

### Behavior rules

- `buy` recommendations place a paper buy using configured USD notional
- `sell` recommendations close an existing paper position; no naked shorting in this phase
- `hold`, `wait`, or blocked conditions emit skip/block events instead of creating orders

## Testing Plan

- dispatch path creates a filled paper buy order and updates position state
- pause blocks dispatch until resumed
- sell closes an existing paper position
- recent events expose order and position lifecycle entries

## Deferred

- true Freqtrade process supervision and command handoff
- live-order routing
- hard risk policy enforcement and kill-switch logic
- dashboard execution visuals

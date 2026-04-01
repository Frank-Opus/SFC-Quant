# Phase 4: Execution Engine & Paper Trading - Research

**Date:** 2026-04-01
**Status:** Complete
**Confidence:** High

## Objective

Research how to add a realistic paper-trading loop on top of the existing analysis and event backbone without violating the project's safety-first and local-first constraints.

## What Matters For Planning

### 1. Paper mode must be the default truth

The roadmap and project constraints are explicit: execution should become realistic before it becomes dangerous. Phase 4 therefore needs a paper portfolio with balances, fills, and positions, not a hidden no-op.

### 2. The analysis-to-execution seam should stay typed

The Phase 3 outputs already carry a final recommendation and rationale summary. Phase 4 should consume that typed payload directly rather than reparsing agent text.

### 3. Event continuity is a feature, not an implementation detail

Order lifecycle and position updates should land in the same replayable websocket stream as market and agent events. That makes later UI and audit features dramatically easier.

### 4. Pause/resume is the first control-plane primitive

Before adding rich risk controls, the operator needs a manual pause/resume action. Implementing that now also creates the state seam for the kill-switch logic planned in Phase 5.

### 5. A Freqtrade-shaped adapter is enough for this slice

Phase 4 does not need full external Freqtrade process orchestration yet. A narrow adapter boundary that simulates paper order submission is sufficient as long as the system remains honest about what is mocked versus live.

## Recommended Build Order

1. Add execution config and typed execution models
2. Implement the execution service with paper cash/positions/order state
3. Publish signal/order/position events through the shared event bus
4. Expose status, control, and dispatch APIs
5. Add tests for buy, sell, and pause/resume flows

## Key Risks

- Coupling execution too tightly to provider availability instead of the typed recommendation output
- Allowing sell signals to create impossible short positions in a paper-spot workflow
- Skipping lifecycle events and losing observability for later UI phases

## Recommendation

Ship a strict paper-only execution loop with explicit order lifecycle events and operator controls. This satisfies the roadmap while keeping the system safe and ready for Phase 5 risk enforcement.

## RESEARCH COMPLETE

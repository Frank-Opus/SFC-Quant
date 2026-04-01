# Phase 7 Visual Analytics Design

**Date:** 2026-04-01  
**Phase:** 7 — Advanced Visual Analytics  
**Status:** approved for autonomous execution

## Goal

Extend the Phase 6 operator cockpit with richer analytical readouts: a curated signal log, a positions heatmap, and a factor radar that makes the current thesis geometry legible at a glance.

## Chosen Approach

Implement the Phase 7 analytics layer entirely on top of the existing Phase 6 realtime state. The frontend already has market snapshots, event tape, positions, risk posture, and latest analysis outputs. Instead of waiting for new backend endpoints, Phase 7 composes those inputs into new visual models that remain synchronized with the existing websocket-driven dashboard runtime.

Why this approach:

- keeps the analytics layer consistent with the local-first, inspectable control plane
- avoids inventing dashboard-only backend abstractions for purely presentational composites
- satisfies DASH-03 now while preserving future room for richer backend evidence in Phase 8
- keeps motion and density under control because all panels share the same selected-instrument context

## Alternatives Considered

### 1. Recommended: frontend-composed analytics from existing runtime state

Pros:
- no backend churn
- quickest path to synchronized visuals
- easiest to evolve once richer thesis evidence arrives

Cons:
- some scoring logic is intentionally heuristic in the UI layer

### 2. Add backend endpoints for analytics-only view models

Pros:
- cleaner separation for long-term reporting logic

Cons:
- unnecessary duplication for current v1 state
- slows roadmap progress without unlocking new runtime behavior

### 3. Defer advanced analytics until Phase 8

Pros:
- waits for richer macro evidence

Cons:
- leaves the dashboard shell visually incomplete versus the roadmap promise

## Architecture

### Panels

- **Signal log:** curated event timeline focused on agent, execution, and risk moments with deliberate motion and event-tone color coding
- **Positions heatmap:** compact field of tracked instruments showing active-position P&L and passive market pressure in one grid
- **Factor radar:** lightweight SVG radar that blends trend, momentum, macro confidence, execution readiness, and risk buffer

### Data mapping

- signal log reads from the live event feed already stored by `useMarketRuntime`
- heatmap composes `snapshot.snapshots` plus current paper positions
- factor radar derives its axes from selected market state, per-role PrimoAgent confidence, and current risk/execution posture

### UX rules

- the new panels must not obscure operator clarity or push runtime controls out of view
- color intensity should encode state, not decoration for its own sake
- animations should be short and meaningful, never make frequent updates feel noisy

## Testing Plan

- frontend build passes with the new analytics components
- backend tests remain green because analytics remain frontend-only
- dashboard layout still behaves cleanly on desktop and mobile after the extra panels land

## Deferred

- richer factor definitions from deeper macro/news evidence
- replay/backtest-oriented historical analytics
- operator-customizable analytics workspaces

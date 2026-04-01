# Phase 5: Risk Guardrails & Live Gating - Research

**Date:** 2026-04-01
**Status:** Complete
**Confidence:** High

## Objective

Research how to add enforceable guardrails and live-mode gating without breaking the paper-only execution loop or the local-first runtime.

## What Matters For Planning

### 1. Risk policy must be server-side

Frontend controls will come later, but the backend has to be the final authority for blocked symbols, sizing, concurrency, and loss limits.

### 2. Risk approval should consume typed agent outputs, not strings

Phase 3 already made the risk role explicit. Phase 5 should consume that typed output directly instead of inventing another approval channel.

### 3. Auto-halt should reuse the execution pause seam

Phase 4 already introduced manual pause/resume. Phase 5 should build the kill-switch behavior on top of that seam instead of adding a second execution-disable mechanism.

### 4. Live-mode enablement must be intentionally annoying

Real-money routing should require both credentials and explicit confirmation text. If the app is still in mock mode, live mode must stay impossible.

## Recommended Build Order

1. Add typed risk models and config fields
2. Implement `RiskService` for policy, halt, and live-mode state
3. Integrate risk evaluation into `ExecutionService`
4. Add policy/halt/live-mode routes and automated tests
5. Update docs and phase verification artifacts

## Key Risks

- mixing policy denials with engine-halt logic in a way that is hard to reason about
- allowing fallback or low-confidence risk outputs to place trades when approval is required
- letting live mode drift out of sync with the real backend credential state

## Recommendation

Ship a dedicated backend risk layer now. It keeps paper execution safe today and provides the mandatory foundation for any later live routing.

## RESEARCH COMPLETE

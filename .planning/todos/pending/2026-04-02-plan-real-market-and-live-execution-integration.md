---
created: 2026-04-02T11:20:00.000Z
title: Plan real market and live execution integration
area: planning
files:
  - backend/app/core/config.py
  - backend/app/services/market.py
  - backend/app/services/execution.py
  - docker-compose.yml
  - .env
  - README.md
  - docs/runbooks/operator-runbook.md
---

## Problem

The current local runtime is healthy enough for development and UI demonstration, but it is still running in a mock-safe path instead of a production-honest operator path. The backend currently reports `app_mode=mock`, `market_data.mode=mock`, and `execution_adapter=freqtrade_mock`, which means the system is not yet using real ccxt market reads or a true Freqtrade-backed execution path.

This creates a gap between the current polished dashboard experience and the user's real goal: a release-ready SFC-Quant deployment that can connect to real market data, preserve paper-first safety, and later enable explicitly gated live trading. Without capturing this work as a dedicated todo, the project risks continuing to improve UX while leaving the most important production path undefined: configuration alignment, real exchange connectivity, execution adapter replacement, and live-readiness validation.

## Solution

Create a dedicated live-readiness plan that closes the gap from mock/dev to a truthful production-style runtime in stages:

1. Unify configuration across `.env`, backend defaults, compose, and runbooks so the requested runtime is explicit and reproducible.
2. Re-enable and verify real market data through the existing ccxt seam, with clear diagnostics for requested source, effective source, and degraded/fallback behavior.
3. Replace or extend the current `freqtrade_mock` execution adapter with a true Freqtrade-backed paper execution path before any live-trading enablement.
4. Define the exact external prerequisites for live trading: supported exchange, API key scope, account mode, network reachability, secrets handling, and rollback rules.
5. Add an operator-facing runbook and validation checklist so real-market and future live-mode demos can be executed safely and repeatably.

This todo should be treated as a new planning/implementation track rather than a continuation of the earlier v1.2 bilingual + real-market hardening item, because the remaining work is now specifically about production-style runtime truth, execution integration, and release operations.

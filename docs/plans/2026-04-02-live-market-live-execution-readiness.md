# Live Market + Live Execution Readiness Plan

## Purpose

This document closes the gap between the current local `SFC-Quant` runtime and a production-honest operator path that can:

1. read real market data through ccxt,
2. preserve paper-first execution,
3. replace the current mock execution seam with a true Freqtrade-backed path, and
4. define the prerequisites for explicitly gated live trading.

## Current Runtime Evidence

Current observed backend state from `/health` and `/api/diagnostics/summary`:

- `app_env=development`
- `app_mode=mock`
- `runtime_mode=mock-safe`
- `market_data.mode=mock`
- `market_data.requested_source=mock`
- `market_data.effective_source=mock`
- `execution_mode=paper`
- `execution_adapter=freqtrade_mock`
- `live_trading_enabled=false`
- `strategy.effective_provider=mock_rdq`

Current code-level evidence:

- `backend/app/core/config.py`
  - default `app_mode="mock"`
  - default `market_data_mode="mock"`
  - default `execution_adapter="freqtrade_mock"`
- `backend/app/services/market.py`
  - supports both `MockMarketDataAdapter` and `CcxtMarketDataAdapter`
- `backend/app/services/execution.py`
  - currently wires `MockFreqtradeExecutionAdapter` as the active execution adapter
- `.env.example`
  - requests `MARKET_DATA_MODE=real`
- current local `.env`
  - does not set `MARKET_DATA_MODE`, so runtime falls back to backend default `mock`

## Why This Matters

The dashboard now looks release-grade, but the runtime is still a safe development/demo path. That is acceptable for UI and workflow validation, but it is not yet a trustworthy representation of:

- real exchange connectivity,
- truthful real-market failure modes,
- Freqtrade-backed paper execution, or
- operator procedures for later live enablement.

Without closing these gaps, the project risks looking production-ready while the underlying runtime remains mock-safe.

## Gap Summary

### 1. Configuration Drift

Current problem:

- backend defaults, `.env.example`, docker-compose defaults, and the live local `.env` are not aligned.
- the docs describe a real-market default profile, but the current local runtime is mock because local `.env` does not explicitly opt into real-market mode.

Required outcome:

- one explicit, reproducible configuration matrix for:
  - mock development,
  - real-market + paper execution,
  - future live-enabled mode.

### 2. Real Market Data Path Not Verified in Current Runtime

Current problem:

- the code has a ccxt market adapter, but the current local run is not exercising it.
- exchange credentials are absent, and real-market behavior has not been re-validated in the currently running environment.

Required outcome:

- `MARKET_DATA_MODE=real`
- `/health` and `/api/diagnostics/summary` report:
  - `requested_source=ccxt`
  - `effective_source=ccxt` when successful
  - `effective_source=unavailable` or degraded/fallback truthfully when not successful

### 3. Execution Path Is Still Mocked

Current problem:

- `ExecutionService` instantiates `MockFreqtradeExecutionAdapter` directly.
- this simulates fills, but does not validate a real Freqtrade-backed paper execution loop.

Required outcome:

- introduce a non-mock execution adapter path that speaks to Freqtrade in paper mode first.
- preserve explicit live gating and do not allow silent escalation from paper to live.

### 4. Deployment Path Is Not Yet Release-Honest

Current problem:

- the current session had to bypass Docker because the local Docker daemon was unavailable.
- frontend is currently running via `vite dev`, not a production build service.

Required outcome:

- Docker Compose becomes the standard validated path again.
- frontend production build and backend service startup are both part of the normal operator startup path.

### 5. Live Trading Preconditions Are Not Yet Captured as an Operator Contract

Current problem:

- the repo already protects live mode, but there is no single operator-facing checklist that says exactly what is needed before live enablement is even allowed.

Required outcome:

- a concrete live-trading readiness checklist covering credentials, account mode, exchange support, risk policy, rollback, and validation evidence.

## Phased Implementation Plan

### Phase A — Configuration Unification

Goal:
- eliminate drift between backend defaults, `.env.example`, `.env`, docs, and Compose.

Tasks:
- document three profiles clearly:
  - `dev-mock`
  - `real-market-paper`
  - `live-gated`
- ensure startup instructions always state which profile is active.
- add a verification step that compares runtime health output against expected profile.

Success criteria:
- operator can explain the active profile from `.env` alone.
- `/health` matches the intended profile.

### Phase B — Real Market Validation

Goal:
- make real market reads the default non-mock path for serious operator use.

Tasks:
- set `MARKET_DATA_MODE=real` in the intended runtime profile.
- validate ccxt reads against the chosen exchange.
- verify degraded behavior when exchange/network is unavailable.
- keep UI truth explicit for requested/effective source.

Success criteria:
- dashboard and diagnostics both show `ccxt` when real reads succeed.
- failure does not masquerade as healthy live data.

### Phase C — Replace Mock Execution Seam

Goal:
- move from `freqtrade_mock` to a real Freqtrade-backed paper execution adapter.

Tasks:
- define adapter interface for a true Freqtrade paper path.
- wire execution status, order lifecycle, and positions to the real adapter.
- keep paper mode as the default.
- verify pause/resume/halt/live-gate behavior still works with the real adapter.

Success criteria:
- paper orders are routed through a true execution backend instead of synthetic fills.
- diagnostics and event logs reflect the real paper execution path.

### Phase D — Deployment Hardening

Goal:
- restore a stable, reproducible local production-style startup path.

Tasks:
- ensure Docker daemon + Compose startup are healthy on the target machine.
- validate backend, frontend, and dependent paths under Compose.
- prefer built frontend serving for release/demo acceptance.

Success criteria:
- `docker compose up --build` is the default stable path again.
- operator no longer depends on ad hoc manual `uvicorn` + `vite dev` startup.

### Phase E — Live Enablement Contract

Goal:
- define the exact gate for future live trading enablement.

Tasks:
- write a live-trading operator checklist.
- require explicit credentials, permissions, risk thresholds, and confirmation workflow.
- define revoke/rollback procedures.

Success criteria:
- live mode cannot be enabled without satisfying the checklist.
- rollback can be executed quickly and safely.

## What Is Needed For Real Live Integration

### External Preconditions

The user must decide or provide:

- target exchange: e.g. Binance / OKX / Bybit
- market type: spot or futures
- environment: testnet first or production account first
- execution scope: real market data only, paper execution, or fully gated live execution
- allowed symbols/timeframes
- deployment target: local workstation only or always-on machine/VPS

### Exchange Credentials and Permissions

For live or paper routing through real exchange infrastructure, the system needs:

- exchange API key
- exchange API secret
- passphrase if the exchange requires one
- API permissions limited to:
  - read
  - trade
- explicitly **no withdrawal permission**
- IP whitelist if the exchange supports or requires it
- account/subaccount selection if applicable

### Freqtrade-Side Requirements

A true Freqtrade-backed execution path will need:

- a concrete Freqtrade runtime integration strategy
- exchange configuration for the chosen market type
- pairlist / symbol allowlist
- paper/dry-run config validated before any live mode
- order sizing, fee assumptions, and slippage handling
- persistence/logging for order history and positions

### Risk and Governance Inputs

Before any live enablement, the operator must decide:

- max order notional
- max concurrent trades
- daily loss limit
- blocked symbols
- whether agent approval is mandatory
- minimum approval confidence
- who is allowed to toggle live mode
- what the emergency halt procedure is

### Infrastructure Requirements

For a release-grade path, the target machine should have:

- working Docker / Docker Compose
- stable network reachability to the exchange and provider endpoints
- secret storage outside committed files
- log retention for diagnostics and event replay
- a restart strategy for backend/frontend services

## User Inputs Required Before Full Implementation

The following user answers are still needed to finish true real-market/live integration:

1. Which exchange should be the first supported real execution target?
2. Is the first target `spot` or `futures`?
3. Do you want the next milestone to stop at `real market + real paper execution`, or continue to `explicitly gated live trading`?
4. Will you provide testnet credentials first, or production credentials first?
5. Should deployment target remain local workstation only, or do you want a long-running server/VPS path as well?

## Risks

- exchange/network failures can produce degraded or unavailable real-market state
- incomplete credential scoping could create avoidable operational risk
- moving too early from mock execution to live trading increases blast radius
- doc/config drift can make the UI look more ready than the runtime actually is
- Docker path instability on the target machine can break “one-command startup” expectations

## Rollback Strategy

If any real-market or execution rollout fails:

- set runtime back to mock profile
- keep `EXECUTION_MODE=paper`
- keep `LIVE_TRADING_ENABLED=false`
- disable nonessential strategy generation if it complicates diagnosis
- revoke or rotate exchange keys if there is any credential concern
- re-verify `/health`, `/health/ready`, and `/api/diagnostics/summary`

## Recommended Next Step

Implement the next milestone in this order:

1. configuration unification,
2. real market validation,
3. Freqtrade-backed paper execution,
4. live enablement checklist,
5. optional live rollout.

This preserves paper-first safety while moving the system toward a truthful production-grade operator path.

# Live Trading Readiness Runbook

## Purpose

Use this runbook before promoting `SFC-Quant` from mock-safe development mode to:

1. real market data + paper execution, or
2. explicitly gated live trading.

This runbook does **not** assume live trading should be enabled immediately. The safe target sequence is:

- mock development
- real market + paper execution
- explicitly gated live trading

## Current Non-Live Baseline

Confirm the system is not yet in live mode:

- `GET /health`
- `GET /health/ready`
- `GET /api/diagnostics/summary`

Expected safe-state checks:

- `execution_mode=paper`
- `live_trading_enabled=false`
- requested/effective market source are explicit
- execution adapter is clearly reported

## Required Decisions Before Real Integration

Decide the following first:

- exchange name
- spot vs futures
- testnet vs production account
- whether this rollout stops at real market + paper execution first
- deployment target: workstation only vs server/VPS

## Required Credentials

Prepare the minimum required credentials:

- exchange API key
- exchange API secret
- exchange passphrase if required

Credential policy:

- enable read + trade only
- never enable withdrawal permissions
- use IP allowlisting when possible
- keep secrets in local env/secret storage only

## Required Risk Settings

Confirm or set:

- max position notional
- max concurrent trades
- daily loss limit
- blocked symbols
- whether agent approval is mandatory
- minimum approval confidence

## Promotion Path

### Stage 1 — Real Market + Paper Execution

Required outcome:

- market source uses real ccxt reads
- execution stays paper
- diagnostics remain truthful when real market reads fail

Checks:

- `/health` shows `requested_source=ccxt`
- `/api/diagnostics/summary` shows real market status truthfully
- dashboard labels requested/effective source correctly
- pause/resume/halt still work

### Stage 2 — True Execution Backend In Paper Mode

Required outcome:

- execution no longer relies on `freqtrade_mock`
- orders flow through a real execution backend in paper/dry-run mode first

Checks:

- adapter reported in health/diagnostics is not the mock adapter
- recent orders and positions are driven by the real paper backend
- event log captures order lifecycle truthfully

### Stage 3 — Explicitly Gated Live Trading

Only consider this after Stages 1 and 2 are stable.

Required outcome:

- live mode remains behind explicit operator confirmation
- revoke/rollback path is tested
- operator can halt immediately without ambiguity

Checks:

- live enablement requires explicit confirmation
- emergency halt path is documented and tested
- API key scope is re-reviewed before first live order

## Rollback Procedure

If any rollout step fails:

1. switch back to mock or safe paper profile
2. keep live mode disabled
3. halt execution if behavior is unclear
4. revoke or rotate exchange keys if credential exposure is suspected
5. inspect `/health`, `/health/ready`, and `/api/diagnostics/summary`
6. review `var/events/market-events.jsonl` and backend logs

## Operator Inputs Still Needed

Before full live implementation, the operator must provide:

- target exchange
- spot or futures
- testnet-first or production-first preference
- desired first milestone:
  - real market only
  - real market + real paper execution
  - full live-gated rollout

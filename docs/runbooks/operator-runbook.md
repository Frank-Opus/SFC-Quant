# Operator Runbook

## Purpose

Use this guide to boot, verify, and safely demo `SFC-Quant` locally.

## 1. Start the stack

```bash
cp .env.example .env
docker compose up --build
```

## 2. Verify health surfaces

Open or curl:

- `http://localhost:8000/health`
- `http://localhost:8000/health/live`
- `http://localhost:8000/health/ready`
- `http://localhost:8000/api/diagnostics/summary`

Expected:

- health returns backend runtime metadata
- live returns `status=ok`
- ready returns non-empty checks
- diagnostics returns runtime, market-data truth, event counts, execution, risk, and strategy sections
- health/diagnostics show whether market data is `mock`, `ccxt`, or fallback/degraded

## 3. Run smoke checks

```bash
python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py
```

Optional market-data truth smoke check:

```bash
python3 -m pytest -q backend/tests/test_market_runtime.py
```

## 4. Inspect the dashboard

Open `http://localhost:5173` and confirm:

- language buttons switch between English and Chinese and persist locally
- market deck loads tracked feeds
- hero/diagnostics surfaces show requested vs effective market source truthfully
- thesis panel populates after analysis
- macro evidence panel shows linked sources
- strategy factory can be enabled and can generate review artifacts
- operator deck can pause/resume, halt/clear, and request live mode

## 5. Inspect structured logs

Watch backend stdout while triggering actions. You should see JSON log lines for startup, shutdown, and event publication.

## 6. Safe demo path

Recommended demo order:

1. health + diagnostics
2. switch dashboard language once and refresh to confirm persistence
3. run analysis
4. inspect thesis and macro evidence
5. dispatch a paper trade
6. inspect risk status and diagnostics summary
7. enable strategy factory and generate a review artifact

Optional real-market demo:

1. use the default release profile or set `MARKET_DATA_MODE=real`
2. restart `docker compose up --build`
3. verify `/health` or `/api/diagnostics/summary` reports requested source `ccxt`
4. if exchange reads fail, confirm the runtime reports fallback/degraded state instead of pretending live data is active

## 7. Safety reminders

- stay in `APP_MODE=mock` unless you intentionally need paper-ready/live-ready behavior
- the default release profile already requests real market data; use `MARKET_DATA_MODE=mock` only when you intentionally want a deterministic local-only demo
- do not enable live mode without explicit credentials and confirmation text
- treat strategy artifacts as review material, not auto-trading logic

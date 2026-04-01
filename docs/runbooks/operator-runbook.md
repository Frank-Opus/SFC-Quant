# Operator Runbook

## Purpose

Use this guide to boot, verify, and safely demo `dSFC-Quant` locally.

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
- diagnostics returns runtime, event counts, execution, risk, and strategy sections

## 3. Run smoke checks

```bash
python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py
```

## 4. Inspect the dashboard

Open `http://localhost:5173` and confirm:

- market deck loads tracked feeds
- thesis panel populates after analysis
- macro evidence panel shows linked sources
- strategy factory can be enabled and can generate review artifacts
- operator deck can pause/resume, halt/clear, and request live mode

## 5. Inspect structured logs

Watch backend stdout while triggering actions. You should see JSON log lines for startup, shutdown, and event publication.

## 6. Safe demo path

Recommended demo order:

1. health + diagnostics
2. run analysis
3. inspect thesis and macro evidence
4. dispatch a paper trade
5. inspect risk status and diagnostics summary
6. enable strategy factory and generate a review artifact

## 7. Safety reminders

- stay in `APP_MODE=mock` unless you intentionally need paper-ready/live-ready behavior
- do not enable live mode without explicit credentials and confirmation text
- treat strategy artifacts as review material, not auto-trading logic

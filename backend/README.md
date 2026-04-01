# dSFC-Quant Backend

FastAPI control plane for the local-first dSFC-Quant workstation.

## Responsibilities

- resolve safe runtime mode from environment
- normalize market state and publish replayable events
- run typed multi-role analysis flows
- route paper-trade execution and risk controls
- expose optional strategy-factory review APIs
- provide health, readiness, diagnostics, and structured logs

## Local Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e backend[dev]
```

To test the real RD-Agent(Q) strategy path on Linux, install the optional extra:

```bash
python -m pip install -e backend[dev,rdagent]
```

The default `rdagent fin_quant` flow also expects Docker daemon access. When you
run the backend in Compose, prefer the optional override:

```bash
docker compose -f docker-compose.yml -f docker-compose.rdagent.yml up --build
```

## Run the Backend

```bash
uvicorn app.main:app --app-dir backend --reload
```

Default local URL: `http://localhost:8000`

## Operations Endpoints

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /api/diagnostics/summary`
- `GET /api/events/recent`
- `GET /api/market/snapshot`
- `GET /ws`

## Smoke and Test Commands

```bash
python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py
python3 -m pytest -q backend/tests
```

## Structured Logging

The backend emits JSON logs to stdout. Event publication, startup, and shutdown entries are intended to be machine-readable while remaining easy to inspect locally.

## Safety Boundaries

- mock-safe mode is the default
- paper trading is the default execution path
- live mode requires explicit confirmation and credentials
- strategy generation produces review artifacts only
- when `STRATEGY_FACTORY_PROVIDER=rd_agent_q`, the backend runs `STRATEGY_FACTORY_RD_AGENT_COMMAND` and stores invocation logs in the artifact directory
- if the RD-Agent command or Docker daemon is unavailable, the backend reports the fallback reason and stays on deterministic local artifacts

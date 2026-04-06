# SFC-Quant Backend

FastAPI control plane for the local-first SFC-Quant workstation.

Repository/runtime identifier: `dSFC-Quant`

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

To sync the repo-owned strategy providers into the canonical vendored path and
install them into the active Python environment, run:

```bash
PYTHON_BIN=./.venv/bin/python ./backend/scripts/install_strategy_providers.sh
```

This script clones or updates:

- `backend/vendor/strategy_providers/rdagent`
- `backend/vendor/strategy_providers/tradingagents_cn`

The runtime resolves providers in this order:

1. `backend/vendor/strategy_providers/...`
2. `RDAGENT_REPO` / `TRADINGAGENTS_REPO`
3. deterministic mock fallback with an explicit reason

If you need a custom shared vendor root, set:

```bash
export DSFC_STRATEGY_PROVIDER_VENDOR_ROOT=/absolute/path/to/strategy_providers
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

The default release profile keeps `APP_MODE=mock` and `EXECUTION_MODE=paper`
while setting `MARKET_DATA_MODE=real`. The backend requests real market reads
through the existing ccxt seam and reports requested/effective source truthfully.
If the exchange read fails, the backend degrades honestly and does not substitute
mock snapshots as if they were live market data.

To switch from the local mock paper adapter to a real Freqtrade-backed paper
execution path, keep `EXECUTION_MODE=paper` and set:

```bash
EXECUTION_ADAPTER=freqtrade_rest_paper
EXECUTION_FREQTRADE_REST_BASE_URL=http://127.0.0.1:8080
EXECUTION_FREQTRADE_REST_USERNAME=your-user
EXECUTION_FREQTRADE_REST_PASSWORD=your-pass
```

Freqtrade itself must also be started in a paper-safe profile. At minimum, its
configuration needs:

- `dry_run=true`
- `api_server.enabled=true`
- `force_entry_enable=true`
- a reachable REST host/port that matches `EXECUTION_FREQTRADE_REST_BASE_URL`

Most RD-Agent(Q) scenarios rely on Docker running locally. Ensure your daemon is up by executing `docker run hello-world` before invoking `rdagent` on Linux hosts. When Docker or `rdagent` is unavailable, the backend logs that providers fall back to the deterministic mock and keeps `STRATEGY_FACTORY_PROVIDER` set to `mock_rdq`.

For local wrapper-based validation from this repo, prefer:

```bash
./.venv/bin/python backend/scripts/run_rdagent.py --help
./.venv/bin/python backend/scripts/run_rdagent.py fin_quant --help
```

TradingAgents-CN currently ships a broken upstream console entrypoint (`tradingagents -> main:main`). For local validation in this repo, use the wrapper script that jumps into the real `cli.main:main` entrypoint instead:

```bash
./.venv/bin/python backend/scripts/run_tradingagents.py help
```

If you wire TradingAgents-CN into `STRATEGY_FACTORY_TRADINGAGENTS_COMMAND`, keep the runtime truthful:

- stock-like inputs can route into the upstream `run_stock_analysis(...)` bridge
- unsupported symbols such as `BTC/USDT` generate `tradingagents-validation.md` instead of pretending full research ran
- every provider-backed run writes input, stdout, stderr, and run metadata into the strategy artifact directory

Inspect `backend/app/services/strategy_factory.py` for the provider truth table and invocation artifact capture.

The backend verifies the Freqtrade REST endpoint at startup, checks that
`dry_run=true`, and exposes the adapter runtime status through
`GET /api/execution/status` and `GET /api/diagnostics/summary`. If the REST
endpoint is offline or not in dry-run mode, the backend blocks the order
honestly instead of pretending the paper order was filled.

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

- the default release profile keeps execution paper-first while requesting real market data
- paper trading is the default execution path
- live mode requires explicit confirmation and credentials
- strategy generation produces review artifacts only
- when `STRATEGY_FACTORY_PROVIDER=rd_agent_q`, the backend runs `STRATEGY_FACTORY_RD_AGENT_COMMAND` and stores invocation logs in the artifact directory
- when `STRATEGY_FACTORY_PROVIDER=tradingagents_cn`, the backend runs `STRATEGY_FACTORY_TRADINGAGENTS_COMMAND` and stores invocation logs in the artifact directory
- if a repo-owned wrapper is configured but the vendored source is missing, the backend reports that exact fallback reason
- if the RD-Agent command or Docker daemon is unavailable, the backend reports the fallback reason and stays on deterministic local artifacts

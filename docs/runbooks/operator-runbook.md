# Operator Runbook

## Purpose

Use this guide to boot, verify, and safely demo `SFC-Quant` locally.

## 1. Start the stack

```bash
cp .env.example .env
docker compose up --build
```

If you want the backend container to install the vendored strategy providers at
build time, enable:

```bash
export INSTALL_STRATEGY_PROVIDERS=1
docker compose up --build
```

For host-side setup, the repeatable sync command is:

```bash
PYTHON_BIN=./.venv/bin/python ./backend/scripts/install_strategy_providers.sh
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

## 4. Validate `freqtrade_rest_paper` dry-run execution

1. Install or run a local Freqtrade instance with a paper-safe profile:

   ```bash
   python -m pip install freqtrade
   freqtrade trade \
     --strategy SampleStrategy \
     --db-url sqlite:///var/freqtrade/db.sqlite \
     --dry-run \
     --api-server \
     --api-server-port 8080 \
     --api-host 0.0.0.0 \
     --logfile var/logs/freqtrade.log
   ```

   The config must have `dry_run=true`, `api_server.enabled=true`, and `force_entry_enable=true`, and the host/port must match `EXECUTION_FREQTRADE_REST_BASE_URL`. Use `docker run hello-world` first if you prefer containerizing Freqtrade.

2. Point the backend at that REST endpoint (`EXECUTION_ADAPTER=freqtrade_rest_paper`, plus base URL/credentials) and restart `docker compose` or `uvicorn`.

3. Confirm the integration:

   - `curl http://127.0.0.1:8080/api/v1/ping` returns `{"status":"ok"}` and `{"dry_run":true}` via the Freqtrade API.
   - `curl http://localhost:8000/api/execution/status` reports `adapter=freqtrade_rest_paper`, `execution_mode=paper`, and no `rate_limit` stalls.
   - `curl http://localhost:8000/api/diagnostics/summary` continues to expose the execution section showing the REST host and paper orders.
   - The backend blocks orders when the REST host is unreachable rather than pretending a fill; the logs explain the failure.

## 5. Verify multi-agent strategy providers (RD-Agent(Q) & TradingAgents-CN)

1. RD-Agent(Q) (Linux + Docker):

   - Preferred local path: run `PYTHON_BIN=./.venv/bin/python ./backend/scripts/install_strategy_providers.sh`.
   - The canonical vendored source directory is `backend/vendor/strategy_providers/rdagent`.
   - If you keep the source elsewhere, set `RDAGENT_REPO=/absolute/path/to/RD-Agent` or `DSFC_STRATEGY_PROVIDER_VENDOR_ROOT=/absolute/path/to/strategy_providers`.
   - Confirm Docker is available via `docker run hello-world`.
   - Validate the repo-owned shim locally:

     ```bash
     ./.venv/bin/python backend/scripts/run_rdagent.py --help
     ```

   - Enable the provider (`STRATEGY_FACTORY_ENABLED=true`, `STRATEGY_FACTORY_PROVIDER=rd_agent_q`) and let `/api/strategy/generate` or the auto-loop start.
   - Check `GET /api/strategy/status` for `provider=rd_agent_q` with `availability=ready`. When Docker, imports, or the repo path fail, the backend reports the fallback reason instead of crashing.

2. TradingAgents-CN (Python CLI):

   - Preferred local path: run `PYTHON_BIN=./.venv/bin/python ./backend/scripts/install_strategy_providers.sh`.
   - The canonical vendored source directory is `backend/vendor/strategy_providers/tradingagents_cn`.
   - If you keep the source elsewhere, set `TRADINGAGENTS_REPO=/absolute/path/to/TradingAgents-CN` or `DSFC_STRATEGY_PROVIDER_VENDOR_ROOT=/absolute/path/to/strategy_providers`.
   - The upstream `tradingagents` console script is currently mispackaged. Validate the callable entrypoint through the repo shim instead:

     ```bash
     ./.venv/bin/python backend/scripts/run_tradingagents.py help
     ```

   - Switch to `STRATEGY_FACTORY_PROVIDER=tradingagents_cn` and keep `STRATEGY_FACTORY_TRADINGAGENTS_COMMAND` on the repo-owned wrapper unless you explicitly override it.
   - `/api/strategy/status` should list `provider=tradingagents_cn` and log artifact files under `./var/strategy_factory/...` when successful.
   - For unsupported symbols like `BTC/USDT`, the wrapper writes `tradingagents-validation.md` and exits truthfully instead of faking a full report.
   - Any missing CLI or exceptions are surfaced in the provider `reason` field to keep the system honest.

3. Inspect provider artifacts after a run:

   - `rdagent.input.json` / `tradingagents.input.json`
   - `*.stdout.log`
   - `*.stderr.log`
   - `*.run.json`
   - provider-generated markdown/json files

## 6. Inspect the dashboard

Open `http://localhost:5173` and confirm:

- language buttons switch between English and Chinese and persist locally
- market deck loads tracked feeds
- hero/diagnostics surfaces show requested vs effective market source truthfully
- thesis panel populates after analysis
- macro evidence panel shows linked sources
- strategy factory can be enabled and can generate review artifacts
- operator deck can pause/resume, halt/clear, and request live mode

## 7. Inspect structured logs

Watch backend stdout while triggering actions. You should see JSON log lines for startup, shutdown, and event publication.

## 8. Safe demo path

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

## 9. Safety reminders

- stay in `APP_MODE=mock` unless you intentionally need paper-ready/live-ready behavior
- the default release profile already requests real market data; use `MARKET_DATA_MODE=mock` only when you intentionally want a deterministic local-only demo
- do not enable live mode without explicit credentials and confirmation text
- treat strategy artifacts as review material, not auto-trading logic

## 10. Real-market / live-readiness planning

Before attempting true exchange-backed operation, read `docs/runbooks/live-trading-readiness.md`.

Use that runbook to answer three questions first:

1. Which exchange is the target?
2. Is the next step real market + paper execution, or fully gated live trading?
3. Are the required credentials and risk limits available?

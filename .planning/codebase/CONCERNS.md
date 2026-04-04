# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Runtime policy and API serialization live in one helper:**
- Issue: `backend/app/core/runtime.py` combines credential detection, live-mode policy, warning creation, and the transport shape consumed by both `backend/app/main.py` and `backend/app/api/routes/health.py`.
- Files: `backend/app/core/runtime.py`, `backend/app/main.py`, `backend/app/api/routes/health.py`, `backend/app/core/config.py`
- Impact: market-data, agent, execution, and risk work all extend one function and two thin endpoints, which couples unrelated concerns and raises regression risk around the `/health` contract.
- Fix approach: split settings normalization, runtime-policy evaluation, and API response models into separate modules before adding websocket and execution state.

**Frontend and backend share the runtime contract by manual duplication:**
- Issue: the runtime snapshot is declared separately in Python and TypeScript with no shared schema generation and no compatibility test.
- Files: `backend/app/core/runtime.py`, `backend/app/api/routes/health.py`, `frontend/src/lib/runtime.ts`, `frontend/src/App.tsx`
- Impact: field additions or renames can silently break the frontend fallback/loading path once the backend starts exposing richer market, agent, and risk state.
- Fix approach: generate the frontend type from a shared schema or add contract tests that validate the backend payload against the frontend expectations.

**The Phase 1 frontend shell keeps data loading and presentation in one surface:**
- Issue: `frontend/src/App.tsx` owns the runtime fetch lifecycle, fallback rendering, and all visible UI, while `frontend/src/lib/runtime.ts` contains the only client-side integration logic.
- Files: `frontend/src/App.tsx`, `frontend/src/lib/runtime.ts`, `frontend/src/main.tsx`, `frontend/src/styles.css`
- Impact: dashboard work has no stable boundary for charts, controls, or websocket-driven state, so Phase 6-7 changes are likely to expand a monolithic component instead of a composable UI system.
- Fix approach: introduce feature components and a dedicated state layer before adding realtime charts, operator controls, or analytics panels.

## Known Bugs

**Frontend health fetch ignores the configured Vite API base URL:**
- Symptoms: the browser always requests `http://<window.location.hostname>:8000/health` instead of reading `VITE_API_BASE_URL`.
- Files: `frontend/src/lib/runtime.ts`, `docker-compose.yml`, `README.md`
- Trigger: any environment where the backend is not reachable on browser host port `8000`, including custom ports, reverse proxies, remote Docker hosts, or preview deployments.
- Workaround: keep the backend exposed on host port `8000`, or patch `resolveBackendBaseUrl()` locally to read `import.meta.env.VITE_API_BASE_URL`.

**Only the first runtime warning reaches the UI:**
- Symptoms: the backend can emit multiple warnings, but the frontend renders only `runtime.warnings[0]`.
- Files: `backend/app/core/runtime.py`, `frontend/src/App.tsx`
- Trigger: configurations that combine multiple warnings, such as a live-trading request in mock mode together with a non-mock AI provider that has no API key.
- Workaround: inspect `GET /health` directly instead of relying on the frontend shell for the full warning set.

**Workspace-local toolchain entrypoints are not executable:**
- Symptoms: `cd frontend && npm run build` fails with `Permission denied` from `frontend/node_modules/.bin/tsc`, and local virtualenv entrypoints in `.venv/bin/` also lack execute bits.
- Files: `frontend/node_modules/.bin/tsc`, `frontend/node_modules/.bin/vite`, `frontend/node_modules/typescript/bin/tsc`, `.venv/bin/python`, `.venv/bin/pytest`
- Trigger: running local frontend build commands or invoking the workspace virtualenv executables directly.
- Workaround: reinstall the local Node/Python environments or restore execute permissions before using workspace-local toolchain binaries.

## Security Considerations

**Live-mode eligibility is derived from raw environment flags:**
- Risk: `backend/app/core/runtime.py` marks the runtime as `live-enabled` whenever `APP_MODE != mock`, exchange credentials are present, and `LIVE_TRADING_ENABLED=true`; there is no approval record, acknowledgement flow, or risk gate.
- Files: `backend/app/core/runtime.py`, `backend/app/core/config.py`, `README.md`, `.planning/ROADMAP.md`
- Current mitigation: the current backend has no execution engine, and `README.md` keeps live trading framed as disabled until later guarded phases.
- Recommendations: introduce separate requested and approved live-mode states, persist operator acknowledgements, and make execution depend on approved state rather than the raw env flag.

**Runtime metadata is exposed on unauthenticated published ports:**
- Risk: `docker-compose.yml` publishes `8000:8000` and `5173:5173`, while `backend/app/main.py` and `backend/app/api/routes/health.py` expose provider, exchange, and credential-presence metadata without access control.
- Files: `docker-compose.yml`, `backend/app/main.py`, `backend/app/api/routes/health.py`, `backend/app/core/runtime.py`
- Current mitigation: the payload contains no secret values, and the documented deployment model is local-first.
- Recommendations: bind services to loopback by default for local use, reduce metadata in unauthenticated responses, or gate non-local exposure with authentication.

## Performance Bottlenecks

**Frontend Compose startup uses a dev-server image path:**
- Problem: `frontend/Dockerfile` installs dependencies with `npm install` and runs `npm run dev` instead of serving built assets.
- Files: `frontend/Dockerfile`, `docker-compose.yml`, `frontend/package.json`
- Cause: the container image is optimized for baseline development convenience rather than repeatable startup speed or production-like frontend performance.
- Improvement path: switch to `npm ci`, add a multi-stage build, and serve built assets from a lightweight runtime once operator-facing flows need faster cold starts.

**Runtime transport is limited to a single synchronous fetch:**
- Problem: `frontend/src/lib/runtime.ts` fetches `/health` once, and `frontend/src/App.tsx` renders the result directly without buffering or incremental updates.
- Files: `frontend/src/lib/runtime.ts`, `frontend/src/App.tsx`, `backend/app/api/routes/health.py`
- Cause: there is no websocket, store, or event-stream abstraction between the frontend shell and the backend runtime state.
- Improvement path: add typed event schemas, websocket fanout, and a frontend state store before live market, signal, and execution telemetry lands.

## Fragile Areas

**Settings caching assumes runtime state is immutable after process start:**
- Files: `backend/app/core/config.py`, `backend/app/core/runtime.py`, `backend/tests/test_health.py`
- Why fragile: `get_settings()` is memoized with `@lru_cache`, and the only existing test already needs `cache_clear()` to avoid stale env state; dashboard controls, risk limits, and execution toggles cannot rely on process-start env snapshots.
- Safe modification: keep env settings for boot-time configuration only, and move operator-controlled runtime state into explicit services or persisted models.
- Test coverage: `backend/tests/test_health.py` is the only place that exercises cache invalidation behavior.

**The frontend shell is a single-component integration point:**
- Files: `frontend/src/App.tsx`, `frontend/src/lib/runtime.ts`, `frontend/src/main.tsx`
- Why fragile: fetch logic, fallback policy, and all rendering stay in one component tree with no module boundaries for charts, controls, or reconnect state.
- Safe modification: extract feature components and a central store before adding Phase 6-7 UI and websocket behavior.
- Test coverage: `frontend/package.json` defines no frontend test runner or assertions.

## Scaling Limits

**The backend contract scales to one global runtime snapshot only:**
- Current capacity: `backend/app/main.py` and `backend/app/api/routes/health.py` return a single `RuntimeSnapshot` from `backend/app/core/runtime.py`.
- Limit: requirements `DATA-01`, `DATA-03`, `WS-01`, `EXEC-03`, `RISK-03`, and `DASH-01` through `DASH-04` require symbol-scoped events, history, and continuous updates that do not fit a one-shot health payload.
- Scaling path: add event schemas, websocket routing, and persisted state outside the health endpoint before wiring in market, agent, or execution data.

**The frontend state model scales to one fetch and manual refresh only:**
- Current capacity: `frontend/src/App.tsx` loads runtime state once in `useEffect` and never reconnects, refreshes, or tracks connection lifecycle.
- Limit: dropped connections, streaming charts, and operator controls have no place to surface status, retries, or partial updates.
- Scaling path: adopt a central store with websocket lifecycle handling, retry/backoff state, and incremental updates.

## Dependencies at Risk

**Mandated platform dependencies are absent from the current manifests:**
- Risk: core roadmap phases depend on packages that are not present in the active manifests, so upcoming work starts with dependency and integration churn before feature code can land.
- Files: `backend/pyproject.toml`, `frontend/package.json`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`
- Impact: `PrimoAgent`, `Freqtrade`, `ccxt`, `Tremor`, and `shadcn/ui` all enter the codebase during later phases without any adapter or contract surface already in place.
- Migration plan: add the missing dependencies by subsystem with adapter boundaries and contract tests instead of landing them in one broad install wave.

## Missing Critical Features

**Realtime and event-backbone infrastructure is absent:**
- Problem: the codebase exposes only `/` and `/health`; there is no websocket endpoint, event schema, persistence layer, or market-data adapter.
- Files: `backend/app/main.py`, `backend/app/api/routes/health.py`, `frontend/src/lib/runtime.ts`, `docker-compose.yml`, `.planning/ROADMAP.md`
- Blocks: `DATA-01`, `DATA-02`, `DATA-03`, and `WS-01`.

**Execution and risk-control paths are absent:**
- Problem: the backend contains no Freqtrade/ccxt integration, no order lifecycle model, no risk-policy enforcement, and no operator approval flow beyond env-derived live-mode flags.
- Files: `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/core/runtime.py`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- Blocks: `EXEC-01`, `EXEC-02`, `EXEC-03`, `EXEC-04`, `RISK-01`, `RISK-02`, and `RISK-03`.

**The mandated dashboard foundation is absent from the frontend workspace:**
- Problem: `frontend/package.json` includes React, Tailwind, Framer Motion, and Lightweight Charts, but it does not include `Tremor` or a `shadcn/ui` setup, and `frontend/src/App.tsx` remains a single informational shell.
- Files: `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/styles.css`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`
- Blocks: `DASH-01`, `DASH-02`, `DASH-03`, and `DASH-04`.

## Test Coverage Gaps

**Backend tests cover only the default health happy path:**
- What's not tested: the root endpoint, credentials-missing mode, non-mock AI provider warnings, live-trading request coercion, and settings-cache behavior across multiple env combinations.
- Files: `backend/tests/test_health.py`, `backend/app/main.py`, `backend/app/core/runtime.py`, `backend/app/core/config.py`
- Risk: runtime-policy regressions can slip into later phases while `/health` still passes the single default test.
- Priority: High

**The frontend shell has no automated test harness:**
- What's not tested: `loadRuntimeSnapshot()` fallback behavior, API-base resolution, warning rendering, or any future websocket reconnect state.
- Files: `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/lib/runtime.ts`
- Risk: Phase 2 and Phase 6 UI work land on top of an untested shell, so regressions surface manually and late.
- Priority: High

**Compose/bootstrap verification is manual rather than automated:**
- What's not tested: reproducible `docker compose up --build` behavior in automation, frontend builds from a clean dependency install, and workspace-local startup failures caused by toolchain artifacts.
- Files: `docker-compose.yml`, `frontend/Dockerfile`, `.planning/phases/01-foundation-local-runtime/01-VERIFICATION.md`, `README.md`
- Risk: the documented startup flow can drift from the actual repository state without a CI or smoke-test gate catching it.
- Priority: High

---

*Concerns audit: 2026-04-01*

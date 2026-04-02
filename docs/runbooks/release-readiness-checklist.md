# Release Readiness Checklist

## Code and Verification

- [ ] `python3 -m pytest -q backend/tests`
- [ ] `cd frontend && npm run build`
- [ ] `docker compose config >/dev/null`
- [ ] smoke suite passes: `python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py`

## Runtime and Diagnostics

- [ ] `/health`, `/health/live`, and `/health/ready` return expected status
- [ ] `/api/diagnostics/summary` returns execution, risk, strategy, event-count, and market-data truth data
- [ ] dashboard shows zh/en switching and locale persistence
- [ ] dashboard surfaces requested/effective market source truthfully (`mock`, `ccxt`, or fallback/degraded)
- [ ] backend stdout logs remain structured and readable during analysis and dispatch actions

## Product Safety

- [ ] default `.env` keeps paper-first posture while requesting real market data truthfully
- [ ] no secrets are committed to source control
- [ ] live mode still requires confirmation and credentials
- [ ] strategy factory remains review-first and non-adopting

## Documentation

- [ ] root `README.md` matches current shipped scope
- [ ] `backend/README.md` includes backend startup and test flow
- [ ] operator runbook is accurate against a live local session
- [ ] roadmap/state documents reflect the latest completed phase

## Open-Source Hygiene

- [ ] latest phase has an isolated commit
- [ ] unrelated local/dirty files are not included in the phase commit
- [ ] milestone artifacts exist under `.planning/milestones/` or the active `.planning/phases/` workspace
- [ ] optional RD-Agent(Q) enablement path documents required Docker access or honest fallback behavior

---
phase: 1
slug: foundation-local-runtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` + `vitest` (Wave 0 installs if absent) |
| **Config file** | `backend/pyproject.toml`, `frontend/package.json` |
| **Quick run command** | `cd backend && pytest -q` |
| **Full suite command** | `cd backend && pytest -q && cd ../frontend && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest -q` or the task-specific quick verification command
- **After every plan wave:** Run `cd backend && pytest -q && cd ../frontend && npm run build`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | PLAT-01 | smoke | `test -f backend/pyproject.toml && test -f frontend/package.json` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | PLAT-02 | smoke | `rg -n \"APP_MODE=|AI_PROVIDER=|EXCHANGE_\" .env.example backend frontend` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | PLAT-03 | smoke | `cd backend && pytest -q` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | OPS-01 | infra | `docker compose config >/dev/null` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | PLAT-01 | docs | `rg -n \"docker compose up --build|mock-safe|paper trading\" README.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_health.py` — backend health/config smoke test
- [ ] `frontend/package.json` scripts include `build`
- [ ] `pytest` and `vitest` or equivalent minimal verification commands are installed/configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full local bootstrap on a clean machine | PLAT-01, OPS-01 | Requires integrated human-readable onboarding validation | Copy `.env.example`, run `docker compose up --build`, confirm backend health route and frontend shell load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

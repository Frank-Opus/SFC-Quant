---
phase: 5
slug: risk-guardrails-live-gating
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for risk policy enforcement, approval gating, halts, and live-mode confirmation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` + FastAPI `TestClient` |
| **Quick run command** | `python3 -m pytest -q backend/tests` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~120 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 5-01-01 | 05-01 | RISK-01 | config/policy | `python3 -m pytest -q backend/tests` | ✅ passed |
| 5-02-01 | 05-02 | RISK-02 | approval gate | `python3 -m pytest -q backend/tests` | ✅ passed |
| 5-03-01 | 05-03 | RISK-03 | auto halt | `python3 -m pytest -q backend/tests` | ✅ passed |
| 5-04-01 | 05-04 | EXEC-02 | live-mode gate | `python3 -m pytest -q backend/tests` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirm risk events in the live event tape | RISK-02/RISK-03 | Requires interactive websocket observation | Trigger a blocked dispatch and verify risk approval/halt events stream live |
| Attempt guarded live-mode enablement with real credentials | EXEC-02 | Depends on local credentials and operator intent | Run `/api/risk/live-mode` outside mock mode with the confirmation phrase and verify the backend enables live mode |

---

## Validation Sign-Off

- [x] Policy updates and blocked-symbol enforcement covered by automated tests
- [x] Risk approval denial path covered by automated tests
- [x] Daily-loss auto halt covered by automated tests
- [x] Live-mode confirmation and credential checks covered by automated tests

**Approval:** complete

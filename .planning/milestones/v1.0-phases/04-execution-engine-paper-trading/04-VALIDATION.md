---
phase: 4
slug: execution-engine-paper-trading
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for signal-to-order dispatch, paper fills, and execution control actions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` + FastAPI `TestClient` |
| **Quick run command** | `python3 -m pytest -q backend/tests` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~90 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 4-01-01 | 04-01 | EXEC-01 | config/service | `python3 -m pytest -q backend/tests` | ✅ passed |
| 4-02-01 | 04-02 | EXEC-01 | API dispatch | `python3 -m pytest -q backend/tests` | ✅ passed |
| 4-03-01 | 04-03 | EXEC-03 | event lifecycle | `python3 -m pytest -q backend/tests` | ✅ passed |
| 4-04-01 | 04-04 | EXEC-04 | control | `python3 -m pytest -q backend/tests` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Watch order lifecycle events in the browser event tape | EXEC-03 | Requires interactive websocket observation | Start the stack, dispatch a paper trade, and confirm created/submitted/filled events appear in realtime |
| Validate paper dispatch against a real provider-backed analysis run | EXEC-01 | Depends on provider quota and local credentials | Configure provider keys locally, call `/api/execution/dispatch`, and confirm the order path runs without provider fallback |

---

## Validation Sign-Off

- [x] Paper buy flow covered by automated tests
- [x] Pause/resume control covered by automated tests
- [x] Paper sell/position close covered by automated tests
- [x] Shared event stream carries execution lifecycle events

**Approval:** complete

---
phase: 9
slug: hardening-tests-release-docs
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for smoke tests, diagnostics, and release documentation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | backend `pytest`, frontend `vite build` |
| **Quick run command** | `python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~180 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 9-01-01 | 09-01 | OPS-02 | smoke tests incl. REST/WebSocket/paper path | `python3 -m pytest -q backend/tests/test_smoke_runtime.py` | ✅ passed |
| 9-02-01 | 09-02 | OPS-03 | health + diagnostics + structured logging validation | `python3 -m pytest -q backend/tests/test_health.py backend/tests/test_smoke_runtime.py` | ✅ passed |
| 9-03-01 | 09-03 | OPS-02, OPS-03 | doc accuracy / build parity | `cd frontend && npm run build` | ✅ passed |
| 9-04-01 | 09-04 | OPS-02, OPS-03 | release readiness full verification | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inspect structured logs while triggering runtime actions | OPS-03 | Requires a running backend process | Start the backend, trigger analysis/dispatch, and verify log lines remain structured and readable |
| Follow the operator runbook end-to-end | OPS-02, OPS-03 | Requires human review of docs against a live environment | Use the runbook to boot the stack, run smoke checks, and inspect diagnostics routes |

---

## Validation Sign-Off

- [x] Smoke tests cover REST, WebSocket, and paper trade path
- [x] Diagnostics and health surfaces are inspectable and backend-backed
- [x] Docs are release-ready for contributors and operators

**Approval:** complete

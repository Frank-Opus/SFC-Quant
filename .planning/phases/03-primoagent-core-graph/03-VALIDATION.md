---
phase: 3
slug: primoagent-core-graph
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for typed agent outputs, provider switching, and analysis persistence.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` + FastAPI `TestClient` |
| **Quick run command** | `python3 -m pytest -q backend/tests` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After backend logic changes:** run `python3 -m pytest -q backend/tests`
- **Before phase verification:** run backend tests + frontend build + compose config
- **Max feedback latency:** 2 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 3-01-01 | 03-01 | AGENT-01 | schema/service | `python3 -m pytest -q backend/tests` | ✅ passed |
| 3-02-01 | 03-02 | AGENT-04 | config/provider | `python3 -m pytest -q backend/tests` | ✅ passed |
| 3-03-01 | 03-03 | AGENT-03 | API/orchestration | `python3 -m pytest -q backend/tests` | ✅ passed |
| 3-04-01 | 03-04 | AGENT-02 | persistence/latest | `python3 -m pytest -q backend/tests` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider-backed run against a real external model | AGENT-04 | Depends on user-owned credentials and external network state | Set local `.env`, run `POST /api/analysis/run`, and confirm provider outputs arrive without fallback |
| Agent events are understandable in the browser event tape | AGENT-02 | Requires visual inspection of websocket-driven UI | Start the stack and confirm agent events appear in the existing live event monitor |

---

## Validation Sign-Off

- [x] Manual trigger flow covered by automated tests
- [x] Latest analysis retrieval covered by automated tests
- [x] Provider selection and fallback paths covered by automated tests
- [x] Shared event stream continues to persist agent events in JSONL and expose them through existing APIs

**Approval:** complete

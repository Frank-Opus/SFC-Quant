---
phase: 2
slug: market-data-event-backbone
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for market snapshots, replay persistence, and WebSocket delivery.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest` + FastAPI `TestClient` |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `cd backend && pytest -q` |
| **Full suite command** | `cd backend && pytest -q && cd ../frontend && npm run build` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every backend task:** run `cd backend && pytest -q`
- **After frontend integration changes:** run `cd frontend && npm run build`
- **Before phase verification:** run backend tests + frontend build together
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 02-01 | DATA-01 | schema | `cd backend && pytest -q` | ⬜ pending |
| 2-02-01 | 02-02 | DATA-02 | service | `cd backend && pytest -q` | ⬜ pending |
| 2-03-01 | 02-03 | WS-01 | websocket | `cd backend && pytest -q` | ⬜ pending |
| 2-04-01 | 02-04 | DATA-03 | replay | `cd backend && pytest -q` | ⬜ pending |
| 2-04-02 | 02-04 | WS-01 | frontend integration | `cd frontend && npm run build` | ⬜ pending |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser receives live updates without refresh | WS-01 | Requires an interactive browser session | Start the stack, open the frontend, verify prices/event tape update while backend runs |
| Replay log is inspectable locally | DATA-03 | Human inspection confirms operator usefulness | Open the generated JSONL file and confirm market/event entries are readable |

---

## Validation Sign-Off

- [x] Backend contracts, snapshot routes, and WebSocket flow covered by automated tests
- [x] Frontend build passes after live data integration
- [x] Replay log path is deterministic and documented in code/config
- [x] `nyquist_compliant: true` set in frontmatter after validation hardens

**Approval:** complete

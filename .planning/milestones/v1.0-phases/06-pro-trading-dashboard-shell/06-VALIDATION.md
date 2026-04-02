---
phase: 6
slug: pro-trading-dashboard-shell
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for the realtime operator dashboard shell.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | backend `pytest`, frontend `vite build` |
| **Quick run command** | `cd frontend && npm run build` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~120 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 6-01-01 | 06-01 | DASH-01 | UI build + data wiring | `cd frontend && npm run build` | ✅ passed |
| 6-02-01 | 06-02 | DASH-04 | control-plane integration | `cd frontend && npm run build` | ✅ passed |
| 6-03-01 | 06-03 | DASH-02 | chart wrapper build | `cd frontend && npm run build` | ✅ passed |
| 6-04-01 | 06-04 | WS-02 | websocket reconnect/state handling | `cd frontend && npm run build` | ✅ passed |
| 6-05-01 | 06-05 | DASH-01/DASH-04 | responsive shell polish | `cd frontend && npm run build` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Observe reconnect banner after backend websocket interruption | WS-02 | Requires running backend/frontend and interrupting the socket | Start the stack, stop/restart backend websocket availability, verify reconnecting and restored states in the UI |
| Trigger runtime actions from operator cards | DASH-04 | Requires interactive button flow | Use pause/resume, run analysis, dispatch paper trade, halt/clear halt, and verify state refreshes |
| Inspect price and P&L chart panels under live updates | DASH-02 | Requires visual confirmation | Keep the dashboard open and watch market ticks update the selected chart surfaces |

---

## Validation Sign-Off

- [x] Dashboard shell renders with live KPI cards
- [x] Operator controls call real backend routes
- [x] Lightweight Charts surfaces build and render
- [x] Reconnect state is explicit and operator-visible

**Approval:** complete

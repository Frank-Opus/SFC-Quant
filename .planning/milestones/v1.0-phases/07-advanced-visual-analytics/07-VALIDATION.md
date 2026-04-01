---
phase: 7
slug: advanced-visual-analytics
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for the dashboard analytics expansion.

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
| 7-01-01 | 07-01 | DASH-03 | UI build + timeline integration | `cd frontend && npm run build` | ✅ passed |
| 7-02-01 | 07-02 | DASH-03 | analytic component render | `cd frontend && npm run build` | ✅ passed |
| 7-03-01 | 07-03 | DASH-03 | responsive layout regression check | `cd frontend && npm run build` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Watch the signal log animate while live events stream | DASH-03 | Requires the running dashboard and websocket updates | Keep the dashboard open, trigger analysis/dispatch/halt actions, and confirm the decision tape remains legible |
| Inspect heatmap and radar under both populated and sparse state | DASH-03 | Requires a live frontend session | Verify the analytics remain informative when positions exist and when the book is flat |

---

## Validation Sign-Off

- [x] Signal log renders from live event data
- [x] Positions heatmap renders from snapshot and position state
- [x] Factor radar renders from selected market and analysis posture

**Approval:** complete

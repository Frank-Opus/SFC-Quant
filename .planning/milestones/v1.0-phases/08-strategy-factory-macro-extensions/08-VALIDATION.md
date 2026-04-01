---
phase: 8
slug: strategy-factory-macro-extensions
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for macro/news evidence and optional strategy generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | backend `pytest`, frontend `vite build` |
| **Quick run command** | `python3 -m pytest -q backend/tests/test_analysis_runtime.py backend/tests/test_strategy_factory_runtime.py` |
| **Full suite command** | `python3 -m pytest -q backend/tests && cd frontend && npm run build && cd .. && docker compose config >/dev/null` |
| **Estimated runtime** | ~150 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Requirement | Test Type | Automated Command | Status |
|---------|------|-------------|-----------|-------------------|--------|
| 8-01-01 | 08-01 | AGENT-05 | backend schema + API evidence validation | `python3 -m pytest -q backend/tests/test_analysis_runtime.py` | ✅ passed |
| 8-02-01 | 08-02 | STRAT-01 | backend status/config behavior | `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py` | ✅ passed |
| 8-03-01 | 08-03 | STRAT-02 | artifact workspace persistence | `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py` | ✅ passed |
| 8-04-01 | 08-04 | AGENT-05, STRAT-01, STRAT-02 | frontend integration/build | `cd frontend && npm run build` | ✅ passed |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inspect thesis evidence panel with macro/news sources visible | AGENT-05 | Requires live dashboard inspection | Run analysis and confirm the evidence panel shows catalysts, watch items, and linked sources |
| Trigger strategy generation and inspect artifact listing | STRAT-01, STRAT-02 | Requires checking local dashboard + filesystem | Enable strategy factory, generate an artifact, and confirm the dashboard list matches workspace files |

---

## Validation Sign-Off

- [x] Macro/news evidence is source-linked and explainable
- [x] Strategy factory enable/disable path is visible and backend-backed
- [x] Generated artifacts are reviewable on disk before runtime use

**Approval:** complete

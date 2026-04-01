# dSFC-Quant

## What This Is

dSFC-Quant is a standalone open-source AI/Agent quantitative trading platform for local deployment. It combines a PrimoAgent-based multi-agent research and decision layer, a Freqtrade + ccxt execution layer for paper and live trading, and a high-end React trading dashboard that streams market state, signals, positions, and risk telemetry in real time.

The product is aimed at technical traders and builders who want an explainable, extensible quant stack they can run themselves instead of a hosted black box. The current focus extends the locally verified v1 baseline into a more operator-ready system with bilingual UX, truthful real-market visibility, and a more production-honest optional RD-Agent workflow.

## Core Value

Turn multi-agent market intelligence into explainable, risk-bounded trading actions through a standalone platform that a trader can deploy and control locally.

## Current State

- Latest archived release: `v1.0`
- Archive date: 2026-04-01
- Local runtime status: backend/frontend verified locally, runbook acceptance repeated, RD-Agent real path invoked but first-run completion still needs hardening
- Archive links:
  - `.planning/milestones/v1.0-SUMMARY.md`
  - `.planning/milestones/v1.0-ROADMAP.md`
  - `.planning/milestones/v1.0-REQUIREMENTS.md`

## Current Milestone: v1.1 Bilingual UX & Live Market Readiness

**Goal:** turn the v1 local demo into a more operator-ready build with runtime zh/en switching, opt-in real market data, and honest RD-Agent completion diagnostics.

**Target features:**
- Add Chinese/English bilingual support with a visible language toggle and persistent preference
- Add opt-in real market data mode through the existing ccxt seam while preserving `mock-safe` defaults
- Make dashboard and diagnostics clearly show whether the system is using mock data, real exchange data, or a degraded fallback
- Harden optional RD-Agent strategy generation so first-run progress/failure is visible and locally testable

## Requirements

### Validated

- [x] Phase 1 validated the local monorepo runtime, env-driven startup, and two-service Compose baseline.
- [x] Phase 2 validated normalized market snapshots, replayable JSONL events, and websocket delivery.
- [x] Phase 3 validated a typed PrimoAgent core workflow with per-role outputs and a swappable provider seam.
- [x] Phase 4 validated the paper-trading dispatch loop, execution lifecycle events, and pause/resume controls.
- [x] Phase 5 validated server-side risk guardrails, approval gating, auto-halt behavior, and guarded live-mode enablement.
- [x] Phase 6 validated the live dashboard shell with KPI cards, chart surfaces, operator controls, and reconnect-aware realtime UX.
- [x] Phase 7 validated richer dashboard analytics including signal logs, a positions heatmap, and a factor radar.
- [x] Phase 8 validated source-linked macro/news thesis evidence and a review-first strategy-factory workspace.
- [x] Phase 9 validated smoke tests, diagnostics/health surfaces, structured logs, and release-facing documentation.

### Active

- [ ] User can switch the dashboard between Chinese and English at runtime and the preference persists locally.
- [ ] Dashboard labels, controls, timestamps, and money/number formatting follow the selected locale without hiding risk state.
- [ ] Operator can opt into real market data through the existing exchange/ccxt seam while `mock-safe` remains the default startup path.
- [ ] Runtime diagnostics and UI surfaces clearly indicate whether market data is `mock`, `ccxt`, or fallback/degraded.
- [ ] Optional RD-Agent strategy generation exposes progress/failure honestly enough for demo and local operator acceptance.
- [ ] Release verification covers bilingual UX, real-market mode, and RD-Agent first-run behavior.

### Out of Scope

- High-frequency / ultra-low-latency trading infrastructure — Freqtrade + Python + WebSocket orchestration is not the right substrate for HFT.
- Custodial fund management or copy-trading marketplace features — this project is a self-hosted tool, not a regulated custody or social brokerage product.
- Native mobile apps — web-first delivery is the right scope for the current milestone and keeps the team focused on operator quality.
- Fully autonomous live trading without explicit risk gates and operator controls — the product must preserve human oversight before it escalates to real funds.

## Context

This is a brownfield continuation of a locally shipped v1 milestone. The technical direction remains intentionally opinionated. The backend stays Python-centric because PrimoAgent, Freqtrade, ccxt, and optional RD-Agent(Q) all live naturally in that ecosystem. The frontend still emphasizes a premium finance-oriented operator experience, but now it must also support bilingual operation and remain legible in both Chinese and English.

The runtime must remain local-first and lightweight. That means a single repository, a two-service `docker-compose.yml` baseline (`backend` + `frontend`), environment-driven secrets, mock/simulated fallback modes, and a paper-trading-first workflow. New real-market behavior must be opt-in and must never silently weaken the current safe defaults.

## Constraints

- **Project Name**: Repo/application name must be `dSFC-Quant`.
- **AI Stack**: PrimoAgent remains the required agent brain.
- **Execution Stack**: Freqtrade + ccxt remain mandatory for order routing and exchange abstraction.
- **Optional Strategy Factory**: RD-Agent(Q) remains additive, not foundational.
- **Backend**: FastAPI + WebSocket remain mandatory.
- **Frontend**: Vite + React + Tremor + TradingView Lightweight Charts + shadcn/ui + Tailwind + Framer Motion remain mandatory.
- **Deployment**: Local-first and lightweight — default stack must still run on a developer workstation without Kubernetes or cloud dependencies.
- **Provider Support**: Third-party AI providers must remain swappable.
- **Safety**: Paper trading remains the first-class path and live trading still requires explicit enablement.
- **Truthful Runtime Surfaces**: Real-market and RD-Agent readiness must be reported honestly; do not imply success when the system is still in fallback, build, or degraded mode.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep v1 archived and start v1.1 as an extension milestone instead of reopening old phases | Preserves historical traceability while allowing focused follow-up work | Accepted 2026-04-01 |
| Implement bilingual support as a runtime locale layer rather than parallel hardcoded copies | Keeps future UI work maintainable and avoids copy drift | Accepted 2026-04-01 |
| Keep real market data opt-in behind explicit config while preserving `mock-safe` defaults | Maintains safe local startup and honest demos even without exchange access | Accepted 2026-04-01 |
| Surface market data source (`mock`, `ccxt`, fallback) in both backend diagnostics and frontend UI | Prevents operator confusion about whether data is simulated or live | Accepted 2026-04-01 |
| Treat RD-Agent first-run environment/bootstrap behavior as a hardening problem, not proof of completion | Avoids overstating production readiness while retaining the real integration seam | Accepted 2026-04-01 |
| Use a three-phase v1.1 milestone focused on bilingual UX, real-market readiness, and RD-Agent/test hardening | Keeps scope tight enough to complete autonomously without diluting the operator-ready goal | Accepted 2026-04-01 |
| Use `dSFC-Quant` as the repository/runtime name and present SFC-Quant as the product identity | Matches the user brief while keeping the codebase identifier explicit | Accepted 2026-04-01 |
| Keep the stack as a single repo with `backend/` and `frontend/` rather than split repos | Simplifies local setup, docker-compose, and contributor onboarding | Accepted 2026-04-01 |
| Use FastAPI as the control plane around Freqtrade instead of exposing Freqtrade directly to the UI | Keeps one backend API surface for auth-free local use, WebSocket fanout, orchestration, and risk gating | Accepted 2026-04-01 |
| Treat Freqtrade paper mode as the default execution path | Preserves realistic testing and reduces live-trading risk during early phases | Accepted 2026-04-01 |
| Model the AI workflow as explicit PrimoAgent subroles: market data, technical analysis, news/geopolitics, and risk/decision | Matches the requested multi-agent design and keeps reasoning inspectable | Accepted 2026-04-01 |
| Build a premium operator dashboard instead of a conventional admin panel | The UI is a differentiator and explicitly called out as a core requirement | Accepted 2026-04-01 |
| Keep docker-compose to two primary services (`backend`, `frontend`) for v1+ | Minimizes local complexity while still satisfying one-command startup | Accepted 2026-04-01 |
| Make RD-Agent(Q) an optional extension point that writes reviewable strategy artifacts | Preserves the requested integration without making core functionality depend on research automation | Accepted 2026-04-01 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 for v1.1 milestone kickoff*

# dSFC-Quant

## What This Is

dSFC-Quant is a standalone open-source AI/Agent quantitative trading platform for local deployment. It combines a PrimoAgent-based multi-agent research and decision layer, a Freqtrade + ccxt execution layer for paper and live trading, and a high-end React trading dashboard that streams market state, signals, positions, and risk telemetry in real time.

The product is aimed at technical traders and builders who want an explainable, extensible quant stack they can run themselves instead of a hosted black box. The v1 focus is a single-repo system that feels professional to use, is safe to test locally, and can graduate from simulation to guarded live execution.

## Core Value

Turn multi-agent market intelligence into explainable, risk-bounded trading actions through a standalone platform that a trader can deploy and control locally.

## Requirements

### Validated

- [x] Phase 1 validated the local monorepo runtime, env-driven startup, and two-service Compose baseline.
- [x] Phase 2 validated normalized market snapshots, replayable JSONL events, and websocket delivery.
- [x] Phase 3 validated a typed PrimoAgent core workflow with per-role outputs and a swappable provider seam.
- [x] Phase 4 validated the paper-trading dispatch loop, execution lifecycle events, and pause/resume controls.
- [x] Phase 5 validated server-side risk guardrails, approval gating, auto-halt behavior, and guarded live-mode enablement.

### Active

- [ ] Build a standalone repo named `dSFC-Quant` with a Python FastAPI backend and Vite/React frontend.
- [ ] Integrate PrimoAgent as the AI agent brain with clear data, technical, news/geopolitics, and risk/decision roles.
- [ ] Use Freqtrade + ccxt for execution, supporting paper trading first and guarded real-order routing second.
- [ ] Deliver a dark, trader-grade dashboard using Tremor, TradingView Lightweight Charts, shadcn/ui, Tailwind, and Framer Motion.
- [ ] Support third-party AI providers through environment-based configuration and provider adapters.
- [ ] Make local deployment lightweight and reproducible with `docker-compose.yml`, `.env` examples, health checks, and smoke-testable flows.

### Out of Scope

- High-frequency / ultra-low-latency trading infrastructure — Freqtrade + Python + WebSocket orchestration is not the right substrate for HFT.
- Custodial fund management or copy-trading marketplace features — this project is a self-hosted tool, not a regulated custody or social brokerage product.
- Native mobile apps — web-first delivery is the right scope for v1 and keeps the team focused on execution quality.
- Fully autonomous live trading without explicit risk gates and operator controls — the product must preserve human oversight before it escalates to real funds.

## Context

This is a greenfield project with no existing application code. The repo already contains OpenSpec and GSD planning tooling, but the product itself is new and will be built from scratch.

The technical direction is intentionally opinionated. The backend must stay Python-centric because PrimoAgent, Freqtrade, ccxt, and optional RD-Agent(Q) all live naturally in that ecosystem. The frontend must emphasize a premium, dark, finance-oriented operator experience instead of a generic admin panel, with glassmorphism controls, live charting, streaming logs, and motion that feels deliberate rather than decorative.

The system must run locally with minimal setup friction. That means a single repository, a two-service `docker-compose.yml` baseline (`backend` + `frontend`), environment-driven secrets, mock/simulated fallback modes, and a paper-trading-first workflow that lets users validate the full stack before turning on live trading.

## Constraints

- **Project Name**: Repo/application name must be `dSFC-Quant` — required by the product brief.
- **AI Stack**: PrimoAgent is the required agent brain — the core orchestration must preserve a multi-agent architecture instead of collapsing into a single chat model.
- **Execution Stack**: Freqtrade + ccxt are mandatory for order routing and exchange abstraction — avoids custom exchange plumbing and preserves paper/live parity.
- **Optional Strategy Factory**: RD-Agent(Q) is additive, not foundational — the platform must still work when it is disabled.
- **Backend**: FastAPI + WebSocket are mandatory — the backend must expose real-time state to the dashboard and act as the local control plane.
- **Frontend**: Vite + React + Tremor + TradingView Lightweight Charts + shadcn/ui + Tailwind + Framer Motion are mandatory — visual execution cannot drift into a plain CRUD dashboard.
- **Deployment**: Local-first and lightweight — the default stack must run on a developer workstation without Kubernetes or a cloud dependency.
- **Provider Support**: Third-party AI providers must be swappable — avoid hard-wiring the system to a single hosted model vendor.
- **Safety**: Paper trading must be a first-class path and live trading must require explicit enablement — this is a non-negotiable product boundary.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `dSFC-Quant` as the repository/runtime name and present SFC-Quant as the product identity | Matches the user brief while keeping the codebase identifier explicit | — Pending |
| Keep the stack as a single repo with `backend/` and `frontend/` rather than split repos | Simplifies local setup, docker-compose, and contributor onboarding | — Pending |
| Use FastAPI as the control plane around Freqtrade instead of exposing Freqtrade directly to the UI | Keeps one backend API surface for auth-free local use, WebSocket fanout, orchestration, and risk gating | — Pending |
| Treat Freqtrade paper mode as the default execution path | Preserves realistic testing and reduces live-trading risk during early phases | — Pending |
| Model the AI workflow as explicit PrimoAgent subroles: market data, technical analysis, news/geopolitics, and risk/decision | Matches the requested multi-agent design and keeps reasoning inspectable | — Pending |
| Build a premium operator dashboard instead of a conventional admin panel | The UI is a differentiator and explicitly called out as a core requirement | — Pending |
| Keep docker-compose to two primary services (`backend`, `frontend`) for v1 | Minimizes local complexity while still satisfying one-command startup | — Pending |
| Make RD-Agent(Q) an optional extension point that writes reviewable strategy artifacts | Preserves the requested integration without making v1 depend on research automation | — Pending |
| Use typed market/event contracts plus append-only JSONL replay storage for the Phase 2 backbone | Keeps runtime telemetry inspectable, local-first, and easy to replay without adding a database too early | Accepted 2026-04-01 |
| Keep a ccxt-facing adapter boundary but default Phase 2 market reads to deterministic mock generation in safe mode | Satisfies the exchange-adapter requirement without making local startup depend on external market access | Accepted 2026-04-01 |
| Use an in-process websocket hub for backend event fanout during early phases | Preserves the mandated lightweight local deployment while establishing the realtime seam the dashboard and agents need | Accepted 2026-04-01 |
| Refactor replay + websocket publication into a shared backend event bus in Phase 3 | Lets market, agent, and later execution/risk events share one inspectable local-first transport path | Accepted 2026-04-01 |
| Implement Phase 3 AI orchestration as explicit typed role outputs behind a narrow provider factory | Preserves PrimoAgent explainability while keeping provider-specific logic out of routes and downstream phases | Accepted 2026-04-01 |
| Keep the Phase 3 news/macro role honest about missing external evidence instead of fabricating sources | Protects explainability and operator trust until richer evidence ingestion lands in later phases | Accepted 2026-04-01 |
| Add a paper-only execution service with a Freqtrade-shaped adapter seam before any live routing | Proves the signal-to-order control plane while preserving the product's safety-first boundary | Accepted 2026-04-01 |
| Keep Phase 4 execution spot-style and long-only | Avoids inventing unsupported short/leverage behavior before risk and live-mode phases land | Accepted 2026-04-01 |
| Centralize mutable guardrails and live-mode state in a dedicated RiskService | Keeps policy enforcement auditable and reusable across execution, UI, and later live-routing flows | Accepted 2026-04-01 |
| Require explicit confirmation text plus non-mock runtime and credentials before live mode can enable | Makes accidental real-money routing materially harder | Accepted 2026-04-01 |

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
*Last updated: 2026-04-01 after Phase 3*

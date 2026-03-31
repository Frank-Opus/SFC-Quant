# Project Research Summary

**Project:** dSFC-Quant
**Domain:** standalone AI-agent quantitative trading platform
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

dSFC-Quant should be built as a local-first operator platform, not as a cloud trading SaaS. The strongest architecture is a single Python control plane around PrimoAgent, Freqtrade, and ccxt, paired with a React/Vite trading dashboard that consumes one normalized WebSocket event stream. That gives the project the shortest path to a credible v1 while preserving explainability, local deployment, and gradual progression from simulation to guarded live trading.

The recommended stack is highly opinionated and matches the brief well: Python 3.12 + FastAPI + PrimoAgent + Freqtrade/ccxt on the backend, React 19 + Vite 8 + Tremor + Lightweight Charts + Tailwind + Framer Motion on the frontend. The major product risk is not missing a feature; it is building an AI trading experience whose signals, risk gates, execution state, and UI state drift apart. The roadmap should therefore prioritize typed decision contracts, paper-trade parity, hard risk enforcement, and a unified streaming model before chasing advanced strategy-generation features.

## Key Findings

### Recommended Stack

The stack should stay deliberately lean: one backend service, one frontend service, server-side provider adapters, and a two-service docker-compose baseline. Freqtrade and ccxt already solve the hardest exchange-abstraction and dry-run/live problems in this space; the product should not re-invent those layers. PrimoAgent is the right orchestration layer because the product’s core promise is multi-role reasoning, not generic LLM chat.

**Core technologies:**
- **PrimoAgent**: multi-agent orchestration — required to structure data, technical, macro/news, and risk roles explicitly
- **FastAPI**: backend control plane — best fit for REST + WebSocket + typed Python services
- **Freqtrade + ccxt**: execution and exchange abstraction — best path to credible paper/live parity
- **React + Tremor + Lightweight Charts**: operator dashboard — ideal for a premium, finance-heavy SPA

### Expected Features

The must-have surface is clearer than the nice-to-have surface. Table stakes are paper trading, exchange connectivity, explainable signals, live P&L/position visibility, risk controls, and an event stream that keeps the dashboard trustworthy. Differentiators are the PrimoAgent role graph, the desk-grade UI, and the optional RD-Agent strategy factory.

**Must have (table stakes):**
- Paper trading with realistic execution states — users expect safe validation
- Explainable multi-agent signals — users need to trust the system
- Real-time dashboard and logs — users need operational visibility
- Risk controls and kill switches — users expect guardrails around capital

**Should have (competitive):**
- News / geopolitics synthesis in the agent graph — richer context than pure TA bots
- Heatmap / radar / animated glass UI — premium operator experience
- Optional RD-Agent strategy generation — strategy-lab extension

**Defer (v2+):**
- Multi-user SaaS concerns
- Native mobile experiences
- HFT-style execution ambitions

### Architecture Approach

The system should be organized around a FastAPI control plane that owns API routes, WebSocket streaming, orchestration, provider abstraction, and execution supervision. PrimoAgent roles produce typed trade intents, the risk layer approves or vetoes them, and the Freqtrade adapter handles order submission and state observation. The frontend should derive all dashboard surfaces from a normalized event stream rather than from independent polling widgets.

**Major components:**
1. **Control plane** — API, WebSocket, lifecycle, provider routing
2. **Agent graph** — market data, technical analysis, macro/news, risk/decision roles
3. **Execution and risk layer** — Freqtrade adapter, risk gates, live-mode approvals
4. **Operator dashboard** — KPI cards, charts, signal logs, heatmap, radar, controls

### Critical Pitfalls

1. **Non-actionable AI output** — avoid by defining typed trade-intent contracts early
2. **Paper/live divergence** — avoid by making paper mode travel through the same execution adapter path
3. **Risk controls that do not actually block orders** — avoid by enforcing them server-side before submission
4. **Dashboard state drift** — avoid by using one normalized event stream and one frontend state model
5. **Style over clarity in UI** — avoid by treating motion and glass effects as support for operator cognition, not as decoration

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Local Runtime
**Rationale:** Local-first developer ergonomics and deterministic startup are prerequisites for every later phase.
**Delivers:** Repo skeleton, docker-compose, env contracts, backend/frontend shells, health checks
**Addresses:** deployment and local-ops table stakes
**Avoids:** premature service sprawl

### Phase 2: Market Data & Event Backbone
**Rationale:** The dashboard and agent graph both depend on normalized market events.
**Delivers:** data adapters, event schema, persistence/replay base, streaming contracts
**Uses:** ccxt-aware normalization and WebSocket-first backend patterns
**Implements:** the system’s internal source of truth

### Phase 3: PrimoAgent Core Graph
**Rationale:** The product’s identity is the multi-agent decision workflow.
**Delivers:** data, TA, macro/news, and decision agents with typed outputs
**Avoids:** non-actionable or opaque AI signals

### Phase 4: Execution Engine & Paper Trading
**Rationale:** Signals are only meaningful once they can flow through realistic execution paths.
**Delivers:** Freqtrade integration, order lifecycle handling, dry-run loop

### Phase 5: Risk Guardrails & Live-Trade Gates
**Rationale:** Live mode must never precede enforceable risk policy.
**Delivers:** risk rules, kill switch, live-mode confirmation and blockers

### Phase 6: Pro Trading Dashboard
**Rationale:** Once the system can analyze and trade, the operator needs a premium control surface.
**Delivers:** KPI cards, charts, signal logs, agent cards, control surfaces

### Phase 7: Advanced Visual Analytics
**Rationale:** Heatmaps, radar, overlays, and richer animation should layer onto trustworthy live state.
**Delivers:** differentiated visualization features without destabilizing core operations

### Phase 8: Strategy Factory & Research Extensions
**Rationale:** RD-Agent(Q) and richer macro/news enrichment are valuable extensions after the core loop is stable.
**Delivers:** strategy artifact pipeline and optional advanced research paths

### Phase 9: Hardening, Docs, and Release Readiness
**Rationale:** The stack must be testable, explainable, and runnable by other developers.
**Delivers:** smoke tests, docs, release polish, troubleshooting guidance

### Phase Ordering Rationale

- Data/event normalization comes before both agents and UI because it is shared infrastructure.
- Agent outputs must be typed before execution and risk can be reliable.
- Live trading is intentionally gated behind paper parity and risk enforcement.
- The premium UI comes after trustworthy backend state exists.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** agent role contracts and provider capability handling
- **Phase 4:** exact Freqtrade integration boundary and process supervision model
- **Phase 8:** RD-Agent(Q) artifact workflow and review loop

Phases with standard patterns (skip research-phase):
- **Phase 1:** repo scaffolding, docker-compose, env, basic shells
- **Phase 9:** smoke tests, documentation, release hardening

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong official ecosystem signals and user-mandated constraints |
| Features | HIGH | Table stakes and differentiators are clear from the brief |
| Architecture | HIGH | Single control plane + streaming dashboard is a strong fit |
| Pitfalls | HIGH | Failure modes are well aligned with trading + AI + dashboard systems |

**Overall confidence:** HIGH

### Gaps to Address

- Exact PrimoAgent module boundaries need validation during implementation.
- The preferred Freqtrade embedding/supervision pattern should be settled in Phase 4 planning.
- News/geopolitics source selection should be finalized during research for relevant phases.

## Sources

### Primary (HIGH confidence)
- Official package indexes for FastAPI, Uvicorn, Freqtrade, ccxt, React, Vite, Tremor, Lightweight Charts, Tailwind, Framer Motion, Radix, Lucide, and shadcn — version verification
- PrimoAgent repository — agent-framework direction
- Freqtrade documentation — dry-run/live-trading model

### Secondary (MEDIUM confidence)
- RD-Agent repository — optional strategy-factory positioning

### Tertiary (LOW confidence)
- None needed for initial roadmap

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*

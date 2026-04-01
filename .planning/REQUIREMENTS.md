# Requirements: dSFC-Quant

**Defined:** 2026-04-01
**Core Value:** Turn multi-agent market intelligence into explainable, risk-bounded trading actions through a standalone platform that a trader can deploy and control locally.

## v1 Requirements

### Platform

- [ ] **PLAT-01**: Developer can clone `dSFC-Quant` and start backend/frontend with a single documented bootstrap flow.
- [ ] **PLAT-02**: Developer can configure exchange keys, AI providers, and runtime toggles through `.env` files without editing source code.
- [ ] **PLAT-03**: Developer can run the full stack in local mock-safe mode when live exchange or AI credentials are absent.

### Market Data

- [ ] **DATA-01**: User can stream normalized OHLCV/ticker data for selected symbols and timeframes.
- [ ] **DATA-02**: User can ingest exchange market data through a ccxt-backed adapter layer.
- [ ] **DATA-03**: User can persist signal, market, and trade events for replay/debugging.

### Agents

- [ ] **AGENT-01**: User can run a PrimoAgent workflow with dedicated data, technical-analysis, news/geopolitics, and risk/decision roles.
- [ ] **AGENT-02**: User can inspect each agent’s latest rationale, confidence, and status.
- [ ] **AGENT-03**: User can trigger an on-demand multi-agent analysis for a selected symbol.
- [ ] **AGENT-04**: User can connect supported third-party AI providers to the agent workflow through a common backend provider layer.
- [x] **AGENT-05**: User can inspect source-linked macro/news context that contributed to a trade thesis.

### Execution

- [ ] **EXEC-01**: User can execute paper trades through the Freqtrade + ccxt path without risking real funds.
- [ ] **EXEC-02**: User can enable real order routing only after explicit live-mode confirmation and valid credentials.
- [ ] **EXEC-03**: User can view order lifecycle states and fills in real time.
- [ ] **EXEC-04**: User can pause or resume the execution engine from the dashboard.

### Risk

- [ ] **RISK-01**: User can configure max position size, max concurrent trades, daily loss limits, and symbol-level blocks.
- [ ] **RISK-02**: User can require risk-agent approval before any trade is submitted.
- [ ] **RISK-03**: User can automatically halt trading when configured guardrails are breached.

### Dashboard

- [ ] **DASH-01**: User can view live KPI cards for positions, exposure, P&L, and risk score.
- [ ] **DASH-02**: User can view price and P&L series on TradingView Lightweight Charts with signal overlays.
- [ ] **DASH-03**: User can inspect signal logs, a positions heatmap, and a factor radar panel in the same dashboard.
- [ ] **DASH-04**: User can control agent/runtime state from glassmorphism operator cards with clear start/pause affordances.

### Realtime

- [ ] **WS-01**: User sees backend state changes pushed to the frontend over WebSocket without manual refresh.
- [ ] **WS-02**: User is notified when the realtime connection drops and when it reconnects.

### Strategy Factory

- [x] **STRAT-01**: User can enable or disable RD-Agent(Q)-based strategy generation as an optional subsystem.
- [x] **STRAT-02**: Developer can store generated strategy artifacts in a reviewable workspace before runtime use.

### Operations

- [ ] **OPS-01**: Developer can start the platform with a `docker-compose.yml` that boots `backend` and `frontend`.
- [x] **OPS-02**: Developer can run smoke tests covering REST API, WebSocket streaming, and the paper-trade path.
- [x] **OPS-03**: Developer can inspect health endpoints and structured logs for the local stack.

## v2 Requirements

### Product Expansion

- **PROD-01**: User can manage multiple operator profiles or workspaces.
- **PROD-02**: User can run richer trade replay/backtest analytics directly from the dashboard.
- **PROD-03**: User can manage plugin-style data/strategy extensions from a marketplace-like workflow.
- **PROD-04**: User can use a mobile companion experience for monitoring and alerts.

## Out of Scope

| Feature | Reason |
|---------|--------|
| High-frequency / sub-second execution | Incompatible with the mandated stack and not aligned with v1 goals |
| Custodial asset management | Adds major regulatory and security scope beyond a self-hosted trading tool |
| Copy trading / social feeds | Not part of the standalone operator-platform thesis |
| Native mobile apps | Web-first scope is more important than channel expansion for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| OPS-01 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| WS-01 | Phase 2 | Pending |
| AGENT-01 | Phase 3 | Satisfied |
| AGENT-02 | Phase 3 | Satisfied |
| AGENT-03 | Phase 3 | Satisfied |
| AGENT-04 | Phase 3 | Satisfied |
| EXEC-01 | Phase 4 | Satisfied |
| EXEC-03 | Phase 4 | Satisfied |
| EXEC-04 | Phase 4 | Satisfied |
| EXEC-02 | Phase 5 | Satisfied |
| RISK-01 | Phase 5 | Satisfied |
| RISK-02 | Phase 5 | Satisfied |
| RISK-03 | Phase 5 | Satisfied |
| DASH-01 | Phase 6 | Satisfied |
| DASH-02 | Phase 6 | Satisfied |
| DASH-04 | Phase 6 | Satisfied |
| WS-02 | Phase 6 | Satisfied |
| DASH-03 | Phase 7 | Satisfied |
| AGENT-05 | Phase 8 | Satisfied |
| STRAT-01 | Phase 8 | Satisfied |
| STRAT-02 | Phase 8 | Satisfied |
| OPS-02 | Phase 9 | Satisfied |
| OPS-03 | Phase 9 | Satisfied |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after Phase 9*

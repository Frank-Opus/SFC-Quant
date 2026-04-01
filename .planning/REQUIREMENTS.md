# Requirements: dSFC-Quant

**Defined:** 2026-04-01
**Milestone:** v1.1 — Bilingual UX & Live Market Readiness
**Core Value:** Turn multi-agent market intelligence into explainable, risk-bounded trading actions through a standalone platform that a trader can deploy and control locally.

## v1.1 Requirements

### Localization

- [ ] **I18N-01**: User can switch the operator dashboard between Simplified Chinese and English at runtime.
- [ ] **I18N-02**: User sees the selected language persist across refreshes and reconnects.
- [ ] **I18N-03**: User sees money, timestamps, numeric labels, and key dashboard copy rendered in the selected locale without reducing readability.

### Market Runtime

- [ ] **MKT-01**: Operator can opt into real market data through the ccxt-backed adapter seam while the default startup path remains `mock-safe`.
- [ ] **MKT-02**: Operator can tell whether current market data is coming from `mock`, `ccxt`, or a fallback/degraded path.
- [ ] **MKT-03**: Operator sees warnings and diagnostics when real market reads fail and the runtime falls back away from the requested data source.

### Dashboard

- [ ] **DASH-05**: Operator can see language state and market-source state from the live dashboard without opening dev tools.
- [ ] **DASH-06**: Bilingual and market-source additions preserve the trader-grade information hierarchy and risk clarity of the existing UI.

### Strategy Factory

- [ ] **STRAT-03**: Operator can inspect truthful RD-Agent strategy-generation progress or failure details during first-run/bootstrap scenarios.
- [ ] **STRAT-04**: Developer can review RD-Agent runtime artifacts/logs that explain incomplete or timed-out strategy generation.

### Operations

- [ ] **OPS-04**: Developer can verify bilingual UX, real-market mode, and fallback/degraded behavior through local tests or smoke checks.
- [ ] **OPS-05**: Developer can follow updated runbooks/docs to demo the bilingual dashboard, real-market toggle, and RD-Agent status honestly.

## Future Requirements

- **PROD-01**: User can manage multiple operator profiles or workspaces.
- **PROD-02**: User can run richer trade replay/backtest analytics directly from the dashboard.
- **PROD-03**: User can manage plugin-style data/strategy extensions from a marketplace-like workflow.
- **PROD-04**: User can use a mobile companion experience for monitoring and alerts.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-money live routing by default | Safe paper trading must remain the default path |
| Multi-language content generation for agent outputs beyond zh/en UI support | Too broad for this milestone and risks copy/translation drift |
| Exchange-specific advanced account/state sync | This milestone focuses on market data truthfulness, not full account integration |
| Fully automated RD-Agent production pipeline | v1.1 only needs honest local operator readiness and diagnostic visibility |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 | Phase 10 | Pending |
| I18N-02 | Phase 10 | Pending |
| I18N-03 | Phase 10 | Pending |
| DASH-05 | Phase 10 | Pending |
| DASH-06 | Phase 10 | Pending |
| MKT-01 | Phase 11 | Pending |
| MKT-02 | Phase 11 | Pending |
| MKT-03 | Phase 11 | Pending |
| STRAT-03 | Phase 12 | Pending |
| STRAT-04 | Phase 12 | Pending |
| OPS-04 | Phase 12 | Pending |
| OPS-05 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 for v1.1 milestone kickoff*

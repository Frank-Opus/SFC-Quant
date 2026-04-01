# Roadmap: dSFC-Quant

## Overview

v1.1 turns the locally accepted v1 baseline into a more operator-ready release. The build order keeps risk and truthfulness ahead of polish: first make the UI bilingual without losing clarity, then make market-data source selection and degradation explicit, and finally harden RD-Agent/test/runbook behavior so demos and local ship claims stay honest.

## Phases

**Phase Numbering:**
- Integer phases (10, 11, 12): planned v1.1 milestone work continuing from the archived v1 numbering
- Decimal phases (10.1, 10.2): urgent insertions if needed during execution

- [ ] **Phase 10: Bilingual UX Foundation** - Add zh/en locale infrastructure, switchable dashboard copy, and locale-aware formatting. (not started)
- [ ] **Phase 11: Real Market Runtime & Transparency** - Add opt-in real market mode with explicit diagnostics and dashboard visibility for source/fallback state. (not started)
- [ ] **Phase 12: RD-Agent Hardening, Tests & Demo Readiness** - Make optional RD-Agent progress/failure honest and extend tests/runbooks for v1.1 acceptance. (not started)

## Phase Details

### Phase 10: Bilingual UX Foundation
**Goal**: deliver a runtime bilingual dashboard foundation that supports Chinese and English without sacrificing operator clarity.
**Depends on**: Archived v1.0 baseline
**Requirements**: [I18N-01, I18N-02, I18N-03, DASH-05, DASH-06]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Operator can switch zh/en from the UI and the preference persists.
  2. Core dashboard shell, cards, controls, and system labels render in the selected language.
  3. Currency, number, and time formatting follow locale while risk and status meaning remain obvious.
**Plans**: 4 plans

Plans:
- [ ] 10-01: Introduce locale state, translation resources, and a persistent language toggle
- [ ] 10-02: Translate the dashboard shell, operator controls, and strategy-factory surfaces
- [ ] 10-03: Make numeric, money, and timestamp formatting locale-aware
- [ ] 10-04: Add bilingual UI validation coverage and update frontend/operator docs

### Phase 11: Real Market Runtime & Transparency
**Goal**: support truthful opt-in live market reads while preserving the current mock-safe default path.
**Depends on**: Phase 10
**Requirements**: [MKT-01, MKT-02, MKT-03, DASH-05, DASH-06]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Operator can enable real market data through configuration without changing source code.
  2. Backend health/diagnostics and frontend UI clearly show `mock`, `ccxt`, or fallback/degraded market state.
  3. Real-market failures degrade safely and visibly instead of silently pretending success.
**Plans**: 4 plans

Plans:
- [ ] 11-01: Add explicit market-source configuration and runtime selection rules
- [ ] 11-02: Extend backend market service, health, and diagnostics with source/fallback truthfulness
- [ ] 11-03: Surface market-source badges, warnings, and fallback state in the dashboard
- [ ] 11-04: Validate real-market and fallback flows through smoke checks and local acceptance steps

### Phase 12: RD-Agent Hardening, Tests & Demo Readiness
**Goal**: make optional RD-Agent behavior locally demonstrable and production-honest, then close the milestone with stronger acceptance coverage.
**Depends on**: Phase 11
**Requirements**: [STRAT-03, STRAT-04, OPS-04, OPS-05]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Strategy generation exposes progress/failure states honestly when RD-Agent is building, timing out, or failing.
  2. Artifact/log outputs explain incomplete RD-Agent runs well enough for a local operator to diagnose them.
  3. Tests and runbooks cover bilingual UX, real-market mode, and RD-Agent readiness claims.
**Plans**: 4 plans

Plans:
- [ ] 12-01: Add RD-Agent progress/status artifacts and timeout/failure reporting improvements
- [ ] 12-02: Harden strategy-generation lifecycle so long-running RD-Agent work remains inspectable
- [ ] 12-03: Expand backend/frontend tests and smoke checks for v1.1 acceptance
- [ ] 12-04: Update operator/release docs and perform final local demo readiness validation

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Bilingual UX Foundation | 0/4 | Not Started | — |
| 11. Real Market Runtime & Transparency | 0/4 | Not Started | — |
| 12. RD-Agent Hardening, Tests & Demo Readiness | 0/4 | Not Started | — |

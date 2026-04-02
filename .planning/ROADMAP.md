# Roadmap: dSFC-Quant

## Overview

v1.2 is a release-hardening milestone. The system already works locally, but it still reads like a milestone demo. This milestone makes the product feel publishable: ship the `SFC-Quant` brand, make Chinese the first-run default, default to requesting real market data, preserve explicit runtime truth, and complete release-facing validation including browser automation.

## Phases

**Phase Numbering:**
- Integer phases (13, 14, 15): planned v1.2 milestone work continuing from completed v1.1
- Decimal phases (13.1, 14.1): urgent insertions if needed during execution

- [x] **Phase 13: SFC-Quant Release Branding & Chinese-First UX** - Replace demo-era product language, unify user-facing branding, and make first-run default to Chinese. (completed 2026-04-01)
- [x] **Phase 14: Real Market Default Request & Truthful Runtime Surfaces** - Default to real market requests, remove mock masquerading in real mode, and keep paper-vs-market truth explicit. (completed 2026-04-01)
- [x] **Phase 15: Release Validation, Browser E2E & Ship Preparation** - Validate the release profile end to end, run browser automation, and finish cleanup/archive/ship preparation. (completed 2026-04-01)

## Phase Details

### Phase 13: SFC-Quant Release Branding & Chinese-First UX
**Goal**: make the product feel like a release, not a phase demo, while keeping risk information legible.
**Depends on**: Completed v1.1 baseline
**Requirements**: [BRAND-01, BRAND-02, I18N-04, I18N-05]
**UI hint**: yes
**Success Criteria**:
  1. User-visible product identity is `SFC-Quant`.
  2. No phase/demo hero language remains in the shipped UI.
  3. First visit defaults to Chinese using the new release preference rule.
**Plans**: 4 plans

Plans:
- [x] 13-01: Replace release-facing branding and hero narrative with `SFC-Quant`
- [x] 13-02: Remove phase/demo-era labels and UI copy from the dashboard shell
- [x] 13-03: Introduce release-specific Chinese-first locale preference behavior
- [x] 13-04: Update docs/readme/runbooks to match the new product identity

### Phase 14: Real Market Default Request & Truthful Runtime Surfaces
**Goal**: make real market data the default requested path without ever disguising degraded state as healthy realtime data.
**Depends on**: Phase 13
**Requirements**: [MKT-04, MKT-05, MKT-06, SAFE-01]
**UI hint**: yes
**Success Criteria**:
  1. Default release startup requests real market data.
  2. Real-mode failures do not silently substitute mock data as if it were real.
  3. UI and backend agree on requested source, effective source, and current runtime state.
  4. User can always tell execution is still `paper`.
**Plans**: 4 plans

Plans:
- [x] 14-01: Set and document the release-oriented real-market default profile
- [x] 14-02: Harden backend real-mode behavior so mock data never masquerades as real
- [x] 14-03: Surface paper/market/runtime truth clearly in the first-screen UI
- [x] 14-04: Validate real-success and degraded/fallback release paths locally

### Phase 15: Release Validation, Browser E2E & Ship Preparation
**Goal**: prove the release profile works, then finish archive / cleanup / ship preparation with explicit evidence.
**Depends on**: Phase 14
**Requirements**: [SAFE-02, OPS-06, OPS-07, OPS-08]
**UI hint**: no
**Success Criteria**:
  1. Backend tests, frontend build, and Compose validation pass.
  2. Browser automation validates the release walkthrough, or the remaining automation gap is explicitly documented.
  3. Planning/docs state is consistent and the milestone is ready for archive / cleanup / ship.
**Plans**: 4 plans

Plans:
- [x] 15-01: Expand release validation commands and regression coverage
- [x] 15-02: Attempt Agentic Browser walkthrough, document store/app gap, and complete equivalent Playwright browser validation
- [x] 15-03: Update planning state, runbooks, and release checklist for v1.2
- [x] 15-04: Prepare milestone completion, cleanup, and ship handoff

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14 → 15

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. SFC-Quant Release Branding & Chinese-First UX | 4/4 | Completed | 2026-04-01 |
| 14. Real Market Default Request & Truthful Runtime Surfaces | 4/4 | Completed | 2026-04-01 |
| 15. Release Validation, Browser E2E & Ship Preparation | 4/4 | Completed | 2026-04-01 |

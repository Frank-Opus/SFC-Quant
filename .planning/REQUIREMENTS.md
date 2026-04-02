# Requirements: dSFC-Quant

**Defined:** 2026-04-01
**Milestone:** v1.2 — SFC-Quant Release Hardening
**Core Value:** Turn multi-agent market intelligence into explainable, risk-bounded trading actions through a standalone platform that a trader can deploy and control locally.

## v1.2 Requirements

### Branding

- [x] **BRAND-01**: User sees `SFC-Quant` as the primary product identity across the dashboard and release-facing documentation.
- [x] **BRAND-02**: User no longer sees phase/demo-era wording like `Phase 8`, `Extensions`, or hero-level milestone language in the shipped UI.

### Localization

- [x] **I18N-04**: First visit defaults to Simplified Chinese using a release-specific locale preference key.
- [x] **I18N-05**: User can still switch between Simplified Chinese and English after first-run.

### Market Runtime

- [x] **MKT-04**: Default startup requests real market data.
- [x] **MKT-05**: In real mode, failed exchange reads do not silently substitute mock data as if it were real.
- [x] **MKT-06**: User can tell requested source, effective source, and current runtime state (`normal`, `fallback`, or `degraded`) from the product UI and backend diagnostics.

### Safety & Clarity

- [x] **SAFE-01**: User can always tell execution remains `paper` even when market data is real.
- [x] **SAFE-02**: Release docs keep secrets out of frontend and committed source, and do not imply private exchange keys are required for default market reads.

### Operations

- [x] **OPS-06**: Backend tests, frontend production build, and Compose validation pass under the v1.2 release profile.
- [x] **OPS-07**: Browser-driven release walkthrough validates the shipped interface, or remaining automation gaps are explicitly documented.
- [x] **OPS-08**: Planning state, runbooks, and release-facing docs match the v1.2 shipped scope.

## Future Requirements

- **PROD-01**: User can manage multiple operator profiles or workspaces.
- **PROD-02**: User can run richer trade replay/backtest analytics directly from the dashboard.
- **PROD-03**: User can manage plugin-style data/strategy extensions from a marketplace-like workflow.
- **PROD-04**: User can use a mobile companion experience for monitoring and alerts.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Default live-money trading | Safe paper trading must remain the default path |
| Private-key-required startup | Default release experience should not force secret configuration |
| Hiding degraded/fallback state for polish | Truthful runtime surfaces remain a hard requirement |
| Unlimited visual redesign | This milestone is for release hardening, not open-ended rebranding exploration |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 13 | Validated |
| BRAND-02 | Phase 13 | Validated |
| I18N-04 | Phase 13 | Validated |
| I18N-05 | Phase 13 | Validated |
| MKT-04 | Phase 14 | Validated |
| MKT-05 | Phase 14 | Validated |
| MKT-06 | Phase 14 | Validated |
| SAFE-01 | Phase 14 | Validated |
| SAFE-02 | Phase 15 | Validated |
| OPS-06 | Phase 15 | Validated |
| OPS-07 | Phase 15 | Validated |
| OPS-08 | Phase 15 | Validated |

**Coverage:**
- v1.2 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after v1.2 validation pass*

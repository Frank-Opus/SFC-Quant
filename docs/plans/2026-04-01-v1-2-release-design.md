# v1.2 Release Design - SFC-Quant

## Status
Approved by structured multi-agent review on 2026-04-01.

## Goal
Turn the current locally verified milestone into a publishable SFC-Quant release by removing demo-era presentation, making Chinese the default first-run language, making real market data the default requested path, and preserving explicit runtime truth so users never confuse real行情 with real交易.

## Locked Decisions

1. External product branding is `SFC-Quant`.
2. `dSFC-Quant` may remain as an internal engineering identifier, but it must not be the primary UI product label.
3. First visit defaults to `zh-CN` using a new locale storage key; only post-release user actions persist overrides.
4. Default startup requests real market data.
5. In real mode, failed exchange reads must not silently substitute mock data as if it were real.
6. The UI must continuously expose three truths: execution mode, requested/effective market source, and system status (`normal`, `fallback`, `degraded`).
7. Real market data scope covers market snapshot, candles, volume, change percent, and analysis input market-source metadata.
8. Execution remains `paper-first`; real行情 must not imply real资金.
9. Agentic Browser E2E is part of release validation. If unavailable, release notes must state browser automation validation is incomplete.

## Scope

### Included
- Product branding unification to `SFC-Quant`
- Chinese default first-run experience
- Real-market default request profile
- Truthful runtime surfaces for requested/effective/fallback state
- Removal of phase/demo language from UI
- Updated planning, docs, runbooks, and release criteria
- Browser-driven release acceptance

### Excluded
- Enabling live money trading by default
- Re-architecting the stack away from FastAPI/React/Freqtrade/ccxt/PrimoAgent
- Requiring exchange private keys for default market reads

## UX Principles
- First screen must feel like a product, not a milestone demo.
- Default language is Chinese, but English remains one click away.
- Real-time truth is visible without reading raw JSON.
- Risk clarity is never sacrificed for visual polish.
- When data is degraded, users see that immediately in product language.

## Engineering Strategy

### Backend
- Add a release-oriented real market default profile.
- Real mode returns only real data or explicit degraded/fallback truth.
- No mock masquerading in real mode.
- Diagnostics and health stay consistent with market runtime state.

### Frontend
- Replace phase/demo labels with release product narrative.
- Show `paper` execution state continuously.
- Show requested source, effective source, and current market status on the hero/diagnostic surfaces.
- Default locale key resets first-run to Chinese.

### Planning / GSD
- Start v1.2 milestone.
- Add phases for release branding, runtime truth hardening, and release validation/ship.
- Complete archive / cleanup / ship after validation.

## Acceptance Criteria

1. No visible `Phase 8`, `Extensions`, or demo-era hero language remains in the shipped UI.
2. First visit opens in Chinese unless the user changes language in the new release.
3. The default run requests real market data.
4. If real data succeeds, UI and health surfaces agree it is real.
5. If real data fails, UI and health surfaces agree it is degraded/fallback and do not present mock data as real.
6. The UI continuously indicates execution is `paper`.
7. Backend tests pass.
8. Frontend production build passes.
9. Docker Compose starts successfully.
10. Agentic Browser completes the release walkthrough, or the remaining gap is explicitly documented.

## Stop Conditions
- pytest green
- frontend build green
- compose config green
- local runtime green
- browser validation complete or explicitly marked incomplete
- planning/docs updated for v1.2

## Decision Log
- Chose explicit truth surfaces over hiding degraded states.
- Chose first-run Chinese default via new storage key to avoid legacy preference pollution.
- Chose real-data default request with no mock masquerading to match product promise.
- Chose to keep paper trading default to preserve safety.
- Chose bounded v1.2 scope to keep GSD autonomous execution convergent.

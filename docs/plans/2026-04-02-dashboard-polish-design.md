# 2026-04-02 Dashboard Polish Design

## Status

Approved through structured multi-agent review on 2026-04-02.

Disposition: `APPROVED`

## Goal

Make the `SFC-Quant` frontend feel more intelligent, more orderly, and more production-ready without changing backend contracts or weakening runtime truth.

## Constraints

- No new backend endpoints
- No natural-language "AI summary" that compresses multiple truths into one ambiguous sentence
- No hiding critical actions
- No flattening risk/degraded/alert hierarchy for aesthetics
- No new frontend dependency just for polish

## Locked Decisions

1. Hero uses a two-layer structure: left brand/value statement, right runtime digest.
2. Top-level status chips are limited to `execution`, `halt`, and `system`.
3. Digest is template-based fact presentation, not inferred prose.
4. All frontend-derived status mapping is centralized in one pure selector.
5. Card spacing/header rhythm becomes more consistent, but risk/degraded/alert keep controlled high-contrast variants.
6. Operator controls remain visible; dangerous actions become less visually seductive and more explicit.
7. Event presentation shifts from engineering event names to operator-facing category + consequence language.

## Decision Log

| Decision | Alternatives considered | Objection raised | Resolution |
|----------|-------------------------|------------------|------------|
| Replace freeform "smart summary" with structured digest | Freeform summary, hybrid summary | Could be mistaken for truth synthesis | Rejected freeform; use labeled digest only |
| Keep key actions visible | Collapse into secondary drawers | Could reduce discoverability and safety | Keep actions visible, only adjust hierarchy |
| Use single selector for derived UI state | Compute inside each component | Could create hidden logic drift | Centralize in one selector |
| Keep risk cards visually distinct | Full visual unification | Risk state could be flattened | Use controlled variants only |
| Use operator-facing event labels | Keep raw `event_type` | Engineering language is too opaque | Replace with category + consequence |

## Implementation Shape

- Add `frontend/src/lib/dashboard-derive.ts` as the single derivation layer
- Recompose hero into:
  - left: brand, thesis sentence, key promise
  - right: fixed-order runtime digest
- Reduce duplicated runtime facts between hero and diagnostics
- Reorder risk communication: gate states first, score second
- Reword Live enable action to emphasize danger and approval semantics
- Re-style event feeds to be scannable under trading pressure

## Validation

- `npm run build`
- `PLAYWRIGHT_BROWSERS_PATH=/Users/suhui/.cache/ms-playwright npm run e2e:release`


# Phase 7: Advanced Visual Analytics - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (approved by user)

<domain>
## Phase Boundary

Phase 7 expands the Phase 6 dashboard with premium analytics views: signal logs, a positions heatmap, and a factor radar. It should remain entirely within the operator dashboard and preserve legibility under live updates.

</domain>

<decisions>
## Implementation Decisions

### Analytics composition
- **D-01:** Build Phase 7 analytics from the existing Phase 6 dashboard runtime rather than adding new backend endpoints.
- **D-02:** Keep the analytics layer selected-instrument aware so charting, thesis, and factor geometry stay coherent.
- **D-03:** Use lightweight SVG/CSS panels for the radar and heatmap instead of bringing in another visualization library.

### UX and motion
- **D-04:** Treat the signal log as a curated decision tape, not a raw duplicate of the generic event feed.
- **D-05:** Keep motion short and staggered so new entries feel alive without becoming visually noisy.

### the agent's Discretion
- Exact factor definitions in the radar
- Which event types belong in the curated signal log
- Whether heatmap cells should emphasize P&L or market delta when a position is not active

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/06-pro-trading-dashboard-shell/06-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-7-visual-analytics-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `frontend/src/App.tsx` already composes the dashboard shell and can host the analytics section without layout rework
- `frontend/src/hooks/useMarketRuntime.ts` already streams event, position, market, and analysis state needed for Phase 7 visuals
- `frontend/src/styles.css` already contains the visual language Phase 7 should extend rather than replace

</code_context>

<deferred>
## Deferred Ideas

- user-defined factor models
- historical signal replay with timeline scrubbing
- denser portfolio analytics once multi-position breadth grows

</deferred>

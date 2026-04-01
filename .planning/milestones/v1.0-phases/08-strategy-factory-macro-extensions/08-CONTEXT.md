# Phase 8: Strategy Factory & Macro Extensions - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (user requested no further approvals)

<domain>
## Phase Boundary

Phase 8 extends the current operator cockpit with two real capabilities: source-linked macro/news thesis evidence and an optional strategy-factory subsystem that writes reviewable artifacts to a local workspace.

It must stay honest in mock-safe mode and must not imply that RD-Agent(Q) is fully integrated when the system is using a local deterministic seam.

</domain>

<decisions>
## Implementation Decisions

### Evidence and explainability
- **D-01:** Enrich the existing `news_geopolitics` role output instead of inventing a second analysis endpoint.
- **D-02:** Keep evidence source-linked and explicit about when it is local/generated rather than live external ingestion.
- **D-03:** Surface macro evidence in a dedicated panel alongside the thesis instead of hiding it in generic role summaries.

### Strategy factory
- **D-04:** Implement Strategy Factory as an optional backend subsystem with env defaults and runtime toggle support.
- **D-05:** Write artifacts to disk in a reviewable workspace before any runtime adoption.
- **D-06:** Keep generated strategy outputs deterministic and scaffold-oriented for this milestone.

### Dashboard composition
- **D-07:** Reuse the existing runtime hook and add focused API calls rather than building a new aggregate dashboard API.
- **D-08:** Show strategy status, workspace, and artifacts in the operator sidebar/main grid without reducing clarity of the trading surface.

### the agent's Discretion
- Exact artifact file contents
- How many recent artifacts to surface in the dashboard
- Whether strategy generation also records the latest thesis snapshot in JSON metadata

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/07-advanced-visual-analytics/07-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-8-strategy-macro-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `backend/app/services/analysis.py` already owns the typed role workflow and is the right place to enrich macro evidence
- `frontend/src/hooks/useMarketRuntime.ts` already coordinates realtime updates and can grow focused strategy state
- `frontend/src/App.tsx` already has a thesis panel and dashboard layout that can absorb Phase 8 panels without a structural rewrite

</code_context>

<deferred>
## Deferred Ideas

- external news ingestion pipelines
- strategy artifact diffing and approval workflow
- automatic execution adoption of generated strategies
- richer research notebooks or notebook export

</deferred>

# Phase 9: Hardening, Tests & Release Docs - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (user requested no further approvals)

<domain>
## Phase Boundary

Phase 9 finishes the v1 milestone by making the platform diagnosable, smoke-testable, and contributor-ready. It should not add new trading features; it should tighten confidence in the features already shipped.

</domain>

<decisions>
## Implementation Decisions

### Hardening
- **D-01:** Add dedicated smoke tests instead of assuming the existing phase tests are enough for release messaging.
- **D-02:** Expand health into live/ready variants and add a focused diagnostics summary endpoint.
- **D-03:** Use structured stdout logs rather than introducing external observability services.

### Documentation
- **D-04:** Update root and backend READMEs to reflect the full Phase 1-9 shipped scope.
- **D-05:** Add separate operator and release-readiness docs so safety and publish steps are easy to follow.

### the agent's Discretion
- Exact diagnostics payload shape
- Which runtime counters to include in the summary
- How detailed the release checklist should be while staying pragmatic

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/08-strategy-factory-macro-extensions/08-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-9-hardening-release-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `backend/app/api/routes/health.py` is currently minimal and is the right seam for richer health probes
- `backend/app/services/event_bus.py` already centralizes event publication and is the natural point for structured event logging
- `backend/tests/` already contains focused runtime tests that Phase 9 can complement with a dedicated smoke layer

</code_context>

<deferred>
## Deferred Ideas

- Prometheus/Grafana integration
- multi-process worker health aggregation
- cloud deployment guides

</deferred>

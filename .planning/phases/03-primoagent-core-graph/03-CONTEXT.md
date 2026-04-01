# Phase 3: PrimoAgent Core Graph - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (balanced progression)

<domain>
## Phase Boundary

Phase 3 adds the first explainable PrimoAgent workflow on top of the Phase 2 market/event backbone. It covers typed multi-role analysis outputs, provider abstraction, a manual analysis trigger, latest-result retrieval, and event-stream integration for agent activity. It does not yet add live news sourcing, scheduled execution loops, order routing, or frontend analysis dashboards.

</domain>

<decisions>
## Implementation Decisions

### PrimoAgent graph
- **D-01:** Keep the role graph explicit: `data` -> `technical_analysis` -> `news_geopolitics` -> `risk_decision`.
- **D-02:** Persist each role output as typed backend contracts so later phases can inspect or gate decisions without reparsing freeform text.
- **D-03:** Make the risk role synthesize earlier role outputs into a final recommendation instead of letting any upstream role decide trades alone.

### Provider seam
- **D-04:** Introduce a provider factory with `mock` and `openai_compatible` modes driven entirely by backend env configuration.
- **D-05:** Keep mock-safe fallback available even when a third-party provider is selected but unavailable or misconfigured.

### Event integration
- **D-06:** Refactor the Phase 2 replay/websocket path into a shared event bus so both market and agent events land in the same JSONL log and websocket stream.
- **D-07:** Publish analysis request, per-role completion, and overall analysis completion events for later dashboard and execution consumption.

### API scope
- **D-08:** Keep Phase 3 API scope narrow: one manual trigger route and one latest-result route are enough.
- **D-09:** Treat scheduled analysis as a service seam only for now; do not add cron-style runtime complexity yet.

### the agent's Discretion
- Exact prompt wording for the OpenAI-compatible adapter
- Minor naming differences for internal helper methods or typed fields
- The exact deterministic heuristics used by the mock provider as long as outputs stay explainable and conservative

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/02-market-data-event-backbone/02-CONTEXT.md`
- `.planning/phases/02-market-data-event-backbone/02-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-3-primoagent-core-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `backend/app/services/market.py` already owns normalized market snapshots and mock/ccxt switching
- `backend/app/services/event_store.py` and `backend/app/services/realtime.py` already provide persistence and websocket transport pieces
- `backend/app/core/config.py` and `backend/app/core/runtime.py` already expose env-driven runtime state that Phase 3 can extend
- `backend/app/main.py` already centralizes backend lifespan wiring, making it the right place to register new shared services

</code_context>

<deferred>
## Deferred Ideas

- source-linked news evidence and richer citations
- background scheduling cadence for repeated analyses
- frontend analysis panels and decision visualization
- automatic handoff from risk decisions into execution

</deferred>

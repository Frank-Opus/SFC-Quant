# Phase 4: Execution Engine & Paper Trading - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (balanced progression)

<domain>
## Phase Boundary

Phase 4 converts approved analysis outcomes into paper orders, exposes execution status/control APIs, and streams order lifecycle events through the shared event bus. It does not yet implement hard risk policies, live trading enablement, or dashboard execution controls.

</domain>

<decisions>
## Implementation Decisions

### Execution architecture
- **D-01:** Introduce a dedicated `ExecutionService` instead of embedding trading behavior inside analysis routes.
- **D-02:** Keep the Phase 4 execution path paper-only, with no real order routing available through these routes.
- **D-03:** Model execution around a Freqtrade-shaped adapter seam so later phases can deepen integration without changing API contracts.

### Signal routing
- **D-04:** Reuse `AnalysisService` as the signal source for execution dispatch.
- **D-05:** Only `buy` and `sell` recommendations place orders; `hold`/`wait` become explicit skipped events.
- **D-06:** Keep Phase 4 spot-style and long-only; no shorting or leverage behavior yet.

### Runtime state
- **D-07:** Store paper cash, positions, and recent orders in-memory for Phase 4 while publishing all transitions to the shared event bus.
- **D-08:** Expose manual pause/resume control immediately because later risk guardrails will build on the same control seam.

### the agent's Discretion
- Exact paper-fill fee and sizing defaults
- Specific event naming under the `execution.*` namespace
- The exact response shape for status and dispatch payloads as long as state stays typed and inspectable

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/03-primoagent-core-graph/03-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-4-paper-trading-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `backend/app/services/analysis.py` already produces typed recommendations suitable for execution input
- `backend/app/services/event_bus.py` already handles replayable event persistence and websocket fanout
- `backend/app/main.py` already centralizes service wiring for the FastAPI app state
- `backend/tests/` already uses pytest + TestClient for route/service verification

</code_context>

<deferred>
## Deferred Ideas

- live exchange credentials and guarded live mode
- risk thresholds, trade approval policies, and kill switches
- frontend execution controls and order dashboards
- persistent portfolio storage beyond the local event log

</deferred>

# Phase 6: Pro Trading Dashboard Shell - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (approved by user)

<domain>
## Phase Boundary

Phase 6 turns the existing backend runtime into a trader-grade frontend shell. It must expose KPI cards, price/P&L charts, runtime controls, and explicit websocket connection health, but it does not yet need the richer heatmap/radar analytics scheduled for Phase 7.

</domain>

<decisions>
## Implementation Decisions

### UI shell
- **D-01:** Keep the dashboard local-first and compose it from existing backend routes instead of adding a dedicated dashboard aggregate API.
- **D-02:** Use a bold cockpit layout with strong hierarchy, glassmorphism surfaces, and responsive stacking rather than a generic admin grid.
- **D-03:** Add shadcn-style local UI primitives and Tremor status primitives so the mandated frontend stack becomes real code, not just roadmap text.

### Realtime
- **D-04:** Treat websocket lifecycle as primary state with reconnect attempts, manual reconnect, and explicit restore/drop notifications.
- **D-05:** Use websocket events to trigger targeted state refreshes for execution/risk/analysis rather than polling loops.

### Charts and controls
- **D-06:** Use TradingView Lightweight Charts for both price and derived P&L surfaces.
- **D-07:** Keep pause/resume, analysis, dispatch, halt, and live-mode controls inside glass operator cards with clear risk language.

### the agent's Discretion
- Exact KPI scoring formula for the frontend risk score
- Which recent runtime events become chart markers vs tape-only entries
- How aggressively the websocket reconnect backoff should escalate

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/05-risk-guardrails-live-gating/05-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-6-dashboard-shell-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `frontend/src/hooks/useMarketRuntime.ts` already owns initial snapshot loading and websocket setup, making it the natural seam for dashboard runtime expansion
- `backend/app/api/routes/analysis.py`, `backend/app/api/routes/execution.py`, and `backend/app/api/routes/risk.py` already expose the control plane the dashboard needs
- `backend/app/services/event_bus.py` already emits replayable execution, risk, and analysis events that can drive reconnect-aware UI refreshes

</code_context>

<deferred>
## Deferred Ideas

- positions heatmap and factor radar
- macro evidence drill-down panels
- multi-workspace/operator personalization
- persisted dashboard preferences

</deferred>

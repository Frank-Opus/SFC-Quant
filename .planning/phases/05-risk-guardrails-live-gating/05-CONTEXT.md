# Phase 5: Risk Guardrails & Live Gating - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning and execution
**Mode:** Autonomous (balanced progression)

<domain>
## Phase Boundary

Phase 5 adds server-side risk policy enforcement, trade approval gating, kill-switch halt behavior, and explicit live-mode enablement rules on top of the Phase 4 paper execution loop. It does not yet add dashboard UX for risk control or real live-order routing.

</domain>

<decisions>
## Implementation Decisions

### Risk policy
- **D-01:** Centralize mutable policy and halt state in a dedicated `RiskService`.
- **D-02:** Treat blocked symbols, max position size, max concurrent trades, and daily realized loss as hard guardrails.
- **D-03:** Keep policy runtime-local for now; persistence beyond process memory is deferred.

### Approval workflow
- **D-04:** Require the final `risk_decision` agent output to approve executable trades when risk approval is enabled.
- **D-05:** Deny execution when the risk decision is fallback or below the configured confidence threshold.
- **D-06:** Distinguish between approval denials and hard-policy breaches; only the latter auto-halt the engine.

### Live gating
- **D-07:** Live mode requires an explicit confirmation phrase plus valid exchange credentials.
- **D-08:** `APP_MODE=mock` can never enable live mode, regardless of credentials or user intent.

### the agent's Discretion
- Exact confirmation phrase for live mode
- Whether clearing a risk halt should also resume execution automatically
- The specific event names used for risk approval and live-mode audit events

</decisions>

<canonical_refs>
## Canonical References

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/04-execution-engine-paper-trading/04-VERIFICATION.md`
- `docs/plans/2026-04-01-phase-5-risk-live-gating-design.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `backend/app/services/execution.py` already owns the paper order lifecycle and pause/resume seam
- `backend/app/services/analysis.py` already exposes the final `risk_decision` role output needed for approval checks
- `backend/app/services/event_bus.py` already provides the audit/event transport required for risk decisions and live-mode changes

</code_context>

<deferred>
## Deferred Ideas

- persistent risk policy storage
- UI for risk policy editing and live-mode confirmation
- multi-user approval workflows
- real live-order routing once the full risk envelope is in place

</deferred>

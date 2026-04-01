# Phase 1: Foundation & Local Runtime - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a runnable monorepo baseline for `dSFC-Quant` with backend and frontend shells, environment-driven configuration, mock-safe defaults, and a one-command local startup path. This phase establishes project structure and local runtime ergonomics only. It does not implement the trading engine, PrimoAgent workflows, or the full trader dashboard feature set.

</domain>

<decisions>
## Implementation Decisions

### Frontend foundation
- **D-01:** The frontend should not be based on a heavy open-source admin/dashboard framework or template. The project needs a custom trading workstation, not a generic CRUD/admin panel.
- **D-02:** The frontend should use a composable stack built from the mandated libraries: Vite + React + Tailwind + shadcn/ui + Tremor + TradingView Lightweight Charts + Framer Motion.
- **D-03:** Phase 1 should establish a flexible frontend shell that future phases can evolve into a premium trading interface without being constrained by a prebuilt dashboard opinion.

### Design workflow
- **D-04:** Installing an `impeccable` skill is optional and must not be treated as a prerequisite for planning or implementing the frontend baseline.
- **D-05:** Existing project workflow and UI-oriented skills are sufficient for now; design-specialized skills can be added later if they clearly improve execution.

### the agent's Discretion
- Exact root-level monorepo folder layout beyond required `backend/` and `frontend/`
- How much backend/frontend shell surface to include in Phase 1 as long as startup, health, env loading, and mock-safe behavior are satisfied
- Local developer ergonomics such as Makefile/scripts/task aliases, if they remain lightweight
- Docker/dev workflow details, provided `docker-compose.yml` remains the default documented startup path

</decisions>

<specifics>
## Specific Ideas

- The product should feel like a professional trading workstation rather than a conventional SaaS admin dashboard.
- Visual flexibility later is more important than getting a fast start from a canned UI template.
- `impeccable` can be considered as a future enhancement, but the frontend architecture should not depend on a specific external design skill.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project source of truth
- `.planning/PROJECT.md` — Product identity, stack constraints, local-first posture, and key decisions
- `.planning/REQUIREMENTS.md` — Phase-linked requirements including `PLAT-01`, `PLAT-02`, `PLAT-03`, and `OPS-01`
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown
- `.planning/STATE.md` — Current phase status and continuity notes

### Research context
- `.planning/research/SUMMARY.md` — Recommended architecture and phase ordering rationale for the project

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — the repository is still in greenfield state and contains planning/docs only

### Established Patterns
- No application code exists yet, so this phase will establish the first repo/runtime conventions

### Integration Points
- New application code will start from root-level `backend/` and `frontend/` workspaces
- Runtime and planning conventions must remain aligned with `AGENTS.md`

</code_context>

<deferred>
## Deferred Ideas

- Full premium trading dashboard implementation — later UI phases
- Detailed agent visual language and advanced chart surfaces — later UI phases
- Installing extra design skills such as `impeccable` unless a later phase proves they materially improve execution

</deferred>

---

*Phase: 01-foundation-local-runtime*
*Context gathered: 2026-04-01*

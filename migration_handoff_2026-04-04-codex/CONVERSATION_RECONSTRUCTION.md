# Conversation Reconstruction (Non-Verbatim)

This is a high-fidelity reconstruction of the material conversation goals and directives, not a literal platform transcript export.

## Persistent User Intent
- Build `SFC-Quant` into a publishable, production-grade AI/Agent quant terminal.
- Chinese-first UX.
- Real market data where possible, but always truthful runtime state.
- Paper trading remains default safe execution path.
- Strong emphasis on AI/Agent workflow visibility and usefulness.
- Frontend should feel institutional, dense, polished, and not like a generic dashboard.

## Major Directives Across The Session History
1. Replace mock/demo-era UI and milestone wording with a real product identity.
2. Make the dashboard feel like a serious trading terminal.
3. Use `main` as the primary branch and make Vercel production use `main`.
4. Integrate real external intelligence/data sources where useful.
5. Improve bilingual support and default startup behavior.
6. Explore/visualize multi-agent workflows, including a Star-Office inspired visual center.
7. Keep advancing autonomously without repeated human approvals.
8. Preserve truthful runtime surfaces rather than pretending the system is more live/complete than it is.

## Important Recent Milestones
- Remote/default branch work was consolidated to `main`.
- Vercel was linked and production set to `main`.
- Public site stayed reachable.
- `工作流中枢` was previously criticized as “just a pile of numbers” and “not a visual workbench”.
- Latest work specifically fixed that by turning it into an actual visual command/workflow workspace.

## Recent Bug / Fix Cycle
### Problem reported by user
- After merging to `main`, many issues were still visible.
- Specifically: the `工作流中枢` visual workflow center was not really visible/useful.

### Root cause found
- The repo contained a card-oriented workflow panel and also unused Star-Office style workflow assets/CSS.
- `main` was still showing a card-heavy fallback style instead of a real visual stage/workbench.

### Fix implemented
- Reworked `frontend/src/components/dashboard/agent-workflow-studio.tsx`
- Reused `workflow-star-*` visual stage styling already present in `frontend/src/styles.css`
- Added central stage, core node, stage nodes, agent nodes, provider dock, mission log, and inspector rail
- Tightened lower-grid layout to reduce text wrapping and visual crowding
- Updated release test to accept truthful system state instead of a hardcoded “normal only” assumption

## Current Open Direction
If continuing immediately, the next best work is likely:
1. Keep polishing the rest of the dashboard to the same visual/IA standard as the workflow page
2. Continue runtime hardening for real market data + truthful paper execution
3. Keep validating that every UI module actually adds operator value rather than occupying space

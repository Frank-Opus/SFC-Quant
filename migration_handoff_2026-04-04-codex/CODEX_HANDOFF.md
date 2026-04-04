# Codex Handoff - 2026-04-04

## Repo Identity
- Runtime/repo name: `dSFC-Quant`
- Product name: `SFC-Quant`
- Repo path on source machine: `/Users/suhui/Documents/百度同步/Project_Interest/ai-quant-empire`
- Active local branch at export time: `main`
- Current `HEAD`: `8bfadf4caedbacf2b507995beb5e6b8d6ae637dd`
- Remote `origin/main`: `8bfadf4caedbacf2b507995beb5e6b8d6ae637dd`

## User Preferences
- Must speak Chinese.
- Prefer direct execution; do not repeatedly ask for confirmation.
- User wants a production-grade, publishable feel, but responses must stay truthful about real runtime state.
- Default UX preference is Chinese-first.
- Local-first architecture remains important.

## Current Product State
- GitHub default branch: `main`
- Vercel production branch: `main`
- Public site: `https://sfc-quant-dashboard.vercel.app`
- Latest inspected production deployment was `Ready` at export time.
- Local backend on source machine was reachable at `http://127.0.0.1:8000`.

## What Was Recently Finished
1. Merged work into `main` and aligned Vercel production to `main`.
2. Reworked the frontend shell into a single-screen trading-terminal style layout.
3. Fixed the `工作流中枢` page so it is now a real visual workflow workspace instead of only numeric/status cards.
4. Added/used Star-Office style visual assets already present in the repo.
5. Verified:
   - frontend build passes
   - layout regression passes
   - release walkthrough passes locally against preview base URL

## Current Uncommitted Work
There are uncommitted local edits at export time, primarily:
- `frontend/src/components/dashboard/agent-workflow-studio.tsx`
- `frontend/src/styles.css`
- `frontend/tests/release.spec.ts`

These are included both in the repo working tree and in:
- `migration_handoff_2026-04-04-codex/uncommitted.patch`

## Important Runtime Truth
At export time, the backend health endpoint reported:
- market data mode: `real`
- requested source: `ccxt`
- effective source: `ccxt`
- market status: `live`
- execution mode: `paper`
- execution adapter: `freqtrade_mock`

Snapshots saved here:
- `migration_handoff_2026-04-04-codex/backend-health.json`
- `migration_handoff_2026-04-04-codex/market-snapshot.json`
- `migration_handoff_2026-04-04-codex/workflow-snapshot.json`

## Most Relevant Remaining Goals
1. Continue raising the dashboard to release-grade polish across all sections, not just workflow.
2. Continue real market + truthful paper execution path hardening.
3. Continue evaluating / integrating broader agent workflows (PrimoAgent core is already first-class; RD-Agent(Q) remains optional/additive by project constraint).
4. Keep the UI dense, professional, trustworthy, and operator-readable.
5. Maintain truthful runtime surfacing: never fake `normal/live` if backend is degraded/fallback.

## Known Project Constraints
- Backend: Python + FastAPI + WebSocket
- Execution: Freqtrade + ccxt
- AI orchestration: PrimoAgent roles must remain explicit and auditable
- Frontend: Vite + React + Tremor + Lightweight Charts + shadcn/ui + Tailwind + Framer Motion
- Paper trading remains default safe path
- Third-party AI providers must remain swappable
- Secrets must stay out of committed frontend source

## Suggested First Steps On New Host
1. Unzip the bundle.
2. Open the repo root.
3. Read `AGENTS.md` and `.planning/*` source-of-truth docs first.
4. Inspect current working tree:
   - `git status`
   - `git diff --stat`
5. Open the handoff screenshots in `migration_handoff_2026-04-04-codex/artifacts/`.
6. Recreate dependencies/runtime as needed.
7. If backend + frontend can boot, rerun:
   - `cd frontend && npm run build`
   - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/layout-regression.spec.ts -c playwright.release.config.ts`
   - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/release.spec.ts -c playwright.release.config.ts`

## Important Caveat About Conversation Export
This bundle does **not** contain a platform-native verbatim export of the Codex chat transcript, because that transcript is not available to me as a local file export from this environment.
Instead, I created a detailed reconstructed handoff in:
- `migration_handoff_2026-04-04-codex/CONVERSATION_RECONSTRUCTION.md`

That file captures the material user goals, decisions, constraints, and recent progress needed to resume work.

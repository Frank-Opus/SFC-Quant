# dSFC-Quant Agent Guide

## Read First

Before planning or editing code, read these files in order:

1. `.planning/PROJECT.md`
2. `.planning/REQUIREMENTS.md`
3. `.planning/ROADMAP.md`
4. `.planning/STATE.md`

`CLAUDE.md` contains an auto-generated summary, but the `.planning/` files are the source of truth.

## Project Constraints

- Repo/runtime name is `dSFC-Quant`
- Backend stack is Python + FastAPI + WebSocket
- AI orchestration must use PrimoAgent with distinct data, technical-analysis, news/geopolitics, and risk/decision roles
- Execution stack must use Freqtrade + ccxt
- RD-Agent(Q) is optional and must not block core platform functionality
- Frontend stack must use Vite + React + Tremor + TradingView Lightweight Charts + shadcn/ui + Tailwind + Framer Motion
- Default deployment must remain local-first and lightweight with `docker-compose.yml`
- Third-party AI providers must be swappable via backend configuration
- Paper trading is the default safe path; live trading must stay behind explicit risk-gated enablement

## Working Rules

- Keep the system as a standalone monorepo with `backend/` and `frontend/`
- Do not replace mandated technologies with alternatives unless the user explicitly changes scope
- Preserve explainability: agent outputs must remain inspectable, typed, and auditable
- Preserve operator clarity: visual polish cannot reduce readability or hide risk state
- Keep secrets out of the frontend and out of committed source files

## Workflow

- Use GSD planning/execution commands for implementation work when possible
- Current milestone state is archived locally; review `.planning/STATE.md` and `.planning/milestones/v1.0-SUMMARY.md` before resuming
- Preferred continuation command: `$gsd-new-milestone`
- Direct planning shortcut: define fresh requirements first, then use `$gsd-plan-phase <phase>`

## Current Focus

Milestone archived (`v1.0`)

Goal: either define the next milestone or configure a git remote and finish the remote ship workflow.

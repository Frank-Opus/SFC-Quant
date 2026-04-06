# Strategy Providers And Workflow Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `RD-Agent(Q)` and `TradingAgents-CN` genuinely installable and callable through the backend strategy factory, then extend the workflow-centered visual system across the remaining dashboard sections.

**Architecture:** Keep FastAPI and `StrategyFactoryService` as the single control plane. Stabilize provider launch through repo-owned wrappers and vendor-path resolution, keep workflow snapshot as the canonical truth payload, and spread the existing workflow-studio visual language through reusable dashboard section shells and truth strips.

**Tech Stack:** Python, FastAPI, Pydantic, subprocess-based provider launchers, pytest, React, Vite, Tailwind, Tremor, Framer Motion, Playwright

---

### Task 1: Stabilize Provider Resolution And Runtime Truth

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/scripts/run_rdagent.py`
- Modify: `backend/scripts/run_tradingagents.py`
- Modify: `backend/app/services/strategy_factory.py`
- Test: `backend/tests/test_strategy_factory_runtime.py`

- [ ] **Step 1: Write failing backend tests for vendored provider resolution and repo-owned defaults**

Add tests that prove:
- repo-owned provider directories are preferred over personal absolute paths
- default strategy-factory commands can point at repo-owned wrappers
- missing vendored repos produce truthful fallback reasons

- [ ] **Step 2: Run the strategy runtime test slice and confirm RED**

Run: `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py -k "vendored or resolution or missing" -v`
Expected: FAIL because vendored resolution and missing-repo messaging are not yet implemented consistently.

- [ ] **Step 3: Implement repo-owned provider resolution and truthful fallback handling**

Change `backend/scripts/run_rdagent.py` and `backend/scripts/run_tradingagents.py` to:
- resolve `backend/vendor/strategy_providers/...` first
- use env override second
- remove personal absolute-path assumptions

Change `backend/app/core/config.py` defaults so strategy commands use repo-owned launcher paths.

Change `backend/app/services/strategy_factory.py` so provider runtime reasons distinguish:
- repo missing
- malformed command
- missing interpreter script target
- docker unavailable
- subprocess failed

- [ ] **Step 4: Run the strategy runtime test slice and confirm GREEN**

Run: `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py -k "vendored or resolution or missing" -v`
Expected: PASS with truthful provider resolution behavior.

### Task 2: Capture Provider Invocation Evidence In Review Artifacts

**Files:**
- Modify: `backend/app/services/strategy_factory.py`
- Modify: `backend/app/models/strategy.py`
- Test: `backend/tests/test_strategy_factory_runtime.py`

- [ ] **Step 1: Write failing tests for provider invocation evidence capture**

Add tests that verify provider-backed generation writes:
- input JSON
- stdout file
- stderr file
- provider run metadata
- discovered provider artifacts

- [ ] **Step 2: Run the provider evidence test slice and confirm RED**

Run: `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py -k "evidence or stdout or stderr or metadata" -v`
Expected: FAIL because not all invocation audit files are guaranteed and asserted yet.

- [ ] **Step 3: Implement minimal artifact-capture changes**

Extend `StrategyFactoryService` so every external-provider run records invocation files into the artifact directory and exposes them through existing response models.

- [ ] **Step 4: Run the provider evidence test slice and confirm GREEN**

Run: `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py -k "evidence or stdout or stderr or metadata" -v`
Expected: PASS with audit files present and surfaced.

### Task 3: Keep Workflow Snapshot Correlated To Provider Lifecycle

**Files:**
- Modify: `backend/app/services/workflow.py`
- Modify: `backend/tests/test_workflow_runtime.py`

- [ ] **Step 1: Write failing workflow tests for strategy-stage provider truth**

Add tests asserting `/api/workflow/snapshot` reflects:
- configured vs effective provider
- running/failed/completed strategy lifecycle
- run-correlated strategy stage detail

- [ ] **Step 2: Run the workflow test slice and confirm RED**

Run: `python3 -m pytest -q backend/tests/test_workflow_runtime.py -k "strategy and provider" -v`
Expected: FAIL because workflow strategy-stage detail does not yet expose all desired provider truth consistently.

- [ ] **Step 3: Implement workflow-stage truth mapping**

Update `backend/app/services/workflow.py` so strategy-stage facts and detail better mirror provider runtime and generation state without changing the API shape unnecessarily.

- [ ] **Step 4: Run the workflow test slice and confirm GREEN**

Run: `python3 -m pytest -q backend/tests/test_workflow_runtime.py -k "strategy and provider" -v`
Expected: PASS with workflow snapshot aligned to provider lifecycle.

### Task 4: Document Repeatable Local Provider Installation

**Files:**
- Modify: `backend/README.md`
- Modify: `docs/runbooks/operator-runbook.md`

- [ ] **Step 1: Update backend setup docs**

Document:
- vendored provider directory convention
- env override escape hatches
- wrapper-based smoke commands
- truthful expectations for partial upstream automation

- [ ] **Step 2: Update operator runbook**

Document the same runtime contract for operators, including where to inspect generated artifacts and fallback reasons.

### Task 5: Create Reusable Workflow-Centered Dashboard Shells

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Create or Modify: `frontend/src/components/dashboard/*` as needed
- Test: `frontend/tests/release.spec.ts`
- Test: `frontend/tests/layout-regression.spec.ts`

- [ ] **Step 1: Write failing frontend tests for expanded workflow-centered page structure**

Add or tighten assertions that non-workflow sections expose:
- consistent page shell headings
- truth strip/runtime status surfaces
- no mobile overflow regressions

- [ ] **Step 2: Run the frontend regression slice and confirm RED**

Run: `cd frontend && npm run test -- --runInBand`
Expected: Either the targeted release/layout assertions fail or the command is unavailable and must be replaced by existing Playwright commands.

- [ ] **Step 3: Implement reusable workflow-centered section patterns**

Extend the dashboard so overview, strategy, operations, and diagnostics visually inherit the workflow-studio system:
- consistent section shell
- truth strip
- operator rail placement
- provider and audit cards

Keep the existing page architecture intact. Do not do a full redesign.

- [ ] **Step 4: Run the existing browser regression commands and confirm GREEN**

Run: `cd frontend && npm run e2e:release`
Expected: PASS with workflow page and surrounding dashboard sections still rendering correctly.

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend strategy and workflow test files**

Run: `python3 -m pytest -q backend/tests/test_strategy_factory_runtime.py backend/tests/test_workflow_runtime.py -v`
Expected: PASS

- [ ] **Step 2: Run broader backend regression**

Run: `python3 -m pytest -q backend/tests -v`
Expected: PASS or explicit list of unrelated pre-existing failures.

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 4: Run frontend release regression**

Run: `cd frontend && npm run e2e:release`
Expected: PASS or explicit browser-environment gap documented with evidence.

# Strategy Providers And Workflow Expansion Design

## Scope

This design covers two tightly related sub-projects that will be delivered in one execution pass:

1. make `RD-Agent(Q)` and `TradingAgents-CN` genuinely installable and callable from the backend strategy-factory workflow
2. extend the existing `工作流中枢` / workflow-studio visual language across the rest of the dashboard without losing runtime truth

The system must remain local-first, paper-first, and honest about degraded states. Optional research providers remain additive. The core trading loop must still function without them.

## Why This Work Exists

The repository already contains a partial strategy-factory seam and a strong workflow-centered UI. The remaining gap is not conceptual. It is operational:

- provider launchers still depend on personal absolute paths
- install and runtime expectations are not repo-owned or reproducible
- provider readiness is visible, but not yet trustworthy enough for repeated machine-to-machine setup
- the strongest visual/system narrative currently peaks on the workflow page instead of organizing the whole product

This work closes those gaps without changing the mandated stack or turning the project into a large redesign.

## Users And Product Intent

The primary user is a technical trader or builder operating a self-hosted quant workstation. They need a system that feels like one coherent operating surface rather than a collection of independent widgets. They also need strategy research integrations that are real when available, explicit when unavailable, and auditable when they fail.

The interface should feel like an operator command center: precise, legible, premium, and inspectable. The backend should feel deterministic and reproducible across machines.

## Architecture

### Provider Runtime Model

The backend keeps `StrategyFactoryService` as the single strategy-factory control plane. `RD-Agent(Q)` and `TradingAgents-CN` remain external providers behind repo-owned launcher scripts, environment-driven configuration, and the existing typed API models.

The runtime contract becomes:

- provider source code lives in a predictable repo-owned vendor location when bundled locally
- launcher scripts resolve vendored paths first, environment overrides second
- backend availability checks distinguish between `ready`, `fallback`, and `unavailable` based on concrete evidence
- generation attempts always produce an artifact directory containing the operator-facing review files plus invocation audit files

The backend does not pretend external research succeeded. If installation is present but execution fails, the API and workflow snapshot report `failed` with captured evidence.

### Provider Installation Contract

The repo defines one canonical provider root:

- `backend/vendor/strategy_providers/rdagent`
- `backend/vendor/strategy_providers/tradingagents_cn`

The runtime resolution order is:

1. repo-owned vendored provider directory
2. explicit `RDAGENT_REPO` / `TRADINGAGENTS_REPO`
3. fail availability check and surface fallback honestly

The default strategy-factory commands should invoke repo-owned launcher scripts rather than bare upstream console entrypoints. This keeps Compose, local venv, CI-like validation, and documentation aligned.

### Strategy Artifact Contract

Existing strategy artifacts stay in `var/strategy_factory/...` and continue to expose markdown/json/python review files. Each provider-backed run also writes:

- structured input payload used for invocation
- stdout capture
- stderr capture
- provider run metadata
- any provider-generated files discovered in the artifact directory

This preserves explainability and makes failures reviewable instead of opaque.

### Workflow Snapshot Contract

`/api/workflow/snapshot` remains the canonical frontend payload. It should show:

- configured provider
- effective provider
- readiness or fallback reason
- active generation phase
- run correlation through the existing run ledger

The strategy stage should reflect actual provider lifecycle, not just artifact existence.

## Frontend Design Direction

### Visual System

The existing workflow studio already defines the right product language:

- star-map / orchestration layout
- operator-grade runtime truth
- audit-forward cards
- status-rich, not marketing-rich, composition

The design change is not a site-wide rebrand. It is a systematization pass.

We treat workflow studio as the visual mother tongue and expand it into reusable dashboard patterns:

- section shell
- truth strip
- operator rail
- audit/provider/status cards
- linked deep-dive navigation between overview sections

### Page Model

The whole dashboard should read as one system at different zoom levels:

- `Overview` becomes the high-level story of current handoff, market route, execution route, and risk posture
- `Market` becomes the detailed readout for the market stage
- `Thesis` becomes the detailed readout for analysis roles and evidence
- `Strategy` becomes the detailed readout for strategy-factory providers, generated artifacts, and provider truth
- `Operations` becomes the detailed readout for execution, approvals, and operator controls
- `Diagnostics` becomes the detailed readout for degraded states, provider errors, and backend truth surfaces

Every page should preserve the same relationship between status, action, and evidence.

### Runtime Truth Rules

Visual polish must not hide runtime truth. The following states remain explicit and visually legible:

- `paper`
- `real`
- `mock`
- `fallback`
- `degraded`
- provider unavailable
- provider failed

No page should imply that a research provider is healthy just because the rest of the platform is healthy.

## Error Handling

### Backend

Provider readiness must fail for concrete reasons:

- vendored repo missing
- launcher import target missing
- docker unavailable for `RD-Agent(Q)`
- configured command malformed
- subprocess timeout
- subprocess non-zero exit

These reasons must flow into provider runtime models and strategy generation logs.

### Frontend

Dashboard sections should render incomplete provider states as first-class states, not blank areas. If a provider is unavailable, the user should still see:

- what was configured
- what was actually used
- why fallback happened
- where artifacts or logs live when a run happened

## Validation Standard

This work is complete only if all of the following are true:

1. backend can resolve vendored or environment-provided `RD-Agent(Q)` and `TradingAgents-CN)` without personal machine paths
2. backend strategy status shows truthful readiness/fallback/failure states for both providers
3. strategy generation captures provider invocation evidence in artifact directories
4. workflow snapshot reflects real strategy-provider lifecycle through the existing stage model
5. frontend extends workflow-centered presentation across the remaining dashboard sections without hiding truth states
6. backend strategy runtime tests pass
7. frontend regression/build validation passes

## Out Of Scope

- making either upstream provider a required dependency for the core platform
- replacing PrimoAgent as the main decision layer
- converting the dashboard into a brand-new navigation architecture
- hiding degraded states for aesthetic reasons
- guaranteeing that all upstream provider-specific research modes work without additional external model credentials

## Delivery Approach

Delivery proceeds in this order:

1. stabilize provider resolution and launcher behavior
2. strengthen backend provider truth reporting and artifact capture
3. validate provider runtime with targeted tests and local smoke commands
4. extend workflow-centered layout primitives across remaining dashboard sections
5. run backend tests, frontend tests, and build verification

This keeps the platform usable at every stage and avoids a large all-or-nothing rewrite.

# Phase 3 PrimoAgent Core Graph Design

**Date:** 2026-04-01  
**Phase:** 3 — PrimoAgent Core Graph  
**Status:** approved for autonomous execution

## Goal

Deliver a typed, explainable multi-agent analysis workflow that can run locally in mock mode or through an OpenAI-compatible provider without changing the frontend contract.

## Chosen Approach

Use a backend-only Phase 3 implementation with four explicit roles — `data`, `technical_analysis`, `news_geopolitics`, and `risk_decision` — behind a narrow provider abstraction.

Why this approach:

- preserves the PrimoAgent role boundary required by the product brief
- keeps every role output typed, inspectable, and auditable
- lets the system stay runnable when external AI credentials are missing or a provider fails
- reuses the Phase 2 event backbone instead of creating a separate agent transport path

## Alternatives Considered

### 1. Recommended: typed role graph + provider adapter + shared event bus

Pros:
- cleanly matches roadmap requirements
- easy to test locally
- supports future execution/risk phases without API churn

Cons:
- requires a small refactor to generalize the event flow beyond market-only events

### 2. Single monolithic analysis endpoint without role isolation

Pros:
- fastest to implement

Cons:
- violates the PrimoAgent role requirement
- loses inspectability and per-role reasoning metadata
- makes future risk gating and evidence presentation harder

### 3. Full scheduler + news ingestion in Phase 3

Pros:
- more feature-complete immediately

Cons:
- overreaches the phase boundary
- adds external dependencies before execution and risk layers exist
- would force premature decisions about news sourcing better handled later

## Architecture

### Core services

- `EventBus`: shared JSONL + websocket publication layer for market and agent events
- `MarketRuntimeService`: continues to own normalized market snapshots and can supply a targeted snapshot for analysis requests
- `ProviderFactory`: resolves `mock` or `openai_compatible` providers from env config
- `AnalysisService`: orchestrates the four PrimoAgent roles, persists latest results, and publishes role/run events

### Contracts

- `AnalysisRunRequest`: selected symbol, timeframe, optional operator notes
- `AgentAnalysisResult`: role, status, provider, model, confidence, rationale, evidence, recommendation
- `AnalysisRunResult`: run metadata, market snapshot, all role outputs, overall recommendation

## API Surface

- `POST /api/analysis/run` — trigger a manual multi-agent analysis
- `GET /api/analysis/latest?symbol=...&timeframe=...` — read the latest stored run for a market key
- `/api/events/recent` and `/ws` continue to expose the shared event stream, now including agent events

## Error Handling

- missing or partial provider config downgrades to mock mode with explicit warning events
- per-role provider failures fall back to mock output for that role instead of failing the entire run
- missing market snapshot for a requested key triggers an on-demand snapshot fetch through the market service

## Testing Plan

- backend test for manual run returning all four roles
- backend test for latest-analysis retrieval
- backend test for provider selection when OpenAI-compatible config is present
- backend test for provider failure fallback to mock outputs

## Deferred

- live news ingestion and source-linked macro evidence
- scheduled background analysis cadence
- frontend rendering of per-role analysis cards
- execution handoff from risk decision into orders

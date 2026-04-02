# Phase 3: PrimoAgent Core Graph - Research

**Date:** 2026-04-01
**Status:** Complete
**Confidence:** High

## Objective

Research how to add a typed PrimoAgent workflow without breaking the Phase 2 local-first runtime, replay/debug path, or safe startup behavior.

## What Matters For Planning

### 1. Role isolation matters more than raw model capability

The phase requirement is not "call one model"; it is "run a PrimoAgent workflow with distinct roles." The implementation should preserve role boundaries even if the initial provider is lightweight or mocked.

### 2. Provider abstraction must stay narrow

A small adapter around prompt-in, typed-JSON-out is enough for Phase 3. Avoid a heavyweight SDK dependency or provider-specific payload shape leaking into routes.

### 3. Shared event flow is the right leverage point

Market events and agent-analysis events need the same local replay and websocket properties. A shared event bus avoids duplicating persistence/broadcast logic and prepares later phases for risk and execution events.

### 4. Mock fallback is non-negotiable

The platform must remain locally runnable without secrets. That means provider selection can never make Phase 3 startup brittle. Missing credentials or upstream provider failures should degrade to explicit mock outputs plus warning events.

### 5. Manual triggering is enough for the first slice

Scheduled orchestration can wait. The critical proof for this phase is: selected symbol in, four inspectable role outputs out, latest result retrievable, and all activity visible in the event stream.

## Recommended Build Order

1. Extend env/runtime config for OpenAI-compatible providers
2. Generalize the event path into a shared event bus
3. Define typed analysis models and the provider factory
4. Implement the AnalysisService role graph and manual/latest APIs
5. Add tests for role outputs, latest retrieval, provider selection, and fallback behavior

## Key Risks

- Letting provider-specific response parsing leak into the rest of the backend
- Pretending to have live macro/news evidence before that subsystem exists
- Breaking Phase 2 routes while refactoring event publication

## Recommendation

Implement a conservative Phase 3 slice: typed backend models, shared event bus, four-role orchestration, OpenAI-compatible provider support, and deterministic mock fallback. This satisfies the roadmap while keeping execution, risk, and richer evidence layers free to grow later.

## RESEARCH COMPLETE

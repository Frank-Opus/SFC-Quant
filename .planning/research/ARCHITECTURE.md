# Architecture Research

**Domain:** standalone AI-agent quantitative trading platform
**Researched:** 2026-04-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Dashboard                      │
├─────────────────────────────────────────────────────────────┤
│  React + Tremor + Lightweight Charts + Motion UI           │
│  KPI cards | charts | logs | controls | heatmap | radar    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST + WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│                   FastAPI Control Plane                     │
├─────────────────────────────────────────────────────────────┤
│  API routes | WS hub | auth-free local session model       │
│  provider adapters | orchestration service | state cache   │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
┌───────────────▼──────────────┐  ┌─────▼────────────────────┐
│    PrimoAgent Orchestrator   │  │    Execution / Risk      │
├──────────────────────────────┤  ├──────────────────────────┤
│ data agent                   │  │ risk policy engine       │
│ technical analysis agent     │  │ trade approval gate      │
│ news / geopolitics agent     │  │ Freqtrade adapter        │
│ decision agent               │  │ order / fill monitor     │
└───────────────┬──────────────┘  └─────┬────────────────────┘
                │                        │
┌───────────────▼────────────────────────▼────────────────────┐
│                 Data + External Integrations               │
├─────────────────────────────────────────────────────────────┤
│  ccxt exchanges | Freqtrade | LLM providers | news feeds   │
│  local persistence | replay logs | strategy artifacts       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| FastAPI control plane | Single backend API surface for UI, orchestration, and lifecycle control | REST routes + WebSocket manager + service layer |
| PrimoAgent orchestrator | Produce explainable market analysis and trade proposals | LangGraph/PrimoAgent graph with typed role outputs |
| Risk engine | Enforce pre-trade and run-time risk rules | Policy service + kill switch + approval checks |
| Freqtrade adapter | Translate approved signals into executable orders and state | Thin service around Freqtrade config/process hooks |
| Event store / replay | Persist signal, trade, and agent events for UI and debugging | Lightweight DB/file-backed event log |
| React dashboard | Present trading state and controls to operator | SPA with streaming hooks and chart components |

## Recommended Project Structure

```text
backend/
├── app/
│   ├── api/                # REST and WebSocket endpoints
│   ├── agents/             # PrimoAgent role graph and prompts
│   ├── providers/          # LLM provider adapters
│   ├── execution/          # Freqtrade / ccxt adapters
│   ├── risk/               # Risk policies and approval rules
│   ├── data/               # Market/news ingestion and normalization
│   ├── schemas/            # Pydantic contracts
│   ├── services/           # Application orchestration
│   └── storage/            # Event/state persistence
├── tests/
└── Dockerfile

frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/      # KPI cards, layouts, control surfaces
│   │   ├── charts/         # Lightweight Charts wrappers
│   │   ├── logs/           # Signal feed and timeline blocks
│   │   └── visuals/        # Heatmap, radar, animated indicators
│   ├── hooks/              # WebSocket and data hooks
│   ├── lib/                # UI utilities and mock data adapters
│   ├── pages/
│   └── styles/
├── public/
└── Dockerfile

strategies/
├── generated/              # Optional RD-Agent outputs
└── reviewed/               # Human-approved strategies
```

### Structure Rationale

- **`backend/app/`**: keeps orchestration, execution, risk, and adapters separated without forcing microservices.
- **`frontend/src/components/`**: preserves domain-oriented UI composition and avoids a monolithic `App.tsx`.
- **`strategies/`**: gives RD-Agent outputs a reviewable workspace instead of letting generated artifacts leak into runtime modules.

## Architectural Patterns

### Pattern 1: Control Plane + Managed Worker

**What:** FastAPI owns lifecycle and state; execution runs through a managed Freqtrade integration boundary.
**When to use:** When one service must expose UI APIs and supervise trading state.
**Trade-offs:** Simpler local deploy; slightly tighter coupling than a separate execution service.

**Example:**
```python
decision = orchestration_service.evaluate(symbol)
approved = risk_service.approve(decision)
if approved:
    execution_service.submit(decision)
```

### Pattern 2: Event-First UI Streaming

**What:** Backend publishes normalized events to a WebSocket hub; frontend builds live views from a single event stream.
**When to use:** When multiple widgets must stay synchronized without polling.
**Trade-offs:** Requires disciplined event schemas; pays off quickly for dashboards.

**Example:**
```typescript
socket.onmessage = (event) => {
  const payload = JSON.parse(event.data)
  updateDashboardState(payload)
}
```

### Pattern 3: Provider Adapter Boundary

**What:** Agent orchestration talks to a provider interface, not directly to one AI SDK.
**When to use:** When supporting third-party AI providers is a product requirement.
**Trade-offs:** Slightly more abstraction work up front; much easier vendor flexibility later.

## Data Flow

### Request Flow

```text
[User action]
    ↓
[React control] → [FastAPI endpoint] → [Service layer] → [Agent / Risk / Execution]
    ↓                                                        ↓
[WS update] ← [Event serializer] ← [State store] ← [Trade / Signal result]
```

### State Management

```text
[WebSocket stream]
    ↓
[Frontend dashboard store]
    ↓
[Cards / charts / logs / heatmap / radar]
```

### Key Data Flows

1. **Market-analysis flow:** Exchange/news inputs → data normalization → PrimoAgent roles → decision package.
2. **Execution flow:** Decision package → risk approval → Freqtrade adapter → exchange/order state → UI stream.
3. **Replay/debug flow:** Signals and trades → event persistence → later replay/testing views.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Solo developer / local workstation | Single backend container + SPA frontend is correct |
| Small team / shared staging | Add Postgres and centralized logs first |
| Larger hosted usage | Split execution supervision, persistence, and API surfaces only after operational pain appears |

### Scaling Priorities

1. **First bottleneck:** Event persistence and replay queries — solve with a proper database before splitting services.
2. **Second bottleneck:** AI/provider latency — solve with queueing, caching, and asynchronous agent runs before re-architecting the UI.

## Anti-Patterns

### Anti-Pattern 1: Letting the UI talk directly to exchange or AI providers

**What people do:** Put provider/exchange calls in the browser for speed.
**Why it's wrong:** Leaks credentials, breaks auditability, and fragments state.
**Do this instead:** Route everything through the FastAPI control plane.

### Anti-Pattern 2: Treating Freqtrade as the whole backend

**What people do:** Expose raw bot internals directly to the dashboard.
**Why it's wrong:** UI contracts become brittle and agent orchestration has nowhere to live.
**Do this instead:** Wrap Freqtrade behind explicit execution services and schemas.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AI providers | Adapter interface inside backend | Required for third-party provider support |
| Exchanges | ccxt + Freqtrade execution boundary | Keep API keys server-side only |
| News / macro sources | Pull into data normalization layer | Preserve provenance for explainability |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ FastAPI | REST + WebSocket | Single external API surface |
| Agents ↔ Risk engine | Typed decision package | Risk must be able to veto or request adjustment |
| Risk ↔ Execution | Approved trade intent | No order submission without this boundary |

## Sources

- PrimoAgent repository and LangGraph positioning
- Freqtrade architecture and dry-run/live-trading documentation
- The user brief, which fixes backend/frontend/execution boundaries

---
*Architecture research for: standalone AI-agent quantitative trading platform*
*Researched: 2026-04-01*

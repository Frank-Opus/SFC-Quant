# Stack Research

**Domain:** standalone AI-agent quantitative trading platform
**Researched:** 2026-04-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12.x | Backend runtime and integration layer | Best fit for PrimoAgent, Freqtrade, ccxt, FastAPI, and optional RD-Agent(Q) in one ecosystem |
| PrimoAgent | Pin to repository commit on `main` | Multi-agent orchestration for research and decisions | Required by brief; keeps explicit multi-agent roles instead of a monolithic prompt chain |
| FastAPI | 0.135.2 | Control-plane API and WebSocket server | Fast, type-safe, async-friendly, and the de facto standard for Python service APIs |
| Freqtrade | 2025.6 | Strategy execution, exchange integration, dry-run/live trading | Mature open-source trading engine with dry-run, backtesting, and operational guardrails already built |
| ccxt | 4.5.46 | Normalized exchange data and order routing abstraction | Standard exchange adapter layer and the dependency Freqtrade users already expect |
| React | 19.2.4 | Frontend UI runtime | Mature ecosystem and strong support for the requested dashboard component stack |
| Vite | 8.0.3 | Frontend build/dev tooling | Fast local iteration, simple configuration, and excellent fit for a standalone dashboard app |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tremor/react | 3.18.7 | KPI cards, data blocks, dashboard primitives | Use for PnL/risk/exposure summaries and structured financial overview sections |
| lightweight-charts | 5.1.0 | Real-time trading charts | Use for P&L curves, price charts, and trade/signal overlays |
| tailwindcss | 4.2.2 | Utility-first styling system | Use for the dashboard shell, glassmorphism surfaces, spacing, and responsive layout |
| framer-motion | 12.38.0 | Motion system | Use for staggered state transitions, signal log animations, and card micro-interactions |
| @radix-ui/react-dialog | 1.1.15 | Headless primitives under shadcn/ui | Use for safe, accessible control dialogs like “Enable Live Trading” |
| lucide-react | 1.7.0 | Icon set | Use for signal status, execution state, and dashboard affordances |
| shadcn CLI | 4.1.2 | Component scaffolding workflow | Use to scaffold composable UI primitives without adopting a heavy component framework |
| uvicorn | 0.42.0 | ASGI runtime | Use to run FastAPI locally and in containers |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose v2 | One-command startup for backend and frontend | Keep the default topology to two services for local developer ergonomics |
| pytest | Backend test runner | Use for API, orchestration, and adapter contract tests |
| Vitest + Testing Library | Frontend unit/integration tests | Enough for the dashboard and WebSocket client without adding Jest complexity |
| Ruff | Python lint/format | Keeps the backend fast to lint and consistent in CI |
| ESLint + TypeScript | Frontend static analysis | Required to keep the dashboard code disciplined as complexity grows |

## Installation

```bash
# Backend core
pip install "fastapi==0.135.2" "uvicorn[standard]==0.42.0" "freqtrade==2025.6" "ccxt==4.5.46"

# Frontend core
npm install react@19.2.4 react-dom@19.2.4 vite@8.0.3
npm install @tremor/react@3.18.7 lightweight-charts@5.1.0 tailwindcss@4.2.2 framer-motion@12.38.0
npm install @radix-ui/react-dialog@1.1.15 lucide-react@1.7.0

# Optional strategy factory
pip install rd-agent
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| FastAPI | Django / Flask | Only if the project expands into a multi-tenant web product with heavier server-rendered concerns |
| Freqtrade + ccxt | Pure custom execution service | Only if future exchange workflows exceed Freqtrade’s abstractions and justify the operational burden |
| Vite + React SPA | Next.js / Remix | Only if the product later needs SEO-heavy public pages or server-rendered marketing surfaces |
| Lightweight Charts | Proprietary chart SDKs | Only if advanced broker widgets become a hard requirement and licensing is acceptable |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A single opaque “AI strategist” prompt | Kills explainability and weakens risk traceability | Explicit PrimoAgent role graph with per-agent outputs |
| Direct exchange SDK sprawl | Multiplies maintenance and breaks exchange portability | ccxt behind a stable execution adapter |
| Premature microservices | Adds local ops friction and complicates event ordering | One Python backend service with internal modules |
| Heavy SSR dashboard architecture | Unnecessary complexity for a trader workstation app | Vite SPA with WebSocket streaming |

## Stack Patterns by Variant

**If running local-only MVP:**
- Use SQLite or file-backed storage for app state and Freqtrade metadata
- Because this keeps the default compose footprint small and reproducible

**If moving to team or hosted deployments later:**
- Add Postgres for durable event/state persistence
- Because trade audit trails and replay queries become easier to manage centrally

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2.4 | Vite 8.0.3 | Standard modern SPA pairing |
| FastAPI 0.135.2 | Uvicorn 0.42.0 | Current ASGI pairing |
| Freqtrade 2025.6 | ccxt 4.5.46 | Freqtrade itself manages ccxt integration; pinning external adapter awareness still matters in the backend |

## Sources

- PrimoAgent GitHub repository — architecture and LangGraph-based agent positioning
- Freqtrade official docs / package release line — dry-run/live-trading execution model
- PyPI package indexes for FastAPI, Uvicorn, Freqtrade, and ccxt — version verification
- npm package registry for React, Vite, Tremor, Lightweight Charts, Tailwind, Framer Motion, Radix, Lucide, and shadcn — version verification

---
*Stack research for: standalone AI-agent quantitative trading platform*
*Researched: 2026-04-01*

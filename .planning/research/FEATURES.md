# Feature Research

**Domain:** standalone AI-agent quantitative trading platform
**Researched:** 2026-04-01
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paper trading mode | Traders need safe validation before risking capital | MEDIUM | Must mirror live execution paths as closely as possible |
| Exchange connectivity via standardized adapters | Users expect common exchange support without bespoke setup | MEDIUM | ccxt covers this; credentials stay server-side |
| Real-time position / P&L dashboard | Trading tools feel broken without live state | MEDIUM | KPI cards + charts + signal stream are baseline |
| Strategy/risk controls | Users expect max loss, size, and pause controls | MEDIUM | Hard gate before live mode |
| Explainable signals | AI-driven trading is untrustworthy without rationale | HIGH | Agent-by-agent reasoning is part of the product promise |
| Live log and status stream | Operators need to see what the system is doing now | LOW | WebSocket event stream is enough for v1 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PrimoAgent multi-role decision graph | Makes the system feel like a real agent desk, not a single bot | HIGH | Core differentiator and mandatory by brief |
| News + geopolitics agent fusion | Connects event context to price signals | HIGH | Strong product story if done with clear provenance |
| Glassmorphism trader dashboard with animated operator controls | Creates a premium “desk terminal” feel | MEDIUM | Requested explicitly; should not compromise readability |
| Factor radar + position heatmap | Gives richer portfolio intuition than plain tables | MEDIUM | Strong visual differentiator for the frontend |
| Optional RD-Agent(Q) strategy factory | Turns the platform into a strategy lab, not just an executor | HIGH | Optional in v1, useful as an extension point |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous live trading with no approval path | Sounds powerful and “AI-native” | Too dangerous for an open-source local-first v1 and violates safe-ops principles | Explicit live-mode enablement plus risk-agent gating |
| HFT / microsecond execution | Impressive on paper | Completely mismatched to Python, Freqtrade, and retail exchange APIs | Focus on swing/intraday system trading with explainability |
| Multi-tenant SaaS accounts | Common product instinct | Bloats scope into auth, tenancy, billing, and compliance work | Stay single-operator local-first for v1 |
| Massive microservice topology | Feels “serious” | Kills local deploy simplicity and slows iteration | Single backend service with internal modules |

## Feature Dependencies

```text
[Live Trading]
    └──requires──> [Risk Guardrails]
                       └──requires──> [Execution Adapter]
                                              └──requires──> [Market Data + Signals]

[Glass Dashboard] ──enhances──> [Real-time Trading State]

[RD-Agent Strategy Factory] ──enhances──> [Strategy Workspace]

[Opaque AI Decision] ──conflicts──> [Explainable Agent Rationale]
```

### Dependency Notes

- **Live Trading requires Risk Guardrails:** live mode must never ship before explicit kill-switches and max-loss policies exist.
- **Execution Adapter requires Market Data + Signals:** there is no trade engine without normalized market inputs and decision outputs.
- **Glass Dashboard enhances Real-time Trading State:** the visuals are valuable only if backed by streaming truth.
- **Opaque AI Decision conflicts with Explainable Agent Rationale:** the product promise breaks if decisions cannot be inspected.

## MVP Definition

### Launch With (v1)

- [ ] Multi-agent PrimoAgent orchestration with visible role outputs — core product identity
- [ ] Freqtrade-backed paper trading — minimum safe execution loop
- [ ] WebSocket-powered live dashboard — operator usability baseline
- [ ] Risk controls and live-trading gate — mandatory safety boundary
- [ ] Docker Compose local deployment — required by brief

### Add After Validation (v1.x)

- [ ] RD-Agent(Q) strategy generation — add once core agent/execution loop is stable
- [ ] Richer news/geopolitics ingestion and provenance panels — add after the core signal loop proves useful
- [ ] Enhanced trade replay / signal timeline — add when users want post-trade analysis

### Future Consideration (v2+)

- [ ] Multi-user workspaces — defer until local-first single-operator flow is validated
- [ ] Mobile companion app — defer until the desktop dashboard is proven
- [ ] Broker/exchange portfolio aggregation beyond Freqtrade scope — defer until execution architecture needs it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Paper trading with Freqtrade | HIGH | MEDIUM | P1 |
| PrimoAgent role graph | HIGH | HIGH | P1 |
| Real-time dashboard shell | HIGH | MEDIUM | P1 |
| Risk guardrails + live-mode gating | HIGH | MEDIUM | P1 |
| Position heatmap / factor radar | MEDIUM | MEDIUM | P2 |
| RD-Agent strategy factory | MEDIUM | HIGH | P2 |
| Multi-tenant auth/accounts | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Execution engine | Quant bots often hide logic behind generic signals | Traditional traders see execution but not AI reasoning | Pair visible agent reasoning with a known open-source execution engine |
| UI quality | Many open-source quant UIs are utilitarian | Many charting tools lack orchestration visibility | Make the operator dashboard a first-class differentiator |
| Strategy generation | Often disconnected from execution | Often disconnected from UI | Keep RD-Agent optional but wire output into the same workspace |

## Sources

- Freqtrade ecosystem expectations and dry-run/live workflows
- Lightweight Charts / dashboard library ecosystem norms
- The user brief, which explicitly defines the product’s differentiators and constraints

---
*Feature research for: standalone AI-agent quantitative trading platform*
*Researched: 2026-04-01*

# Pitfalls Research

**Domain:** standalone AI-agent quantitative trading platform
**Researched:** 2026-04-01
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: AI opinions that cannot be executed safely

**What goes wrong:**
The agent graph produces interesting narrative analysis but no structured, risk-checkable trade intent.

**Why it happens:**
Teams optimize for impressive reasoning text instead of a decision schema that execution and risk systems can consume.

**How to avoid:**
Define a typed decision contract early: symbol, side, confidence, rationale, invalidation, sizing hint, and risk tags.

**Warning signs:**
Signals are human-readable only; the risk engine cannot deterministically approve or reject them.

**Phase to address:**
Phase 3: PrimoAgent Core Graph

---

### Pitfall 2: Paper trading and live trading diverge too much

**What goes wrong:**
The dashboard looks fine in simulation, but real order state behaves differently and exposes hidden assumptions.

**Why it happens:**
Teams use mock execution paths that do not preserve Freqtrade/ccxt semantics.

**How to avoid:**
Run paper mode through the same execution adapter and event model that will later front live mode.

**Warning signs:**
Different code paths for paper and live, or UI fields that only exist in mock mode.

**Phase to address:**
Phase 4: Execution Engine & Paper Trading

---

### Pitfall 3: Risk controls exist in the UI but not in the execution path

**What goes wrong:**
Users can set max-loss and exposure controls, but orders still route around them.

**Why it happens:**
Risk logic gets implemented as frontend validation or advisory messaging instead of a hard server-side gate.

**How to avoid:**
Make the risk engine a required pre-submit step and add a circuit breaker that can halt execution globally.

**Warning signs:**
Changing a risk control never changes backend behavior; live-mode enablement has no irreversible audit event.

**Phase to address:**
Phase 5: Risk Guardrails & Live-Trade Gates

---

### Pitfall 4: Real-time dashboard drift

**What goes wrong:**
Cards, charts, and logs disagree because each widget polls or transforms state differently.

**Why it happens:**
The UI lacks a single event stream and normalized frontend store.

**How to avoid:**
Use one WebSocket event contract, derive all widgets from it, and surface connection health explicitly.

**Warning signs:**
P&L in the chart does not match KPI cards, or reconnect events silently duplicate state.

**Phase to address:**
Phase 6-7: Dashboard + Advanced Visual Analytics

---

### Pitfall 5: UI polish overwhelms operator clarity

**What goes wrong:**
The dashboard is visually impressive but hard to read under fast-changing market conditions.

**Why it happens:**
Animation and glass effects are treated as the goal instead of operator comprehension.

**How to avoid:**
Use motion for hierarchy and state change only, preserve contrast, and keep decision-critical surfaces stable.

**Warning signs:**
Important actions move around, logs are hard to scan, or charts lose readability under overlays.

**Phase to address:**
Phase 6-7: Dashboard + Advanced Visual Analytics

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Fake execution service unrelated to Freqtrade | Faster UI demo | Rework when real execution begins | Never for this project |
| Hard-coded AI provider calls | Faster first integration | Vendor lock-in and config sprawl | Only in a throwaway spike, not in mainline code |
| Storing raw secrets in committed config files | Easy onboarding | Severe security risk | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Freqtrade | Treating it as a passive library without lifecycle supervision | Wrap it in a backend-managed adapter/process boundary |
| ccxt | Mixing exchange-specific symbols and normalized symbols in UI/business logic | Normalize identifiers at the backend edge |
| AI providers | Assuming every provider supports the same model features or response shape | Hide providers behind one adapter contract and capability map |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Over-broadcasting full snapshots over WebSocket | UI becomes jittery and bandwidth-heavy | Stream incremental events plus periodic checkpoints | Breaks quickly with multiple symbols and logs |
| Recomputing chart series from scratch on every tick | Chart lag and React render churn | Append incremental points and memoize transformations | Breaks at moderate tick/update volume |
| Synchronous provider calls in the request path | Slow controls and stalled UI | Push long-running analysis into async service tasks | Breaks once multiple agents/providers are enabled |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing exchange or provider keys to frontend bundles | Credential compromise | Keep all credentials server-side and inject via backend env |
| Allowing live mode without explicit operator confirmation | Unintended real trades | Require server-side live-mode toggle with visible confirmation |
| Mixing paper and live credentials/config in one unchecked profile | Wrong-account execution | Separate config scopes and highlight current mode everywhere |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hiding agent uncertainty | Traders over-trust the output | Show confidence, risk tags, and rationale per agent |
| Burying kill switch controls | Operators cannot react fast under stress | Keep pause/resume and risk status persistent in the top-level dashboard |
| Overloading a single chart panel | Important signals get lost | Split primary price/P&L charts from auxiliary analytics panels |

## "Looks Done But Isn't" Checklist

- [ ] **Paper trading:** Often missing realistic order lifecycle states — verify pending/open/filled/cancelled all stream correctly
- [ ] **Risk controls:** Often missing server-side enforcement — verify bad trades are blocked in backend tests
- [ ] **Dashboard:** Often missing reconnect handling — verify WebSocket drops are visible and recover cleanly
- [ ] **AI providers:** Often missing provider capability fallback — verify the app runs when one provider is unavailable

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Paper/live divergence | HIGH | Unify execution adapter, replay events, and revalidate end-to-end |
| Non-actionable agent outputs | MEDIUM | Introduce typed decision schema and rewire risk/execution contracts |
| Dashboard state drift | MEDIUM | Normalize the event model and rebuild widgets from one state store |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI opinions that cannot be executed safely | Phase 3 | Agent outputs conform to typed decision schema |
| Paper/live divergence | Phase 4 | Same adapter path powers dry-run and live-mode staging |
| Risk controls bypassed | Phase 5 | Invalid orders are rejected in backend tests and UI demos |
| Dashboard state drift | Phase 6-7 | KPI, charts, and logs reflect the same event stream |
| UI polish over clarity | Phase 6-7 | Critical operator tasks stay legible during live updates |

## Sources

- Freqtrade operational expectations for dry-run/live trading
- The user brief’s safety and UI emphasis
- Common open-source trading-system failure modes inferred from the execution and dashboard architecture

---
*Pitfalls research for: standalone AI-agent quantitative trading platform*
*Researched: 2026-04-01*

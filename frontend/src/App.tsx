import { useMemo } from "react";

import { useMarketRuntime } from "./hooks/useMarketRuntime";

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVolume(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function describeEvent(event: { event_type: string; payload: Record<string, unknown> }): string {
  if (event.event_type === "system.warning") {
    return String(event.payload.message ?? "Runtime warning");
  }

  if (event.event_type === "system.connected") {
    return "Realtime session established.";
  }

  if (event.event_type === "market.snapshot") {
    return "Initial market snapshot loaded.";
  }

  if (event.event_type === "market.tick") {
    const symbol = String(event.payload.symbol ?? "UNKNOWN");
    const timeframe = String(event.payload.timeframe ?? "1m");
    const lastPrice = Number(event.payload.last_price ?? 0);
    return `${symbol} ${timeframe} updated to ${formatPrice(lastPrice)}`;
  }

  return "Unknown backend event";
}

export default function App() {
  const { snapshot, connectionStatus, eventFeed } = useMarketRuntime();

  const marketCards = useMemo(
    () =>
      snapshot.snapshots.map((item) => {
        const latestCandle = item.candles[item.candles.length - 1];
        return {
          ...item,
          latestCandle,
        };
      }),
    [snapshot.snapshots],
  );

  const connectionLabel =
    connectionStatus === "live"
      ? "Live"
      : connectionStatus === "connecting"
        ? "Connecting"
        : connectionStatus === "closed"
          ? "Closed"
          : "Fallback";

  return (
    <main className="app-shell phase-two-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Phase 2 / Market Data & Event Backbone</p>
          <h1>Realtime market telemetry for the local-first quant stack.</h1>
          <p className="lede">
            The shell now proves normalized market snapshots, replayable event logs, and
            WebSocket-driven frontend updates without polling.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="status-chip" data-state={connectionStatus}>
            <span className="status-dot" />
            {connectionLabel}
          </div>
          <div className="metric-stack">
            <span className="label">Runtime Mode</span>
            <strong>{snapshot.runtime.runtime_mode}</strong>
          </div>
          <div className="metric-stack">
            <span className="label">Exchange Surface</span>
            <strong>{snapshot.runtime.exchange_id}</strong>
          </div>
          <div className="metric-stack">
            <span className="label">Live Trading</span>
            <strong>{snapshot.runtime.live_trading_enabled ? "Enabled" : "Disabled"}</strong>
          </div>
        </div>
      </section>

      <section className="panel-grid">
        <article className="runtime-panel market-overview">
          <header className="panel-header">
            <div>
              <span className="label">Market Coverage</span>
              <h2>Normalized snapshots</h2>
            </div>
            <span className="panel-badge">{marketCards.length} streams</span>
          </header>

          <div className="market-grid">
            {marketCards.map((item) => (
              <article className="ticker-card" key={`${item.symbol}:${item.timeframe}`}>
                <div className="ticker-topline">
                  <span>{item.symbol}</span>
                  <span>{item.timeframe}</span>
                </div>
                <strong className="ticker-price">{formatPrice(item.last_price)}</strong>
                <div className="ticker-meta">
                  <span data-positive={item.change_percent >= 0}>
                    {item.change_percent >= 0 ? "+" : ""}
                    {item.change_percent.toFixed(2)}%
                  </span>
                  <span>24h vol {formatVolume(item.volume_24h)}</span>
                </div>
                {item.latestCandle ? (
                  <dl className="candle-strip">
                    <div>
                      <dt>O</dt>
                      <dd>{formatPrice(item.latestCandle.open)}</dd>
                    </div>
                    <div>
                      <dt>H</dt>
                      <dd>{formatPrice(item.latestCandle.high)}</dd>
                    </div>
                    <div>
                      <dt>L</dt>
                      <dd>{formatPrice(item.latestCandle.low)}</dd>
                    </div>
                    <div>
                      <dt>C</dt>
                      <dd>{formatPrice(item.latestCandle.close)}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="runtime-panel event-panel">
          <header className="panel-header">
            <div>
              <span className="label">Event Backbone</span>
              <h2>Replay + stream tape</h2>
            </div>
            <span className="panel-badge">{eventFeed.length} recent frames</span>
          </header>

          <div className="event-feed">
            {eventFeed.map((event) => (
              <article className="event-row" key={`${event.event_id}-${event.generated_at}`}>
                <div className="event-head">
                  <span className="event-type">{event.event_type}</span>
                  <span>{new Date(event.generated_at).toLocaleTimeString()}</span>
                </div>
                <p>{describeEvent(event)}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="runtime-panel diagnostics-panel">
        <header className="panel-header">
          <div>
            <span className="label">Diagnostics</span>
            <h2>Operator clarity stays explicit</h2>
          </div>
        </header>

        <div className="diagnostics-grid">
          <div className="metric-stack">
            <span className="label">AI Provider</span>
            <strong>{snapshot.runtime.ai_provider}</strong>
          </div>
          <div className="metric-stack">
            <span className="label">Backend Status</span>
            <strong>{snapshot.runtime.status}</strong>
          </div>
          <div className="metric-stack">
            <span className="label">Warnings</span>
            <strong>{snapshot.runtime.warnings.length}</strong>
          </div>
        </div>

        {snapshot.runtime.warnings.length > 0 ? (
          <div className="warning-list">
            {snapshot.runtime.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : (
          <p className="quiet-copy">
            No runtime warnings. Mock-safe telemetry is flowing through the same contracts
            future agents and execution services will consume.
          </p>
        )}
      </section>
    </main>
  );
}

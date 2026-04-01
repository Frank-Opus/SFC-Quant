import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { ProgressCircle } from "@tremor/react/dist/components/vis-elements/ProgressCircle/ProgressCircle";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Cable,
  Flame,
  Gauge,
  Play,
  Radar,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PnlChart } from "./components/dashboard/pnl-chart";
import { FactorRadar, type RadarAxis } from "./components/dashboard/factor-radar";
import { PositionsHeatmap, type HeatmapCell } from "./components/dashboard/positions-heatmap";
import { PriceChart, type PriceMarker } from "./components/dashboard/price-chart";
import { SignalLog } from "./components/dashboard/signal-log";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { useMarketRuntime } from "./hooks/useMarketRuntime";
import type { AgentAnalysisResult, EventEnvelope, ExecutionOrder, MarketSnapshot } from "./lib/market";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function describeEvent(event: EventEnvelope): string {
  const payload = event.payload;

  switch (event.event_type) {
    case "system.warning":
      return String(payload.message ?? "Runtime warning surfaced.");
    case "system.connected":
      return "Realtime session established.";
    case "market.snapshot":
      return "Market snapshot refreshed from backend runtime.";
    case "market.tick":
      return `${String(payload.symbol ?? "Market")} ${String(payload.timeframe ?? "1m")} tick updated.`;
    case "agent.analysis.requested":
      return `Analysis requested for ${String(payload.symbol ?? "selected instrument")}.`;
    case "agent.analysis.completed":
      return `PrimoAgent completed ${String(payload.symbol ?? "instrument")} analysis.`;
    case "execution.signal.approved":
      return `Signal approved for ${String(payload.symbol ?? "instrument")} ${String(payload.side ?? "")}.`;
    case "execution.signal.blocked":
    case "execution.signal.skipped":
      return String(payload.reason ?? "Signal did not become an order.");
    case "execution.order.filled":
      return `${String(payload.symbol ?? "Instrument")} ${String(payload.side ?? "order")} filled.`;
    case "execution.engine.paused":
      return String(payload.reason ?? "Execution engine paused.");
    case "execution.engine.resumed":
      return "Execution engine resumed.";
    case "risk.policy.updated":
      return "Risk guardrails updated.";
    case "risk.approval.denied":
      return `Risk approval denied for ${String(payload.symbol ?? "instrument")}.`;
    case "risk.approval.granted":
      return `Risk approval granted for ${String(payload.symbol ?? "instrument")}.`;
    case "risk.halt.triggered":
      return String(payload.reason ?? "Risk halt engaged.");
    case "risk.halt.cleared":
      return "Risk halt cleared.";
    case "risk.live_mode.enabled":
    case "risk.live_mode.disabled":
      return String(payload.message ?? "Live mode state updated.");
    default:
      return event.event_type;
  }
}

function computeRiskScore(args: {
  exposure: number;
  positionsCount: number;
  dailyRealizedPnl: number;
  policy: {
    max_position_notional_usd: number;
    max_concurrent_trades: number;
    daily_loss_limit_usd: number;
  };
  warnings: number;
  halted: boolean;
  liveModeEnabled: boolean;
}): number {
  if (args.halted) {
    return 100;
  }

  const exposureRatio = args.policy.max_position_notional_usd
    ? args.exposure / args.policy.max_position_notional_usd
    : 0;
  const concurrencyRatio = args.policy.max_concurrent_trades
    ? args.positionsCount / args.policy.max_concurrent_trades
    : 0;
  const dailyLossRatio = args.policy.daily_loss_limit_usd
    ? Math.max(0, -args.dailyRealizedPnl) / args.policy.daily_loss_limit_usd
    : 0;

  const score =
    Math.min(45, exposureRatio * 40) +
    Math.min(22, concurrencyRatio * 18) +
    Math.min(23, dailyLossRatio * 25) +
    Math.min(10, args.warnings * 3) +
    (args.liveModeEnabled ? 8 : 0);

  return Math.round(Math.max(4, Math.min(100, score)));
}

function riskLabel(score: number): string {
  if (score >= 80) {
    return "Critical";
  }
  if (score >= 55) {
    return "Elevated";
  }
  if (score >= 30) {
    return "Guarded";
  }
  return "Calm";
}

function riskTone(score: number): "green" | "amber" | "red" | "cyan" {
  if (score >= 80) {
    return "red";
  }
  if (score >= 55) {
    return "amber";
  }
  if (score >= 30) {
    return "cyan";
  }
  return "green";
}

function markerColor(recommendation: string): string {
  if (recommendation === "buy") {
    return "#82ffbe";
  }
  if (recommendation === "sell" || recommendation === "reduce") {
    return "#ff8578";
  }
  return "#79f3ff";
}

function markerShape(recommendation: string): "arrowUp" | "arrowDown" | "circle" {
  if (recommendation === "buy") {
    return "arrowUp";
  }
  if (recommendation === "sell" || recommendation === "reduce") {
    return "arrowDown";
  }
  return "circle";
}

function markerPosition(recommendation: string): "aboveBar" | "belowBar" | "inBar" {
  if (recommendation === "buy") {
    return "belowBar";
  }
  if (recommendation === "sell" || recommendation === "reduce") {
    return "aboveBar";
  }
  return "inBar";
}

function summariseRole(role: AgentAnalysisResult): string {
  return `${role.role.replaceAll("_", " ")} ${Math.round(role.confidence * 100)}%`;
}

export default function App() {
  const {
    snapshot,
    execution,
    risk,
    latestAnalysis,
    connectionStatus,
    connectionMessage,
    eventFeed,
    reconnectAttempts,
    lastEventAt,
    selectedInstrument,
    pendingAction,
    actionMessage,
    setSelectedInstrument,
    reconnect,
    refreshAll,
    runAnalysisAction,
    dispatchAction,
    pauseExecutionAction,
    resumeExecutionAction,
    engageRiskHaltAction,
    clearRiskHaltAction,
    requestLiveModeAction,
  } = useMarketRuntime();
  const [liveConfirmationText, setLiveConfirmationText] = useState("");

  const selectedMarket = useMemo(
    () =>
      snapshot.snapshots.find(
        (item) =>
          item.symbol === selectedInstrument.symbol &&
          item.timeframe === selectedInstrument.timeframe,
      ) ?? snapshot.snapshots[0],
    [selectedInstrument, snapshot.snapshots],
  );

  const totalExposure = useMemo(
    () => execution.positions.reduce((sum, position) => sum + position.quantity * position.market_price, 0),
    [execution.positions],
  );

  const unrealizedPnl = useMemo(
    () => execution.positions.reduce((sum, position) => sum + position.unrealized_pnl, 0),
    [execution.positions],
  );

  const selectedPosition = useMemo(
    () => execution.positions.find((position) => position.symbol === selectedMarket?.symbol) ?? null,
    [execution.positions, selectedMarket?.symbol],
  );

  const selectedRecentOrders = useMemo(
    () =>
      execution.recent_orders.filter(
        (order) =>
          order.symbol === selectedMarket?.symbol && order.timeframe === selectedMarket?.timeframe,
      ),
    [execution.recent_orders, selectedMarket?.symbol, selectedMarket?.timeframe],
  );

  const priceMarkers = useMemo<PriceMarker[]>(() => {
    const markers: PriceMarker[] = selectedRecentOrders.slice(0, 4).map(
      (order: ExecutionOrder) => ({
      time: order.filled_at ?? order.created_at,
      position: order.side === "buy" ? "belowBar" : "aboveBar",
      shape: order.side === "buy" ? "arrowUp" : "arrowDown",
      color: order.side === "buy" ? "#82ffbe" : "#ff8578",
      text: `${order.side.toUpperCase()} ${formatCompact(order.requested_notional)}`,
      }),
    );

    if (latestAnalysis && selectedMarket) {
      markers.unshift({
        time: latestAnalysis.completed_at,
        position: markerPosition(latestAnalysis.overall_recommendation),
        shape: markerShape(latestAnalysis.overall_recommendation),
        color: markerColor(latestAnalysis.overall_recommendation),
        text: `${latestAnalysis.overall_recommendation.toUpperCase()} ${Math.round(
          (latestAnalysis.outputs.at(-1)?.confidence ?? 0) * 100,
        )}%`,
      });
    }

    return markers;
  }, [latestAnalysis, selectedMarket, selectedRecentOrders]);

  const riskScore = useMemo(
    () =>
      computeRiskScore({
        exposure: totalExposure,
        positionsCount: execution.positions.length,
        dailyRealizedPnl: risk.daily_realized_pnl,
        policy: risk.policy,
        warnings: snapshot.runtime.warnings.length,
        halted: risk.halted,
        liveModeEnabled: risk.live_mode_enabled,
      }),
    [execution.positions.length, risk, snapshot.runtime.warnings.length, totalExposure],
  );

  const nonSelectedUnrealized = selectedPosition
    ? unrealizedPnl - selectedPosition.unrealized_pnl
    : unrealizedPnl;

  const connectionTone =
    connectionStatus === "live"
      ? "live"
      : connectionStatus === "reconnecting"
        ? "reconnecting"
        : connectionStatus;

  const signalLogEvents = useMemo(
    () =>
      eventFeed
        .filter(
          (event) =>
            event.event_type.startsWith("agent.") ||
            event.event_type.startsWith("execution.") ||
            event.event_type.startsWith("risk."),
        )
        .slice(0, 8),
    [eventFeed],
  );

  const heatmapCells = useMemo<HeatmapCell[]>(
    () =>
      snapshot.snapshots.map((item) => {
        const position = execution.positions.find((entry) => entry.symbol === item.symbol);
        return {
          key: `${item.symbol}:${item.timeframe}`,
          label: item.symbol,
          timeframe: item.timeframe,
          changePercent: item.change_percent,
          exposureUsd: position ? position.quantity * position.market_price : item.last_price,
          pnlUsd: position?.unrealized_pnl ?? 0,
          active: Boolean(position),
        };
      }),
    [execution.positions, snapshot.snapshots],
  );

  const factorAxes = useMemo<RadarAxis[]>(() => {
    const dataRole = latestAnalysis?.outputs.find((role) => role.role === "data");
    const technicalRole = latestAnalysis?.outputs.find(
      (role) => role.role === "technical_analysis",
    );
    const macroRole = latestAnalysis?.outputs.find(
      (role) => role.role === "news_geopolitics",
    );
    const executionReadiness =
      (execution.engine_status === "running" ? 62 : 28) +
      (risk.halted ? -32 : 18) +
      (risk.live_mode_enabled ? 8 : 0);

    return [
      {
        label: "Trend",
        value: clampScore(Math.abs(selectedMarket?.change_percent ?? 0) * 18 + 28),
      },
      {
        label: "Momentum",
        value: clampScore((technicalRole?.confidence ?? 0.4) * 100),
      },
      {
        label: "Macro",
        value: clampScore((macroRole?.confidence ?? 0.38) * 100),
      },
      {
        label: "Execution",
        value: clampScore(executionReadiness),
      },
      {
        label: "Risk Buffer",
        value: clampScore(100 - riskScore + (dataRole?.confidence ?? 0.4) * 12),
      },
    ];
  }, [execution.engine_status, latestAnalysis?.outputs, risk.halted, risk.live_mode_enabled, riskScore, selectedMarket?.change_percent]);

  return (
    <main className="app-shell dashboard-shell">
      <motion.section
        className="hero-panel hero-dashboard"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">Phase 6 / Pro Trading Dashboard Shell</p>
            <Badge color={snapshot.runtime.app_mode === "mock" ? "amber" : "cyan"}>
              {snapshot.runtime.runtime_mode}
            </Badge>
          </div>
          <h1>Operator cockpit for explainable AI execution.</h1>
          <p className="lede">
            Live metrics, charted price action, risk posture, and runtime controls now sit on the
            same local-first surface.
          </p>

          <div className="hero-facts">
            <div>
              <span>AI Provider</span>
              <strong>
                {snapshot.runtime.ai_provider}
                {snapshot.runtime.ai_model ? ` / ${snapshot.runtime.ai_model}` : ""}
              </strong>
            </div>
            <div>
              <span>Execution</span>
              <strong>{execution.execution_mode}</strong>
            </div>
            <div>
              <span>Exchange</span>
              <strong>{snapshot.runtime.exchange_id}</strong>
            </div>
          </div>
        </div>

        <div className="hero-sidebar">
          <div className="status-chip" data-state={connectionTone}>
            <span className="status-dot" />
            <div>
              <strong>
                {connectionStatus === "live"
                  ? "Live stream"
                  : connectionStatus === "reconnecting"
                    ? "Reconnecting"
                    : connectionStatus === "connecting"
                      ? "Connecting"
                      : connectionStatus === "degraded"
                        ? "Degraded"
                        : "Closed"}
              </strong>
              <p>{connectionMessage}</p>
            </div>
          </div>

          <div className="banner-strip">
            <span>{actionMessage}</span>
            <span>
              {lastEventAt ? `Last event ${new Date(lastEventAt).toLocaleTimeString()}` : "Awaiting events"}
            </span>
          </div>

          <div className="hero-actions">
            <Button variant="secondary" size="sm" onClick={refreshAll} disabled={Boolean(pendingAction)}>
              <RefreshCcw size={16} />
              Refresh surfaces
            </Button>
            <Button variant="ghost" size="sm" onClick={reconnect}>
              <Cable size={16} />
              Reconnect
            </Button>
          </div>
        </div>
      </motion.section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
          >
            <Card className="panel-card market-deck">
              <CardHeader className="panel-headline">
                <div>
                  <p className="section-label">Market Deck</p>
                  <CardTitle>Trade surface</CardTitle>
                  <CardDescription>
                    Select a stream, inspect candle structure, and overlay the most recent thesis or order actions.
                  </CardDescription>
                </div>
                <Badge color="cyan">{snapshot.snapshots.length} tracked feeds</Badge>
              </CardHeader>
              <CardContent>
                <div className="instrument-strip">
                  {snapshot.snapshots.map((item: MarketSnapshot) => {
                    const active =
                      item.symbol === selectedMarket?.symbol &&
                      item.timeframe === selectedMarket?.timeframe;
                    return (
                      <button
                        className="instrument-pill"
                        data-active={active}
                        key={`${item.symbol}:${item.timeframe}`}
                        onClick={() =>
                          setSelectedInstrument({ symbol: item.symbol, timeframe: item.timeframe })
                        }
                        type="button"
                      >
                        <div>
                          <strong>{item.symbol}</strong>
                          <span>{item.timeframe}</span>
                        </div>
                        <small data-positive={item.change_percent >= 0}>
                          {formatPercent(item.change_percent)}
                        </small>
                      </button>
                    );
                  })}
                </div>

                {selectedMarket ? (
                  <>
                    <div className="market-spotlight">
                      <div>
                        <span className="section-label">Selected Market</span>
                        <h2>{selectedMarket.symbol}</h2>
                      </div>
                      <div className="spotlight-metric">
                        <strong>{formatMoney(selectedMarket.last_price)}</strong>
                        <span data-positive={selectedMarket.change_percent >= 0}>
                          {formatPercent(selectedMarket.change_percent)}
                        </span>
                      </div>
                      <div className="spotlight-metric compact">
                        <span>24h volume</span>
                        <strong>{formatCompact(selectedMarket.volume_24h)}</strong>
                      </div>
                    </div>
                    <PriceChart
                      candles={selectedMarket.candles}
                      markers={priceMarkers}
                      symbol={selectedMarket.symbol}
                      timeframe={selectedMarket.timeframe}
                    />
                    <PnlChart
                      candles={selectedMarket.candles}
                      quantity={selectedPosition?.quantity ?? 0}
                      averageEntryPrice={selectedPosition?.avg_entry_price ?? selectedMarket.last_price}
                      realizedPnl={risk.daily_realized_pnl}
                      offsetPnl={nonSelectedUnrealized}
                    />
                  </>
                ) : (
                  <div className="empty-state">No market streams loaded yet.</div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            <Card className="panel-card thesis-panel">
              <CardHeader className="panel-headline">
                <div>
                  <p className="section-label">PrimoAgent</p>
                  <CardTitle>Latest thesis</CardTitle>
                  <CardDescription>
                    Dedicated data, technical, news, and risk roles remain visible instead of collapsing into a black box.
                  </CardDescription>
                </div>
                <Badge color={latestAnalysis?.status === "fallback" ? "amber" : "green"}>
                  {latestAnalysis?.status ?? "pending"}
                </Badge>
              </CardHeader>
              <CardContent>
                {latestAnalysis ? (
                  <div className="thesis-layout">
                    <div className="thesis-summary-card">
                      <div className="thesis-summary-header">
                        <div>
                          <span className="section-label">Recommendation</span>
                          <h3>{latestAnalysis.overall_recommendation.toUpperCase()}</h3>
                        </div>
                        <Badge color={riskTone(riskScore) === "red" ? "red" : "cyan"}>
                          {latestAnalysis.provider}
                        </Badge>
                      </div>
                      <p>{latestAnalysis.outputs.at(-1)?.summary ?? "No summary available."}</p>
                      <div className="thesis-role-grid">
                        {latestAnalysis.outputs.map((role) => (
                          <article className="thesis-role-card" key={role.role}>
                            <div className="role-icon">
                              {role.role === "data" ? (
                                <Radar size={18} />
                              ) : role.role === "technical_analysis" ? (
                                <Gauge size={18} />
                              ) : role.role === "news_geopolitics" ? (
                                <Activity size={18} />
                              ) : (
                                <ShieldCheck size={18} />
                              )}
                            </div>
                            <div>
                              <strong>{summariseRole(role)}</strong>
                              <p>{role.summary}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="event-panel compact-panel">
                      <div className="section-kicker">
                        <span className="section-label">Signal tape</span>
                        <Badge color="cyan">{eventFeed.length} frames</Badge>
                      </div>
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
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Run analysis for the selected instrument to populate the multi-agent thesis panel.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <Card className="panel-card analytics-panel">
              <CardHeader className="panel-headline">
                <div>
                  <p className="section-label">Advanced Visual Analytics</p>
                  <CardTitle>Signal depth layer</CardTitle>
                  <CardDescription>
                    Signal logs, exposure heatmap, and factor radar stay synchronized with the same realtime dashboard state.
                  </CardDescription>
                </div>
                <Badge color="cyan">Phase 7</Badge>
              </CardHeader>
              <CardContent>
                <div className="analytics-grid">
                  <SignalLog
                    events={signalLogEvents}
                    latestAnalysis={latestAnalysis}
                    describeEvent={describeEvent}
                  />
                  <div className="analytics-side-grid">
                    <PositionsHeatmap cells={heatmapCells} />
                    <FactorRadar
                      axes={factorAxes}
                      recommendation={latestAnalysis?.overall_recommendation ?? "hold"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>

        <aside className="dashboard-sidebar">
          <motion.section
            className="kpi-grid"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <Card className="kpi-card">
              <CardContent className="kpi-body">
                <span className="section-label">Open Positions</span>
                <strong>{execution.positions.length}</strong>
                <p>Live paper positions currently tracked by the execution loop.</p>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="kpi-body">
                <span className="section-label">Gross Exposure</span>
                <strong>{formatMoney(totalExposure)}</strong>
                <p>Current notional exposure across open paper positions.</p>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="kpi-body">
                <span className="section-label">Unrealized P&L</span>
                <strong data-positive={unrealizedPnl >= 0}>{formatMoney(unrealizedPnl)}</strong>
                <p>Marked from the latest streamed market prices.</p>
              </CardContent>
            </Card>
            <Card className="kpi-card risk-ring-card">
              <CardContent className="kpi-body risk-ring-body">
                <div>
                  <span className="section-label">Risk Score</span>
                  <strong>{riskLabel(riskScore)}</strong>
                  <p>Computed from exposure, concurrency, loss pressure, warnings, and live mode.</p>
                </div>
                <ProgressCircle value={riskScore} size="md" color={riskTone(riskScore)}>
                  <span className="risk-score-value">{riskScore}</span>
                </ProgressCircle>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 }}
          >
            <Card className="panel-card operator-panel">
              <CardHeader className="panel-headline">
                <div>
                  <p className="section-label">Operator Deck</p>
                  <CardTitle>Runtime controls</CardTitle>
                  <CardDescription>
                    Clear start, pause, dispatch, halt, and live-mode affordances with explicit backend-backed state.
                  </CardDescription>
                </div>
                <Badge color={execution.engine_status === "running" ? "green" : "amber"}>
                  {execution.engine_status}
                </Badge>
              </CardHeader>
              <CardContent className="operator-stack">
                <div className="operator-card-grid">
                  <div className="operator-card">
                    <div className="operator-title-row">
                      <div>
                        <span className="section-label">Execution Engine</span>
                        <h3>{execution.engine_status === "running" ? "Active" : "Paused"}</h3>
                      </div>
                      {execution.engine_status === "running" ? (
                        <Play size={18} className="operator-icon active" />
                      ) : (
                        <Slash size={18} className="operator-icon paused" />
                      )}
                    </div>
                    <p>{execution.paused_reason ?? "Engine ready for manual dispatch."}</p>
                    <div className="operator-actions two-up">
                      <Button onClick={runAnalysisAction} disabled={Boolean(pendingAction)}>
                        <Bot size={16} />
                        Run analysis
                      </Button>
                      <Button variant="secondary" onClick={dispatchAction} disabled={Boolean(pendingAction)}>
                        <ArrowUpRight size={16} />
                        Dispatch paper trade
                      </Button>
                      {execution.engine_status === "running" ? (
                        <Button variant="danger" onClick={pauseExecutionAction} disabled={Boolean(pendingAction)}>
                          <Slash size={16} />
                          Pause engine
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={resumeExecutionAction} disabled={Boolean(pendingAction)}>
                          <Play size={16} />
                          Resume engine
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="operator-card">
                    <div className="operator-title-row">
                      <div>
                        <span className="section-label">Risk Guard</span>
                        <h3>{risk.halted ? "Halt engaged" : "Guard active"}</h3>
                      </div>
                      {risk.halted ? (
                        <ShieldAlert size={18} className="operator-icon risk" />
                      ) : (
                        <ShieldCheck size={18} className="operator-icon safe" />
                      )}
                    </div>
                    <p>{risk.halt_reason ?? `Approval ${risk.policy.require_agent_approval ? "required" : "optional"}.`}</p>
                    <div className="policy-strip">
                      <span>Max position {formatMoney(risk.policy.max_position_notional_usd)}</span>
                      <span>Daily loss {formatMoney(risk.policy.daily_loss_limit_usd)}</span>
                    </div>
                    <div className="operator-actions two-up">
                      {risk.halted ? (
                        <Button variant="secondary" onClick={clearRiskHaltAction} disabled={Boolean(pendingAction)}>
                          <ShieldCheck size={16} />
                          Clear halt
                        </Button>
                      ) : (
                        <Button variant="danger" onClick={engageRiskHaltAction} disabled={Boolean(pendingAction)}>
                          <Flame size={16} />
                          Engage halt
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="operator-card live-card">
                  <div className="operator-title-row">
                    <div>
                      <span className="section-label">Live Mode Gate</span>
                      <h3>{risk.live_mode_enabled ? "Enabled" : "Locked"}</h3>
                    </div>
                    <Badge color={risk.live_mode_enabled ? "red" : "amber"}>
                      {risk.live_mode_enabled ? "armed" : "paper-first"}
                    </Badge>
                  </div>
                  <p>
                    {risk.live_mode_reason ??
                      "Type ENABLE LIVE TRADING to request live mode once runtime preconditions are met."}
                  </p>
                  <div className="live-confirm-row">
                    <input
                      className="live-confirm-input"
                      onChange={(event) => setLiveConfirmationText(event.target.value)}
                      placeholder="ENABLE LIVE TRADING"
                      value={liveConfirmationText}
                    />
                    {risk.live_mode_enabled ? (
                      <Button
                        variant="danger"
                        onClick={() => requestLiveModeAction(false)}
                        disabled={Boolean(pendingAction)}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => requestLiveModeAction(true, liveConfirmationText)}
                        disabled={Boolean(pendingAction)}
                      >
                        Request enable
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <Card className="panel-card diagnostics-card">
              <CardHeader className="panel-headline">
                <div>
                  <p className="section-label">Telemetry</p>
                  <CardTitle>Runtime diagnostics</CardTitle>
                  <CardDescription>
                    The operator never loses track of warnings, reconnect loops, or current balances.
                  </CardDescription>
                </div>
                <Badge color={snapshot.runtime.warnings.length > 0 ? "amber" : "green"}>
                  {snapshot.runtime.warnings.length} warnings
                </Badge>
              </CardHeader>
              <CardContent className="diagnostics-stack">
                <div className="diagnostic-row">
                  <div>
                    <span className="section-label">Cash / Equity</span>
                    <strong>
                      {formatMoney(execution.cash_balance)} / {formatMoney(execution.equity_estimate)}
                    </strong>
                  </div>
                  <ArrowDownRight size={18} className="muted-icon" />
                </div>
                <div className="diagnostic-row">
                  <div>
                    <span className="section-label">Realtime retries</span>
                    <strong>{reconnectAttempts}</strong>
                  </div>
                  <Cable size={18} className="muted-icon" />
                </div>
                <div className="diagnostic-row">
                  <div>
                    <span className="section-label">Last analysis run</span>
                    <strong>{execution.last_run_id ? execution.last_run_id.slice(0, 8) : "None yet"}</strong>
                  </div>
                  <Bot size={18} className="muted-icon" />
                </div>

                {snapshot.runtime.warnings.length > 0 ? (
                  <div className="warning-list">
                    {snapshot.runtime.warnings.map((warning) => (
                      <div className="warning-row" key={warning}>
                        <AlertTriangle size={16} />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="quiet-copy">
                    Runtime warnings are clear. Local-first telemetry is healthy and inspectable.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.section>
        </aside>
      </section>
    </main>
  );
}

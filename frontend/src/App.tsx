import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { motion } from "framer-motion";
import type { LogicalRange } from "lightweight-charts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Cable,
  ChevronRight,
  Flame,
  Gauge,
  Play,
  Radar,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PnlChart } from "./components/dashboard/pnl-chart";
import { AgentRuntimePanel } from "./components/dashboard/agent-runtime-panel";
import { AgentWorkflowStudio } from "./components/dashboard/agent-workflow-studio";
import { FactorRadar, type RadarAxis } from "./components/dashboard/factor-radar";
import { MacroIntelligencePanel } from "./components/dashboard/macro-intelligence-panel";
import { PositionsHeatmap, type HeatmapCell } from "./components/dashboard/positions-heatmap";
import { PriceChart, type PriceMarker } from "./components/dashboard/price-chart";
import { PerformancePanel } from "./components/dashboard/performance-panel";
import { SignalLog } from "./components/dashboard/signal-log";
import { StrategyFactoryPanel } from "./components/dashboard/strategy-factory-panel";
import { SectionTruthStrip } from "./components/dashboard/section-truth-strip";
import { ThesisEvidencePanel } from "./components/dashboard/thesis-evidence-panel";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { useMarketRuntime } from "./hooks/useMarketRuntime";
import { useLocale } from "./lib/i18n";
import {
  deriveDashboardEventSummary,
  deriveDashboardViewModel,
  type DashboardDigestItem,
  type DashboardEventSummary,
} from "./lib/dashboard-derive";
import type { AgentAnalysisResult, EventEnvelope, ExecutionOrder, MarketSnapshot } from "./lib/market";

type WorkspaceSection =
  | "overview"
  | "market"
  | "thesis"
  | "workflow"
  | "strategy"
  | "analytics"
  | "operations"
  | "diagnostics";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function describeEvent(
  event: EventEnvelope,
  helpers: {
    t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;
    formatRecommendation: (
      recommendation: "buy" | "sell" | "hold" | "reduce" | "wait",
      options?: { uppercase?: boolean },
    ) => string;
    formatRole: (role: AgentAnalysisResult["role"]) => string;
  },
): string {
  const payload = event.payload;

  switch (event.event_type) {
    case "system.warning":
      return String(payload.message ?? helpers.t("event.realtimeWarningFallback"));
    case "system.connected":
      return helpers.t("event.systemConnected");
    case "market.snapshot":
      return helpers.t("event.marketSnapshot");
    case "market.tick":
      return helpers.t("event.marketTick", {
        symbol: String(payload.symbol ?? "Market"),
        timeframe: String(payload.timeframe ?? "1m"),
      });
    case "agent.analysis.requested":
      return helpers.t("event.analysisRequested", {
        symbol: String(payload.symbol ?? "selected instrument"),
      });
    case "agent.role.completed":
      return helpers.t("event.agentRoleCompleted", {
        role: helpers.formatRole(
          String(payload.run_role ?? "data") as AgentAnalysisResult["role"],
        ),
        symbol: String(payload.symbol ?? "instrument"),
      });
    case "agent.analysis.completed":
      return helpers.t("event.analysisCompleted", {
        symbol: String(payload.symbol ?? "instrument"),
      });
    case "execution.signal.approved":
      return helpers.t("event.signalApproved", {
        symbol: String(payload.symbol ?? "instrument"),
        side: helpers.formatRecommendation(
          String(payload.side ?? "hold") as "buy" | "sell" | "hold" | "reduce" | "wait",
        ),
      });
    case "execution.signal.blocked":
    case "execution.signal.skipped":
      return String(payload.reason ?? helpers.t("event.signalNotOrder"));
    case "execution.order.filled":
      return helpers.t("event.orderFilled", {
        symbol: String(payload.symbol ?? "Instrument"),
        side: helpers.formatRecommendation(
          String(payload.side ?? "hold") as "buy" | "sell" | "hold" | "reduce" | "wait",
        ),
      });
    case "execution.engine.paused":
      return String(payload.reason ?? helpers.t("event.enginePaused"));
    case "execution.engine.resumed":
      return helpers.t("event.engineResumed");
    case "risk.policy.updated":
      return helpers.t("event.riskUpdated");
    case "risk.approval.denied":
      return helpers.t("event.approvalDenied", {
        symbol: String(payload.symbol ?? "instrument"),
      });
    case "risk.approval.granted":
      return helpers.t("event.approvalGranted", {
        symbol: String(payload.symbol ?? "instrument"),
      });
    case "risk.halt.triggered":
      return String(payload.reason ?? helpers.t("event.riskHaltTriggered"));
    case "risk.halt.cleared":
      return helpers.t("event.riskHaltCleared");
    case "risk.live_mode.enabled":
    case "risk.live_mode.disabled":
      return String(payload.message ?? helpers.t("event.liveModeUpdated"));
    case "strategy.factory.config.updated":
      return String(payload.reason ?? helpers.t("event.strategyFactoryUpdated"));
    case "strategy.factory.started":
      return helpers.t("event.strategyStarted");
    case "strategy.factory.generated":
      return helpers.t("event.strategyGenerated", {
        symbol: String(payload.symbol ?? "instrument"),
      });
    case "strategy.factory.failed":
      return String(payload.reason ?? helpers.t("event.strategyFailed"));
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

function riskLabelKey(score: number): string {
  if (score >= 80) {
    return "risk.critical";
  }
  if (score >= 55) {
    return "risk.elevated";
  }
  if (score >= 30) {
    return "risk.guarded";
  }
  return "risk.calm";
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

function summariseRole(
  role: AgentAnalysisResult,
  helpers: {
    formatRole: (role: AgentAnalysisResult["role"]) => string;
    formatPercent: (value: number, showPlus?: boolean) => string;
  },
): string {
  return `${helpers.formatRole(role.role)} ${helpers.formatPercent(role.confidence * 100, false)}`;
}

function resolveMarketSourceLabel(
  source: string,
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): string {
  const key = `runtime.marketSource.${source}`;
  const translated = t(key);
  return translated === key ? source : translated;
}

function resolveMarketStatusLabel(
  status: string,
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): string {
  const key = `runtime.marketStatus.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function formatConnectionStatus(
  connectionStatus: "connecting" | "live" | "reconnecting" | "degraded" | "closed",
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): string {
  return t(`connection.${connectionStatus}`);
}

function formatLocalizedConnectionMessage(args: {
  connectionStatus: "connecting" | "live" | "reconnecting" | "degraded" | "closed";
  reconnectAttempts: number;
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;
}): string {
  if (args.connectionStatus === "live") {
    return args.reconnectAttempts === 0
      ? args.t("connection.message.live")
      : args.t("connection.message.restored");
  }
  if (args.connectionStatus === "reconnecting") {
    return args.t("connection.message.reconnecting", { count: args.reconnectAttempts });
  }
  if (args.connectionStatus === "degraded") {
    return args.t("connection.message.degraded");
  }
  if (args.connectionStatus === "closed") {
    return args.t("connection.message.closed");
  }
  return args.t("connection.message.connecting");
}

function formatAnalysisStatus(
  status: "completed" | "fallback" | null,
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): string {
  if (status === "completed") {
    return t("strategy.generation.completed");
  }
  if (status === "fallback") {
    return t("runtime.systemStatus.fallback");
  }
  return t("thesis.pending");
}

function formatEventSummaryLabels(
  event: EventEnvelope,
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): DashboardEventSummary & { trackLabel: string; outcomeLabel: string } {
  const summary = deriveDashboardEventSummary(event);
  return {
    ...summary,
    trackLabel: t(`event.track.${summary.track}`),
    outcomeLabel: t(`event.outcome.${summary.outcome}`),
  };
}

function formatDigestItem(args: {
  item: DashboardDigestItem;
  t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;
  formatTime: (value: string | number | Date) => string;
  formatRecommendation: (
    recommendation: "buy" | "sell" | "hold" | "reduce" | "wait",
    options?: { uppercase?: boolean },
  ) => string;
}): { label: string; value: string; meta: string } {
  const { item, t, formatTime, formatRecommendation } = args;

  switch (item.id) {
    case "execution":
      return {
        label: t("hero.execution"),
        value: `${
          item.engineStatus === "running" ? t("operator.executionActive") : t("operator.executionPaused")
        } · ${item.executionMode.toUpperCase()}`,
        meta: item.lastRunId ? item.lastRunId.slice(0, 8) : t("diagnostics.noneYet"),
      };
    case "market": {
      const requested = resolveMarketSourceLabel(item.requestedSource, t);
      const effective = resolveMarketSourceLabel(item.effectiveSource, t);
      const status = resolveMarketStatusLabel(item.marketStatus, t);
      return {
        label: t("runtime.marketRequested"),
        value: `${requested} -> ${effective}`,
        meta: item.latestEventAt ? `${status} · ${formatTime(item.latestEventAt)}` : status,
      };
    }
    case "system":
      return {
        label: t("runtime.systemStatus"),
        value: formatConnectionStatus(item.connectionStatus, t),
        meta: formatLocalizedConnectionMessage({
          connectionStatus: item.connectionStatus,
          reconnectAttempts: item.reconnectAttempts,
          t,
        }),
      };
    case "thesis":
      return {
        label: t("thesis.title"),
        value: item.recommendation
          ? `${formatRecommendation(item.recommendation, { uppercase: true })} · ${formatAnalysisStatus(item.status, t)}`
          : t("thesis.pending"),
        meta: item.symbol && item.timeframe ? `${item.symbol} · ${item.timeframe}` : t("thesis.empty"),
      };
    case "strategy":
      return {
        label: t("strategy.title"),
        value: `${
          item.enabled ? t(`strategy.generation.${item.generationStatus}`) : t("strategy.disabled")
        } · ${item.effectiveProvider}`,
        meta: item.enabled
          ? `${t("strategy.artifacts")} ${item.artifactCount}`
          : t("strategy.ready"),
      };
  }
}

export default function App() {
  const {
    locale,
    setLocale,
    t,
    formatCompactNumber,
    formatCurrency,
    formatPercent,
    formatTime,
    formatRecommendation,
    formatRole,
  } = useLocale();
  const {
    snapshot,
    execution,
    risk,
    strategyStatus,
    strategyArtifacts,
    agentRuntime,
    paperPerformance,
    backtestReport,
    latestAnalysis,
    workflow,
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
    toggleStrategyFactoryAction,
    generateStrategyAction,
    runBacktestAction,
  } = useMarketRuntime();
  const [liveConfirmationText, setLiveConfirmationText] = useState("");
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const [marketChartRange, setMarketChartRange] = useState<LogicalRange | null>(null);

  const viewModel = useMemo(
    () =>
      deriveDashboardViewModel({
        snapshot,
        execution,
        risk,
        strategyStatus,
        latestAnalysis,
        connectionStatus,
        reconnectAttempts,
        lastEventAt,
        eventFeed,
      }),
    [
      connectionStatus,
      eventFeed,
      execution,
      lastEventAt,
      latestAnalysis,
      reconnectAttempts,
      risk,
      snapshot,
      strategyStatus,
    ],
  );

  const marketData = snapshot.market_data ?? snapshot.runtime?.market_data ?? {
    mode: "mock",
    requested_source: "mock",
    effective_source: "mock",
    status: "fallback",
    fallback_active: true,
    detail: "Market runtime metadata unavailable.",
  };
  const marketStatusValue =
    typeof marketData.status === "string" ? marketData.status.toLowerCase() : "fallback";

  const describedEvent = useMemo(
    () =>
      (event: EventEnvelope) =>
        describeEvent(event, {
          t,
          formatRecommendation,
          formatRole,
        }),
    [formatRecommendation, formatRole, t],
  );

  const localizedConnectionMessage = useMemo(
    () =>
      formatLocalizedConnectionMessage({
        connectionStatus,
        reconnectAttempts,
        t,
      }),
    [connectionStatus, reconnectAttempts, t],
  );

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
    const markers: PriceMarker[] = selectedRecentOrders.slice(0, 4).map((order: ExecutionOrder) => ({
      time: order.filled_at ?? order.created_at,
      position: order.side === "buy" ? "belowBar" : "aboveBar",
      shape: order.side === "buy" ? "arrowUp" : "arrowDown",
      color: order.side === "buy" ? "#82ffbe" : "#ff8578",
      text: `${formatRecommendation(order.side, { uppercase: true })} ${formatCompactNumber(order.requested_notional)}`,
    }));

    if (latestAnalysis && selectedMarket) {
      markers.unshift({
        time: latestAnalysis.completed_at,
        position: markerPosition(latestAnalysis.overall_recommendation),
        shape: markerShape(latestAnalysis.overall_recommendation),
        color: markerColor(latestAnalysis.overall_recommendation),
        text: `${formatRecommendation(latestAnalysis.overall_recommendation, {
          uppercase: true,
        })} ${Math.round((latestAnalysis.outputs.at(-1)?.confidence ?? 0) * 100)}%`,
      });
    }

    return markers;
  }, [formatCompactNumber, formatRecommendation, latestAnalysis, selectedMarket, selectedRecentOrders]);

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

  const signalLogEvents = useMemo(
    () =>
      eventFeed
        .filter(
          (event) =>
            event.event_type.startsWith("agent.") ||
            event.event_type.startsWith("execution.") ||
            event.event_type.startsWith("risk.") ||
            event.event_type.startsWith("strategy."),
        )
        .slice(0, 8),
    [eventFeed],
  );

  const thesisEvents = useMemo(() => eventFeed.slice(0, 8), [eventFeed]);

  useEffect(() => {
    setMarketChartRange(null);
  }, [selectedMarket?.symbol, selectedMarket?.timeframe]);

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
        label: t("factor.trend"),
        value: clampScore(Math.abs(selectedMarket?.change_percent ?? 0) * 18 + 28),
      },
      {
        label: t("factor.momentum"),
        value: clampScore((technicalRole?.confidence ?? 0.4) * 100),
      },
      {
        label: t("factor.macro"),
        value: clampScore((macroRole?.confidence ?? 0.38) * 100),
      },
      {
        label: t("factor.execution"),
        value: clampScore(executionReadiness),
      },
      {
        label: t("factor.riskBuffer"),
        value: clampScore(100 - riskScore + (dataRole?.confidence ?? 0.4) * 12),
      },
    ];
  }, [
    execution.engine_status,
    latestAnalysis?.outputs,
    risk.halted,
    risk.live_mode_enabled,
    riskScore,
    selectedMarket?.change_percent,
    t,
  ]);

  const thesisMacroRole = useMemo(
    () => latestAnalysis?.outputs.find((role) => role.role === "news_geopolitics") ?? null,
    [latestAnalysis?.outputs],
  );

  const systemStatusLabel = useMemo(
    () => t(`runtime.systemStatus.${viewModel.systemStatus}`),
    [t, viewModel.systemStatus],
  );

  const digestCards = useMemo(
    () =>
      viewModel.digestItems.map((item) => ({
        item,
        content: formatDigestItem({
          item,
          t,
          formatTime,
          formatRecommendation,
        }),
      })),
    [formatRecommendation, formatTime, t, viewModel.digestItems],
  );

  const marketStatusLabel = useMemo(
    () => resolveMarketStatusLabel(marketStatusValue, t),
    [marketStatusValue, t],
  );

  const marketEmptyStateMessage = useMemo(() => {
    if (viewModel.realSourceRequested) {
      return `${t("marketDeck.emptyReal")} ${t("marketDeck.emptyHint")}`;
    }
    return t("marketDeck.empty");
  }, [t, viewModel.realSourceRequested]);

  const heroProviderLabel = snapshot.runtime.ai_model
    ? `${snapshot.runtime.ai_provider} / ${snapshot.runtime.ai_model}`
    : snapshot.runtime.ai_provider;
  const selectedMarketBadge = selectedMarket
    ? `${selectedMarket.symbol} · ${selectedMarket.timeframe}`
    : snapshot.runtime.exchange_id;
  const selectedMarketHeroValue = selectedMarket
    ? formatCurrency(selectedMarket.last_price)
    : systemStatusLabel;
  const selectedMarketHeroMeta = selectedMarket
    ? formatPercent(selectedMarket.change_percent)
    : localizedConnectionMessage;
  const marketDigestCard = digestCards.find(({ item }) => item.id === "market")?.content;
  const denseOverviewItems = useMemo(
    () => [
      {
        id: "selected",
        label: t("marketDeck.selected"),
        value: selectedMarket ? `${selectedMarket.symbol} · ${selectedMarket.timeframe}` : systemStatusLabel,
        detail: selectedMarket
          ? `${formatCurrency(selectedMarket.last_price)} · ${formatPercent(selectedMarket.change_percent)}`
          : localizedConnectionMessage,
      },
      {
        id: "tape",
        label: t("analytics.signalLog.title"),
        value: String(signalLogEvents.length),
        detail:
          signalLogEvents.length > 0
            ? t("analytics.signalLog.entries", { count: signalLogEvents.length })
            : t("analytics.signalLog.waiting"),
      },
      {
        id: "positions",
        label: t("kpi.positions"),
        value: `${execution.positions.length} · ${formatCurrency(totalExposure)}`,
        detail: `${t("kpi.unrealized")} · ${formatCurrency(unrealizedPnl)}`,
      },
      {
        id: "strategy",
        label: t("extensions.title"),
        value: strategyStatus.enabled ? t("strategy.enabled") : t("strategy.disabled"),
        detail:
          strategyStatus.generation.detail ??
          `${t(`strategy.generation.${strategyStatus.generation.status}`)} · ${strategyStatus.effective_provider}`,
      },
    ],
    [
      execution.positions.length,
      formatCurrency,
      formatPercent,
      localizedConnectionMessage,
      selectedMarket,
      signalLogEvents.length,
      strategyStatus.effective_provider,
      strategyStatus.enabled,
      strategyStatus.generation.detail,
      strategyStatus.generation.status,
      systemStatusLabel,
      t,
      totalExposure,
      unrealizedPnl,
    ],
  );
  const navigationItems = [
    {
      id: "overview" as const,
      icon: Activity,
      label: t("shell.overviewTitle"),
      meta: systemStatusLabel,
    },
    {
      id: "market" as const,
      icon: Radar,
      label: t("marketDeck.title"),
      meta: t("marketDeck.feeds", { count: snapshot.snapshots.length }),
    },
    {
      id: "thesis" as const,
      icon: Bot,
      label: t("thesis.title"),
      meta: latestAnalysis
        ? formatRecommendation(latestAnalysis.overall_recommendation, {
            uppercase: true,
          })
        : t("thesis.pending"),
    },
    {
      id: "workflow" as const,
      icon: Cable,
      label: t("shell.workflowTitle"),
      meta: workflow?.active_stage_key
        ? t(`workflow.stage.${workflow.active_stage_key}`)
        : t("workflow.noActiveStage"),
    },
    {
      id: "strategy" as const,
      icon: Gauge,
      label: t("extensions.title"),
      meta: strategyStatus.enabled ? t("strategy.enabled") : t("strategy.disabled"),
    },
    {
      id: "analytics" as const,
      icon: ArrowUpRight,
      label: t("analytics.title"),
      meta: t("analytics.signalLog.entries", { count: signalLogEvents.length }),
    },
    {
      id: "operations" as const,
      icon: ShieldCheck,
      label: t("operator.title"),
      meta:
        execution.engine_status === "running"
          ? t("operator.executionActive")
          : t("operator.executionPaused"),
    },
    {
      id: "diagnostics" as const,
      icon: AlertTriangle,
      label: t("diagnostics.title"),
      meta: t("diagnostics.warnings", { count: snapshot.runtime.warnings.length }),
    },
  ];

  const activeNavigationItem =
    navigationItems.find((item) => item.id === activeSection) ?? navigationItems[0];
  const showMarketDeckHeader = activeSection !== "market";
  const showMarketTruthStrip = activeSection === "market";
  const showThesisHeader = activeSection !== "thesis";
  const showStrategyHeader = activeSection !== "strategy";
  const showAnalyticsHeader = activeSection !== "analytics";
  const showOperatorHeader = activeSection !== "operations";
  const showDiagnosticsHeader = activeSection !== "diagnostics";
  const workflowStageLabel = workflow?.active_stage_key
    ? t(`workflow.stage.${workflow.active_stage_key}`)
    : t("workflow.noActiveStage");
  const workflowStageDetail = (() => {
    if (!workflow?.active_stage_key) {
      return t("workflow.noDetail");
    }
    return workflow.stages[workflow.active_stage_key]?.detail ?? t("workflow.noDetail");
  })();
  const executionStatusLabel =
    execution.engine_status === "running"
      ? t("operator.executionActive")
      : t("operator.executionPaused");
  const quickActionButtons = (
    <div className="operator-actions two-up compact-actions-grid">
      <Button onClick={runAnalysisAction} disabled={Boolean(pendingAction)}>
        <Bot size={16} />
        {t("operator.runAnalysis")}
      </Button>
      <Button variant="secondary" onClick={dispatchAction} disabled={Boolean(pendingAction)}>
        <ArrowUpRight size={16} />
        {t("operator.dispatchPaper")}
      </Button>
      <Button variant="secondary" onClick={refreshAll} disabled={Boolean(pendingAction)}>
        <RefreshCcw size={16} />
        {t("hero.refresh")}
      </Button>
      <Button variant="ghost" onClick={reconnect}>
        <Cable size={16} />
        {t("hero.reconnect")}
      </Button>
    </div>
  );
  const workflowTruthItems = [
    {
      id: "workflow-stage",
      label: t("workflow.active"),
      value: workflowStageLabel,
      detail: workflowStageDetail,
      tone: "info" as const,
    },
    {
      id: "workflow-market",
      label: t("runtime.marketRequested"),
      value: `${resolveMarketSourceLabel(marketData.requested_source, t)} -> ${resolveMarketSourceLabel(marketData.effective_source, t)}`,
      detail: marketStatusLabel,
      tone:
        marketData.effective_source === "ccxt" && marketStatusValue === "live"
          ? ("success" as const)
          : marketStatusValue === "fallback" || marketStatusValue === "degraded"
            ? ("warning" as const)
            : ("default" as const),
    },
    {
      id: "workflow-execution",
      label: t("hero.execution"),
      value: executionStatusLabel,
      detail: viewModel.topStates.execution.toUpperCase(),
      tone: execution.engine_status === "running" ? ("success" as const) : ("warning" as const),
    },
  ];
  const strategyTruthItems = [
    {
      id: "strategy-provider",
      label: t("strategy.provider"),
      value: strategyStatus.effective_provider,
      detail: strategyStatus.reason ?? t(`strategy.generation.${strategyStatus.generation.status}`),
      tone: strategyStatus.enabled ? ("info" as const) : ("warning" as const),
    },
    {
      id: "strategy-artifacts",
      label: t("strategy.artifacts"),
      value: String(strategyStatus.artifact_count),
      detail: strategyStatus.latest_artifact?.directory ?? t("strategy.ready"),
      tone: strategyStatus.artifact_count > 0 ? ("success" as const) : ("default" as const),
    },
    {
      id: "strategy-stage",
      label: t("workflow.active"),
      value: workflowStageLabel,
      detail: workflowStageDetail,
      tone: "info" as const,
    },
  ];
  const thesisTruthItems = [
    {
      id: "thesis-recommendation",
      label: t("thesis.recommendation"),
      value: latestAnalysis
        ? formatRecommendation(latestAnalysis.overall_recommendation, {
            uppercase: true,
          })
        : t("thesis.pending"),
      detail: latestAnalysis?.outputs.at(-1)?.summary ?? t("thesis.empty"),
      tone: latestAnalysis ? ("success" as const) : ("default" as const),
    },
    {
      id: "thesis-provider",
      label: t("hero.aiProvider"),
      value: latestAnalysis?.provider ?? heroProviderLabel,
      detail: latestAnalysis?.model ?? snapshot.runtime.ai_model ?? snapshot.runtime.ai_provider,
      tone: "info" as const,
    },
    {
      id: "thesis-workflow",
      label: t("workflow.active"),
      value: workflowStageLabel,
      detail: workflowStageDetail,
      tone: "info" as const,
    },
  ];
  const analyticsTruthItems = [
    {
      id: "analytics-symbol",
      label: t("marketDeck.selected"),
      value: selectedMarket ? `${selectedMarket.symbol} · ${selectedMarket.timeframe}` : systemStatusLabel,
      detail: selectedMarket ? `${formatCurrency(selectedMarket.last_price)} · ${formatPercent(selectedMarket.change_percent)}` : localizedConnectionMessage,
      tone: "info" as const,
    },
    {
      id: "analytics-events",
      label: t("analytics.signalLog.title"),
      value: t("analytics.signalLog.entries", { count: signalLogEvents.length }),
      detail: latestAnalysis?.run_id ?? t("diagnostics.noneYet"),
      tone: signalLogEvents.length > 0 ? ("success" as const) : ("default" as const),
    },
    {
      id: "analytics-pnl",
      label: t("performance.paperTitle"),
      value: formatCurrency(paperPerformance.ending_balance - paperPerformance.starting_balance),
      detail: `${formatPercent(paperPerformance.win_rate * 100, false)} · ${paperPerformance.trade_count} ${t("performance.closedTrades")}`,
      tone:
        paperPerformance.ending_balance - paperPerformance.starting_balance >= 0
          ? ("success" as const)
          : ("warning" as const),
    },
  ];
  const operationsTruthItems = [
    {
      id: "operations-engine",
      label: t("hero.execution"),
      value: executionStatusLabel,
      detail: execution.paused_reason ?? t("operator.engineReady"),
      tone: execution.engine_status === "running" ? ("success" as const) : ("warning" as const),
    },
    {
      id: "operations-risk",
      label: t("overview.riskTitle"),
      value: t(riskLabelKey(riskScore)),
      detail: risk.halt_reason ?? t("operator.approvalRequired"),
      tone: riskTone(riskScore) === "red" ? ("danger" as const) : riskTone(riskScore) === "amber" ? ("warning" as const) : ("success" as const),
    },
    {
      id: "operations-live",
      label: t("operator.liveGate"),
      value: risk.live_mode_enabled ? t("operator.liveEnabled") : t("operator.liveLocked"),
      detail: risk.live_mode_reason ?? t("operator.livePrompt"),
      tone: risk.live_mode_enabled ? ("danger" as const) : ("default" as const),
    },
  ];
  const diagnosticsTruthItems = [
    {
      id: "diagnostics-system",
      label: t("runtime.systemStatus"),
      value: systemStatusLabel,
      detail: localizedConnectionMessage,
      tone: viewModel.systemStatus === "normal" ? ("success" as const) : viewModel.systemStatus === "fallback" ? ("warning" as const) : ("danger" as const),
    },
    {
      id: "diagnostics-provider",
      label: t("hero.aiProvider"),
      value: heroProviderLabel,
      detail: snapshot.runtime.exchange_id,
      tone: "info" as const,
    },
    {
      id: "diagnostics-warnings",
      label: t("diagnostics.warnings", { count: snapshot.runtime.warnings.length }),
      value: String(snapshot.runtime.warnings.length),
      detail: t("diagnostics.retries", { count: reconnectAttempts }),
      tone: snapshot.runtime.warnings.length > 0 ? ("warning" as const) : ("success" as const),
    },
  ];
  const readyWorkflowProviders =
    workflow?.providers.filter((provider) => provider.availability === "ready").length ?? 0;
  const effectiveWorkflowProvider =
    workflow?.providers.find((provider) => provider.effective) ?? null;
  const workflowHeaderTruthItems = [
    {
      id: "workflow-stage-summary",
      label: t("workflow.active"),
      value: workflowStageLabel,
      detail: workflowStageDetail,
      tone: "info" as const,
    },
    {
      id: "workflow-provider-summary",
      label: t("workflow.providers"),
      value: `${readyWorkflowProviders}/${workflow?.providers.length ?? 0}`,
      detail:
        effectiveWorkflowProvider?.detail ??
        (effectiveWorkflowProvider
          ? `${t("workflow.effective")} · ${effectiveWorkflowProvider.label}`
          : t("workflow.noProviders")),
      tone: effectiveWorkflowProvider ? ("success" as const) : ("warning" as const),
    },
    {
      id: "workflow-notices-summary",
      label: t("workflow.notices"),
      value: String(workflow?.notices.length ?? 0),
      detail: workflow?.notices[0]?.detail ?? t("workflow.noNotices"),
      tone: (workflow?.notices.length ?? 0) > 0 ? ("warning" as const) : ("success" as const),
    },
  ];
  const marketHeaderTruthItems = [
    {
      id: "market-selected-summary",
      label: t("marketDeck.selected"),
      value: selectedMarket ? `${selectedMarket.symbol} · ${selectedMarket.timeframe}` : systemStatusLabel,
      detail: selectedMarket
        ? `${formatCurrency(selectedMarket.last_price)} · ${formatPercent(selectedMarket.change_percent)}`
        : localizedConnectionMessage,
      tone: "info" as const,
    },
    {
      id: "market-volume-summary",
      label: t("marketDeck.volume"),
      value: selectedMarket ? formatCompactNumber(selectedMarket.volume_24h) : "--",
      detail: selectedMarket ? selectedMarket.exchange_id : snapshot.runtime.exchange_id,
      tone: "info" as const,
    },
    {
      id: "market-orders-summary",
      label: t("hero.execution"),
      value: executionStatusLabel,
      detail:
        selectedRecentOrders.length > 0
          ? `${selectedRecentOrders.length} ${t("performance.tradeCount")}`
          : t("operator.engineReady"),
      tone: execution.engine_status === "running" ? ("success" as const) : ("warning" as const),
    },
  ];
  const overviewHeaderTruthItems = [
    workflowTruthItems[0],
    workflowTruthItems[1],
    operationsTruthItems[1],
  ];
  const activeSectionDescription =
    activeSection === "overview"
      ? t("shell.overviewDescription")
      : activeSection === "market"
        ? t("marketDeck.description")
        : activeSection === "thesis"
          ? t("thesis.description")
          : activeSection === "workflow"
            ? t("shell.workflowDescription")
            : activeSection === "strategy"
              ? t("extensions.description")
              : activeSection === "analytics"
                ? t("analytics.description")
                : activeSection === "operations"
                  ? t("operator.description")
                  : t("diagnostics.description");
  const workspaceHeaderTruthItems =
    activeSection === "overview"
      ? overviewHeaderTruthItems
      : activeSection === "market"
        ? marketHeaderTruthItems
        : activeSection === "thesis"
          ? thesisTruthItems
          : activeSection === "workflow"
            ? workflowHeaderTruthItems
            : activeSection === "strategy"
              ? strategyTruthItems
              : activeSection === "analytics"
                ? analyticsTruthItems
                : activeSection === "operations"
                  ? operationsTruthItems
                  : diagnosticsTruthItems;

  const marketDeckPanel = (
    <Card className="panel-card market-deck workspace-card">
      {showMarketDeckHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("marketDeck.kicker")}</p>
            <CardTitle>{t("marketDeck.title")}</CardTitle>
            <CardDescription>{t("marketDeck.description")}</CardDescription>
          </div>
          <Badge color="cyan">{t("marketDeck.feeds", { count: snapshot.snapshots.length })}</Badge>
        </CardHeader>
      ) : null}
      <CardContent>
        {showMarketTruthStrip ? <SectionTruthStrip items={workflowTruthItems} compact /> : null}
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
                <span className="section-label">{t("marketDeck.selected")}</span>
                <h2>{selectedMarket.symbol}</h2>
              </div>
              <div className="spotlight-metric">
                <strong>{formatCurrency(selectedMarket.last_price)}</strong>
                <span data-positive={selectedMarket.change_percent >= 0}>
                  {formatPercent(selectedMarket.change_percent)}
                </span>
              </div>
              <div className="spotlight-metric compact">
                <span>{t("marketDeck.volume")}</span>
                <strong>{formatCompactNumber(selectedMarket.volume_24h)}</strong>
              </div>
            </div>
            <PriceChart
              candles={selectedMarket.candles}
              markers={priceMarkers}
              onVisibleRangeChange={setMarketChartRange}
              symbol={selectedMarket.symbol}
              timeframe={selectedMarket.timeframe}
              visibleRange={marketChartRange}
            />
            <PnlChart
              candles={selectedMarket.candles}
              quantity={selectedPosition?.quantity ?? 0}
              averageEntryPrice={selectedPosition?.avg_entry_price ?? selectedMarket.last_price}
              onVisibleRangeChange={setMarketChartRange}
              realizedPnl={risk.daily_realized_pnl}
              offsetPnl={nonSelectedUnrealized}
              visibleRange={marketChartRange}
            />
          </>
        ) : (
          <div className="empty-state">{marketEmptyStateMessage}</div>
        )}
      </CardContent>
    </Card>
  );

  const thesisPanel = (
    <Card className="panel-card thesis-panel workspace-card" data-testid="thesis-panel">
      {showThesisHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("thesis.kicker")}</p>
            <CardTitle>{t("thesis.title")}</CardTitle>
            <CardDescription>{t("thesis.description")}</CardDescription>
          </div>
          <Badge color={latestAnalysis?.status === "fallback" ? "amber" : "green"}>
            {latestAnalysis ? formatAnalysisStatus(latestAnalysis.status, t) : t("thesis.pending")}
          </Badge>
        </CardHeader>
      ) : null}
      <CardContent>
        <SectionTruthStrip items={thesisTruthItems} compact />
        {latestAnalysis ? (
          <div className="thesis-layout">
            <div className="thesis-summary-card">
              <div className="thesis-summary-header">
                <div>
                  <span className="section-label">{t("thesis.recommendation")}</span>
                  <h3>
                    {formatRecommendation(latestAnalysis.overall_recommendation, {
                      uppercase: true,
                    })}
                  </h3>
                </div>
                <Badge
                  color={riskTone(riskScore) === "red" ? "red" : "cyan"}
                  title={latestAnalysis.provider}
                >
                  {latestAnalysis.provider}
                </Badge>
              </div>
              <p
                className="clamp-3 copy-break"
                title={latestAnalysis.outputs.at(-1)?.summary ?? t("thesis.noSummary")}
              >
                {latestAnalysis.outputs.at(-1)?.summary ?? t("thesis.noSummary")}
              </p>
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
                      <strong>
                        {summariseRole(role, {
                          formatRole,
                          formatPercent,
                        })}
                      </strong>
                      <p className="clamp-2 copy-break" title={role.summary}>
                        {role.summary}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="event-panel compact-panel">
              <div className="section-kicker">
                <span className="section-label">{t("tape.kicker")}</span>
                <Badge color="cyan">{t("tape.frames", { count: thesisEvents.length })}</Badge>
              </div>
              <div className="event-feed">
                {thesisEvents.map((event) => {
                  const eventSummary = formatEventSummaryLabels(event, t);
                  return (
                    <article
                      className="event-row"
                      data-tone={eventSummary.tone}
                      key={`${event.event_id}-${event.generated_at}`}
                    >
                      <div className="event-head event-head-operator">
                        <span className="event-track">{eventSummary.trackLabel}</span>
                        <strong className="event-outcome">{eventSummary.outcomeLabel}</strong>
                        <span>{formatTime(event.generated_at)}</span>
                      </div>
                      <p className="clamp-2 copy-break" title={describedEvent(event)}>
                        {describedEvent(event)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">{t("thesis.empty")}</div>
        )}
      </CardContent>
    </Card>
  );

  const extensionPanel = (
    <Card className="panel-card extension-panel workspace-card">
      {showStrategyHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("extensions.kicker")}</p>
            <CardTitle>{t("extensions.title")}</CardTitle>
            <CardDescription>{t("extensions.description")}</CardDescription>
          </div>
          <Badge color={strategyStatus.enabled ? "green" : "amber"}>
            {strategyStatus.enabled ? t("strategy.enabled") : t("strategy.disabled")}
          </Badge>
        </CardHeader>
      ) : null}
      <CardContent>
        <SectionTruthStrip items={strategyTruthItems} compact />
        <div className="extension-grid">
          <ThesisEvidencePanel macroRole={thesisMacroRole} />
          <MacroIntelligencePanel
            symbol={selectedInstrument.symbol}
            timeframe={selectedInstrument.timeframe}
          />
          <AgentRuntimePanel
            latestAnalysis={latestAnalysis}
            agentRuntime={agentRuntime}
            execution={execution}
            eventFeed={eventFeed}
          />
          <StrategyFactoryPanel
            status={strategyStatus}
            artifacts={strategyArtifacts}
            pendingAction={pendingAction}
            onToggle={toggleStrategyFactoryAction}
            onGenerate={generateStrategyAction}
          />
        </div>
      </CardContent>
    </Card>
  );

  const analyticsPanel = (
    <Card className="panel-card analytics-panel workspace-card">
      {showAnalyticsHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("analytics.kicker")}</p>
            <CardTitle>{t("analytics.title")}</CardTitle>
            <CardDescription>{t("analytics.description")}</CardDescription>
          </div>
          <Badge color="cyan">
            {t("analytics.signalLog.entries", { count: signalLogEvents.length })}
          </Badge>
        </CardHeader>
      ) : null}
      <CardContent>
        <SectionTruthStrip items={analyticsTruthItems} compact />
        <div className="analytics-grid">
          <SignalLog
            events={signalLogEvents}
            latestAnalysis={latestAnalysis}
            describeEvent={describedEvent}
            summarizeEvent={(event) => formatEventSummaryLabels(event, t)}
          />
          <div className="analytics-side-grid">
            <PerformancePanel
              paperReport={paperPerformance}
              backtestReport={backtestReport}
              pendingAction={pendingAction}
              onRunBacktest={runBacktestAction}
            />
            <PositionsHeatmap cells={heatmapCells} />
            <FactorRadar
              axes={factorAxes}
              recommendation={latestAnalysis?.overall_recommendation ?? "hold"}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const operatorPanel = (
    <Card className="panel-card operator-panel workspace-card">
      {showOperatorHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("operator.kicker")}</p>
            <CardTitle>{t("operator.title")}</CardTitle>
            <CardDescription>{t("operator.description")}</CardDescription>
          </div>
          <Badge color={execution.engine_status === "running" ? "green" : "amber"}>
            {execution.engine_status === "running"
              ? t("operator.executionActive")
              : t("operator.executionPaused")}
          </Badge>
        </CardHeader>
      ) : null}
      <CardContent className="operator-stack">
        <SectionTruthStrip items={operationsTruthItems} compact />
        <div className="operator-card-grid">
          <div className="operator-card">
            <div className="operator-title-row">
              <div>
                <span className="section-label">{t("operator.execution")}</span>
                <h3>
                  {execution.engine_status === "running"
                    ? t("operator.executionActive")
                    : t("operator.executionPaused")}
                </h3>
              </div>
              {execution.engine_status === "running" ? (
                <Play size={18} className="operator-icon active" />
              ) : (
                <Slash size={18} className="operator-icon paused" />
              )}
            </div>
            <p>{execution.paused_reason ?? t("operator.engineReady")}</p>
            <div className="operator-actions two-up">
              <Button onClick={runAnalysisAction} disabled={Boolean(pendingAction)}>
                <Bot size={16} />
                {t("operator.runAnalysis")}
              </Button>
              <Button variant="secondary" onClick={dispatchAction} disabled={Boolean(pendingAction)}>
                <ArrowUpRight size={16} />
                {t("operator.dispatchPaper")}
              </Button>
              {execution.engine_status === "running" ? (
                <Button variant="danger" onClick={pauseExecutionAction} disabled={Boolean(pendingAction)}>
                  <Slash size={16} />
                  {t("operator.pauseEngine")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={resumeExecutionAction} disabled={Boolean(pendingAction)}>
                  <Play size={16} />
                  {t("operator.resumeEngine")}
                </Button>
              )}
            </div>
          </div>

          <div className="operator-card">
            <div className="operator-title-row">
              <div>
                <span className="section-label">{t("operator.risk")}</span>
                <h3>{risk.halted ? t("operator.riskHalt") : t("operator.riskActive")}</h3>
              </div>
              {risk.halted ? (
                <ShieldAlert size={18} className="operator-icon risk" />
              ) : (
                <ShieldCheck size={18} className="operator-icon safe" />
              )}
            </div>
            <p>
              {risk.halt_reason ??
                (risk.policy.require_agent_approval
                  ? t("operator.approvalRequired")
                  : t("operator.approvalOptional"))}
            </p>
            <div className="policy-strip">
              <span>
                {t("operator.maxPosition", {
                  value: formatCurrency(risk.policy.max_position_notional_usd),
                })}
              </span>
              <span>
                {t("operator.dailyLoss", {
                  value: formatCurrency(risk.policy.daily_loss_limit_usd),
                })}
              </span>
            </div>
            <div className="operator-actions two-up">
              {risk.halted ? (
                <Button variant="secondary" onClick={clearRiskHaltAction} disabled={Boolean(pendingAction)}>
                  <ShieldCheck size={16} />
                  {t("operator.clearHalt")}
                </Button>
              ) : (
                <Button variant="danger" onClick={engageRiskHaltAction} disabled={Boolean(pendingAction)}>
                  <Flame size={16} />
                  {t("operator.engageHalt")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="operator-card live-card" data-armed={risk.live_mode_enabled}>
          <div className="operator-title-row">
            <div>
              <span className="section-label">{t("operator.liveGate")}</span>
              <h3>{risk.live_mode_enabled ? t("operator.liveEnabled") : t("operator.liveLocked")}</h3>
            </div>
            <Badge color={risk.live_mode_enabled ? "red" : "amber"}>
              {risk.live_mode_enabled ? t("operator.liveArmed") : t("operator.livePaperFirst")}
            </Badge>
          </div>
          <p>{risk.live_mode_reason ?? t("operator.livePrompt")}</p>
          {!risk.live_mode_enabled ? <p className="live-danger-copy">{t("operator.livePromptDanger")}</p> : null}
          <div className="live-confirm-row">
            <input
              className="live-confirm-input"
              onChange={(event) => setLiveConfirmationText(event.target.value)}
              placeholder={t("operator.livePlaceholder")}
              value={liveConfirmationText}
            />
            {risk.live_mode_enabled ? (
              <Button
                variant="danger"
                onClick={() => requestLiveModeAction(false)}
                disabled={Boolean(pendingAction)}
              >
                {t("operator.disable")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => requestLiveModeAction(true, liveConfirmationText)}
                disabled={Boolean(pendingAction)}
              >
                {t("operator.requestEnable")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const diagnosticsPanel = (
    <Card className="panel-card diagnostics-card workspace-card">
      {showDiagnosticsHeader ? (
        <CardHeader className="panel-headline">
          <div>
            <p className="section-label">{t("diagnostics.kicker")}</p>
            <CardTitle>{t("diagnostics.title")}</CardTitle>
            <CardDescription>{t("diagnostics.description")}</CardDescription>
          </div>
          <Badge color={snapshot.runtime.warnings.length > 0 ? "amber" : "green"}>
            {t("diagnostics.warnings", { count: snapshot.runtime.warnings.length })}
          </Badge>
        </CardHeader>
      ) : null}
      <CardContent className="diagnostics-stack">
        <SectionTruthStrip items={diagnosticsTruthItems} compact />
        <div className="diagnostic-row">
          <div>
            <span className="section-label">{t("diagnostics.cashEquity")}</span>
            <strong>
              {formatCurrency(execution.cash_balance)} / {formatCurrency(execution.equity_estimate)}
            </strong>
          </div>
          <ArrowDownRight size={18} className="muted-icon" />
        </div>
        <div className="diagnostic-row">
          <div>
            <span className="section-label">{t("runtime.marketStatus")}</span>
            <strong>{marketStatusLabel}</strong>
          </div>
          <Activity size={18} className="muted-icon" />
        </div>
        <div className="diagnostic-row">
          <div>
            <span className="section-label">{t("diagnostics.retries")}</span>
            <strong>{reconnectAttempts}</strong>
          </div>
          <Cable size={18} className="muted-icon" />
        </div>
        <div className="diagnostic-row">
          <div>
            <span className="section-label">{t("diagnostics.lastAnalysis")}</span>
            <strong>
              {execution.last_run_id ? execution.last_run_id.slice(0, 8) : t("diagnostics.noneYet")}
            </strong>
          </div>
          <Bot size={18} className="muted-icon" />
        </div>
        <div className="diagnostic-row">
          <div>
              <span className="section-label">{t("hero.aiProvider")}</span>
            <strong className="token-ellipsis" title={heroProviderLabel}>
              {heroProviderLabel}
            </strong>
          </div>
          <Bot size={18} className="muted-icon" />
        </div>
        <div className="diagnostic-row">
          <div>
            <span className="section-label">{t("runtime.marketDetail")}</span>
            <strong
              className="clamp-2 copy-break"
              title={marketData.detail ?? localizedConnectionMessage}
            >
              {marketData.detail ?? localizedConnectionMessage}
            </strong>
          </div>
          <AlertTriangle size={18} className="muted-icon" />
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
          <p className="quiet-copy">{t("diagnostics.clear")}</p>
        )}
      </CardContent>
    </Card>
  );

  const runtimeOverviewPanel = (
    <Card className="panel-card workspace-card runtime-overview-card">
      <CardHeader className="panel-headline">
        <div>
          <p className="section-label">{t("hero.runtimeDigest")}</p>
          <CardTitle>{t("overview.runtimeTitle")}</CardTitle>
          <CardDescription>{t("overview.runtimeDescription")}</CardDescription>
        </div>
        <Badge color={viewModel.systemStatus === "normal" ? "green" : viewModel.systemStatus === "fallback" ? "amber" : "red"}>
          {systemStatusLabel}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="runtime-overview-banner">
          <span>{t("runtime.marketRequested")}</span>
          <strong>{marketDigestCard?.value ?? systemStatusLabel}</strong>
          <p
            className="clamp-2 copy-break"
            title={marketDigestCard?.meta ?? localizedConnectionMessage}
          >
            {marketDigestCard?.meta ?? localizedConnectionMessage}
          </p>
        </div>
        <div className="runtime-overview-grid">
          <article className="runtime-overview-stat">
            <span>{t("runtime.marketEffective")}</span>
            <strong>{resolveMarketSourceLabel(marketData.effective_source, t)}</strong>
          </article>
          <article className="runtime-overview-stat">
            <span>{t("runtime.marketStatus")}</span>
            <strong>{marketStatusLabel}</strong>
          </article>
          <article className="runtime-overview-stat">
            <span>{t("hero.execution")}</span>
            <strong>{viewModel.topStates.execution.toUpperCase()}</strong>
          </article>
          <article className="runtime-overview-stat">
            <span>{t("hero.aiProvider")}</span>
            <strong className="token-ellipsis" title={heroProviderLabel}>
              {heroProviderLabel}
            </strong>
          </article>
          <article className="runtime-overview-stat">
            <span>{t("hero.halt")}</span>
            <strong>
              {viewModel.topStates.halt === "clear" ? t("hero.haltClear") : t("hero.haltEngaged")}
            </strong>
          </article>
          <article className="runtime-overview-stat">
            <span>{t("thesis.title")}</span>
            <strong>
              {latestAnalysis
                ? formatRecommendation(latestAnalysis.overall_recommendation, {
                    uppercase: true,
                  })
                : t("thesis.pending")}
            </strong>
          </article>
        </div>
        <div className="runtime-overview-item">
          <span>{t("thesis.title")}</span>
          <strong>
            {latestAnalysis
              ? `${latestAnalysis.symbol} · ${latestAnalysis.timeframe}`
              : t("thesis.pending")}
          </strong>
          <p
            className="clamp-3 copy-break"
            title={latestAnalysis?.outputs.at(-1)?.summary ?? t("thesis.empty")}
          >
            {latestAnalysis?.outputs.at(-1)?.summary ?? t("thesis.empty")}
          </p>
        </div>
        <div className="runtime-overview-list runtime-overview-list--dense">
          {denseOverviewItems.map((item) => (
            <article className="runtime-overview-item runtime-overview-item--compact" key={item.id}>
              <div className="runtime-overview-line">
                <span>{item.label}</span>
                <strong className="token-ellipsis" title={item.value}>
                  {item.value}
                </strong>
              </div>
              <p className="clamp-2 copy-break" title={item.detail}>
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const workflowStudioPanel = (
    <AgentWorkflowStudio
      workflow={workflow}
      agentRuntime={agentRuntime}
      latestAnalysis={latestAnalysis}
      eventFeed={eventFeed}
      paperPerformance={paperPerformance}
      backtestReport={backtestReport}
      strategyStatus={strategyStatus}
      execution={execution}
      describeEvent={describedEvent}
    />
  );

  const overviewDigestPanel = (
    <Card className="panel-card overview-digest-card workspace-card">
      <CardHeader className="panel-headline">
        <div>
          <p className="section-label">{t("hero.runtimeDigest")}</p>
          <CardTitle>{t("overview.digestTitle")}</CardTitle>
          <CardDescription>{t("overview.digestDescription")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overview-digest-list">
          {digestCards.map(({ item, content }) => (
            <article className="overview-digest-item" data-tone={item.tone} key={item.id}>
              <div className="overview-digest-topline">
                <span>{t(`digest.source.${item.source}`)}</span>
                <strong>{content.label}</strong>
              </div>
              <p>{content.value}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const overviewWorkflowCard = (
    <Card className="panel-card overview-workflow-card workspace-card">
      <CardHeader className="panel-headline">
        <div>
          <p className="section-label">{t("workflow.notices")}</p>
          <CardTitle>{t("overview.operationsTitle")}</CardTitle>
          <CardDescription>{t("overview.operationsDescription")}</CardDescription>
        </div>
        <Badge color={riskTone(riskScore)}>{t(riskLabelKey(riskScore))}</Badge>
      </CardHeader>
      <CardContent>
        <div className="overview-workflow-grid">
          <article>
            <span>{t("workflow.active")}</span>
            <strong>{workflowStageLabel}</strong>
            <p className="clamp-2 copy-break" title={workflowStageDetail}>
              {workflowStageDetail}
            </p>
          </article>
          <article>
            <span>{t("hero.execution")}</span>
            <strong>{executionStatusLabel}</strong>
            <p className="clamp-2 copy-break">{t("overview.paperExecutionDetail")}</p>
          </article>
          <article>
            <span>{t("kpi.positions")}</span>
            <strong>
              {execution.positions.length} · {formatCurrency(totalExposure)}
            </strong>
            <p className="clamp-2 copy-break">{t("kpi.exposureBody")}</p>
          </article>
          <article>
            <span>{t("overview.riskTitle")}</span>
            <strong data-tone={riskTone(riskScore)}>{t(riskLabelKey(riskScore))}</strong>
            <p className="clamp-2 copy-break">
              {formatCurrency(unrealizedPnl)} · {t("kpi.unrealizedBody")}
            </p>
          </article>
          <article>
            <span>{t("hero.aiProvider")}</span>
            <strong className="token-ellipsis" title={heroProviderLabel}>
              {heroProviderLabel}
            </strong>
            <p className="clamp-2 copy-break" title={snapshot.runtime.exchange_id}>
              {snapshot.runtime.exchange_id}
            </p>
          </article>
        </div>
      </CardContent>
    </Card>
  );

  const workspaceContent = (() => {
    switch (activeSection) {
      case "market":
        return <div className="workspace-stack">{marketDeckPanel}</div>;
      case "thesis":
        return <div className="workspace-stack">{thesisPanel}</div>;
      case "workflow":
        return <div className="workspace-stack">{workflowStudioPanel}</div>;
      case "strategy":
        return <div className="workspace-stack">{extensionPanel}</div>;
      case "analytics":
        return <div className="workspace-stack">{analyticsPanel}</div>;
      case "operations":
        return (
          <div className="workspace-section-grid two-column-grid">
            <div className="workspace-stack workspace-column-wide">{operatorPanel}</div>
            <div className="workspace-stack">{diagnosticsPanel}</div>
          </div>
        );
      case "diagnostics":
        return <div className="workspace-stack workspace-column-wide">{diagnosticsPanel}</div>;
      case "overview":
      default:
        return (
          <div className="workspace-section-grid overview-grid overview-grid--focus">
            <div className="overview-column overview-column--primary">
              <div className="workspace-stack">
                {runtimeOverviewPanel}
              </div>
              <div className="workspace-stack overview-secondary-stack">
                {overviewDigestPanel}
                {overviewWorkflowCard}
              </div>
            </div>
            <div className="overview-column overview-column--secondary">
              <div className="workspace-stack">
                {marketDeckPanel}
              </div>
            </div>
          </div>
        );
    }
  })();

  return (
    <main className="terminal-shell">
      <header className="terminal-topbar">
        <div className="terminal-brand">
          <div className="terminal-brand-mark">
            <img className="terminal-brand-logo" src="/branding/sfc-mark.png" alt="SFC-Quant logo" />
          </div>
          <div className="terminal-brand-copy">
            <p className="eyebrow">{t("hero.phase")}</p>
            <h1>SFC-Quant</h1>
            <p data-testid="paper-guard-banner">{t("hero.paperGuard")}</p>
          </div>
        </div>

        <div className="terminal-topbar-focus">
          <span className="terminal-focus-symbol">{selectedMarketBadge}</span>
          <strong>{selectedMarketHeroValue}</strong>
          <span data-positive={selectedMarket ? selectedMarket.change_percent >= 0 : undefined}>
            {selectedMarketHeroMeta}
          </span>
        </div>

        <div className="terminal-topbar-actions">
          <div className="terminal-status-strip">
            <div
              className="terminal-status-chip"
              data-testid="execution-mode-chip"
              data-tone={viewModel.topStates.execution === "paper" ? "success" : "danger"}
            >
              <span>{t("hero.execution")}</span>
              <strong>{viewModel.topStates.execution.toUpperCase()}</strong>
            </div>
            <div
              className="terminal-status-chip"
              data-testid="system-status-chip"
              data-tone={
                viewModel.topStates.system === "normal"
                  ? "success"
                  : viewModel.topStates.system === "fallback"
                    ? "warning"
                    : "danger"
              }
            >
              <span>{t("runtime.systemStatus")}</span>
              <strong>{systemStatusLabel}</strong>
            </div>
            <div
              className="terminal-status-chip"
              data-testid="risk-halt-chip"
              data-tone={viewModel.topStates.halt === "clear" ? "success" : "danger"}
            >
              <span>{t("hero.halt")}</span>
              <strong>
                {viewModel.topStates.halt === "clear" ? t("hero.haltClear") : t("hero.haltEngaged")}
              </strong>
            </div>
          </div>
          <div className="terminal-locale-switcher">
            <Button
              variant={locale === "zh-CN" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLocale("zh-CN")}
            >
              {t("language.chinese")}
            </Button>
            <Button
              variant={locale === "en" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLocale("en")}
            >
              {t("language.english")}
            </Button>
          </div>
        </div>
      </header>

      <div className="terminal-layout">
        <aside className="terminal-sidebar">
          <div className="terminal-sidebar-card">
            <p className="section-label">{t("shell.navigation")}</p>
            <nav className="terminal-nav" aria-label={t("shell.navigation")}>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="terminal-nav-item"
                    data-active={active}
                    onClick={() => setActiveSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                  >
                    <span className="terminal-nav-icon">
                      <Icon size={18} />
                    </span>
                    <span className="terminal-nav-copy">
                      <strong>{item.label}</strong>
                      <small>{item.meta}</small>
                    </span>
                    <ChevronRight size={16} className="terminal-nav-arrow" />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="terminal-main">
          <div className="workspace-header-card">
            <div className="workspace-header-upper">
              <div>
                <p className="section-label">{activeNavigationItem.meta}</p>
                <h2>{activeNavigationItem.label}</h2>
                <p className="clamp-2 copy-break" title={activeSectionDescription}>
                  {activeSectionDescription}
                </p>
              </div>
              <div className="workspace-header-meta" data-testid="requested-market-source">
                <span>{t("runtime.marketRequested")}</span>
                <strong>{marketDigestCard?.value ?? systemStatusLabel}</strong>
                <p
                  className="clamp-2 copy-break"
                  title={marketDigestCard?.meta ?? localizedConnectionMessage}
                >
                  {marketDigestCard?.meta ?? localizedConnectionMessage}
                </p>
              </div>
            </div>
            <div className="workspace-header-lower">
              <SectionTruthStrip items={workspaceHeaderTruthItems} compact />
              <div className="workspace-header-actions">{quickActionButtons}</div>
            </div>
          </div>

          <motion.div
            key={activeSection}
            className="workspace-surface"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
          >
            {workspaceContent}
          </motion.div>
        </section>

      </div>
    </main>
  );
}

import type {
  AnalysisRunResult,
  EventEnvelope,
  ExecutionStatusResponse,
  MarketSnapshotResponse,
  RiskStatusResponse,
  StrategyFactoryStatusResponse,
} from "./market";

type ConnectionStatus = "connecting" | "live" | "reconnecting" | "degraded" | "closed";

export type DashboardSystemStatus = "normal" | "fallback" | "degraded";
export type DashboardTone = "neutral" | "success" | "warning" | "danger";
export type DigestSource = "execution" | "market" | "system" | "thesis" | "strategy";
export type DashboardDigestId = "execution" | "market" | "system" | "thesis" | "strategy";
export type DashboardEventTrack = "system" | "market" | "agent" | "execution" | "risk" | "strategy";
export type DashboardEventOutcome =
  | "warning"
  | "connected"
  | "snapshot"
  | "tick"
  | "analysisRequested"
  | "roleCompleted"
  | "analysisCompleted"
  | "signalApproved"
  | "signalBlocked"
  | "orderFilled"
  | "enginePaused"
  | "engineResumed"
  | "policyUpdated"
  | "approvalDenied"
  | "approvalGranted"
  | "haltTriggered"
  | "haltCleared"
  | "liveMode"
  | "strategyUpdated"
  | "strategyStarted"
  | "strategyGenerated"
  | "strategyFailed";

export type DashboardDigestItem =
  | {
      id: "execution";
      source: "execution";
      tone: DashboardTone;
      engineStatus: ExecutionStatusResponse["engine_status"];
      executionMode: string;
      lastRunId: string | null;
    }
  | {
      id: "market";
      source: "market";
      tone: DashboardTone;
      requestedSource: string;
      effectiveSource: string;
      marketStatus: string;
      latestEventAt: string | null;
      detail: string | null;
    }
  | {
      id: "system";
      source: "system";
      tone: DashboardTone;
      connectionStatus: ConnectionStatus;
      reconnectAttempts: number;
      detail: string | null;
    }
  | {
      id: "thesis";
      source: "thesis";
      tone: DashboardTone;
      recommendation: AnalysisRunResult["overall_recommendation"] | null;
      status: AnalysisRunResult["status"] | null;
      symbol: string | null;
      timeframe: string | null;
    }
  | {
      id: "strategy";
      source: "strategy";
      tone: DashboardTone;
      enabled: boolean;
      generationStatus: StrategyFactoryStatusResponse["generation"]["status"];
      effectiveProvider: StrategyFactoryStatusResponse["effective_provider"];
      artifactCount: number;
    };

export type DashboardGateItem = {
  id: "halt" | "approval" | "live";
  active: boolean;
  value: string;
};

export type DashboardEventSummary = {
  track: DashboardEventTrack;
  outcome: DashboardEventOutcome;
  tone: "risk" | "agent" | "execution" | "market" | "system" | "strategy";
};

export type DashboardViewModel = {
  systemStatus: DashboardSystemStatus;
  realSourceRequested: boolean;
  digestItems: DashboardDigestItem[];
  riskGateItems: DashboardGateItem[];
  topStates: {
    execution: string;
    halt: "engaged" | "clear";
    system: DashboardSystemStatus;
  };
};

function normalizeSystemStatus(
  marketStatus: string,
  fallbackActive: boolean,
  connectionStatus: ConnectionStatus,
  marketMode: string,
  snapshotCount: number,
): DashboardSystemStatus {
  if (fallbackActive || marketStatus === "fallback") {
    return "fallback";
  }
  if (
    marketStatus === "degraded" ||
    connectionStatus === "degraded" ||
    connectionStatus === "closed" ||
    (marketMode === "real" && snapshotCount === 0)
  ) {
    return "degraded";
  }
  return "normal";
}

export function deriveDashboardEventSummary(event: EventEnvelope): DashboardEventSummary {
  switch (event.event_type) {
    case "system.warning":
      return { track: "system", outcome: "warning", tone: "system" };
    case "system.connected":
      return { track: "system", outcome: "connected", tone: "system" };
    case "market.snapshot":
      return { track: "market", outcome: "snapshot", tone: "market" };
    case "market.tick":
      return { track: "market", outcome: "tick", tone: "market" };
    case "agent.analysis.requested":
      return { track: "agent", outcome: "analysisRequested", tone: "agent" };
    case "agent.role.completed":
      return { track: "agent", outcome: "roleCompleted", tone: "agent" };
    case "agent.analysis.completed":
      return { track: "agent", outcome: "analysisCompleted", tone: "agent" };
    case "execution.signal.approved":
      return { track: "execution", outcome: "signalApproved", tone: "execution" };
    case "execution.signal.blocked":
    case "execution.signal.skipped":
      return { track: "execution", outcome: "signalBlocked", tone: "execution" };
    case "execution.order.filled":
      return { track: "execution", outcome: "orderFilled", tone: "execution" };
    case "execution.engine.paused":
      return { track: "execution", outcome: "enginePaused", tone: "execution" };
    case "execution.engine.resumed":
      return { track: "execution", outcome: "engineResumed", tone: "execution" };
    case "risk.policy.updated":
      return { track: "risk", outcome: "policyUpdated", tone: "risk" };
    case "risk.approval.denied":
      return { track: "risk", outcome: "approvalDenied", tone: "risk" };
    case "risk.approval.granted":
      return { track: "risk", outcome: "approvalGranted", tone: "risk" };
    case "risk.halt.triggered":
      return { track: "risk", outcome: "haltTriggered", tone: "risk" };
    case "risk.halt.cleared":
      return { track: "risk", outcome: "haltCleared", tone: "risk" };
    case "risk.live_mode.enabled":
    case "risk.live_mode.disabled":
      return { track: "risk", outcome: "liveMode", tone: "risk" };
    case "strategy.factory.config.updated":
      return { track: "strategy", outcome: "strategyUpdated", tone: "strategy" };
    case "strategy.factory.started":
      return { track: "strategy", outcome: "strategyStarted", tone: "strategy" };
    case "strategy.factory.generated":
      return { track: "strategy", outcome: "strategyGenerated", tone: "strategy" };
    case "strategy.factory.failed":
      return { track: "strategy", outcome: "strategyFailed", tone: "strategy" };
    default:
      return { track: "system", outcome: "warning", tone: "system" };
  }
}

export function deriveDashboardViewModel(args: {
  snapshot: MarketSnapshotResponse;
  execution: ExecutionStatusResponse;
  risk: RiskStatusResponse;
  strategyStatus: StrategyFactoryStatusResponse;
  latestAnalysis: AnalysisRunResult | null;
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  lastEventAt: string | null;
  eventFeed: EventEnvelope[];
}): DashboardViewModel {
  const marketData =
    args.snapshot?.market_data ??
    args.snapshot?.runtime?.market_data ?? {
      mode: "mock",
      requested_source: "mock",
      effective_source: "mock",
      status: "fallback",
      fallback_active: true,
      detail: "Market metadata unavailable.",
    };
  const marketMode = typeof marketData.mode === "string" ? marketData.mode.toLowerCase() : "mock";
  const marketStatus =
    typeof marketData.status === "string" ? marketData.status.toLowerCase() : "fallback";
  const snapshotCount = Array.isArray(args.snapshot?.snapshots) ? args.snapshot.snapshots.length : 0;
  const systemStatus = normalizeSystemStatus(
    marketStatus,
    marketData.fallback_active,
    args.connectionStatus,
    marketMode,
    snapshotCount,
  );

  const latestEventTime = args.lastEventAt ?? args.eventFeed[0]?.generated_at ?? null;
  const realSourceRequested =
    marketMode === "real" ||
    (typeof marketData.requested_source === "string"
      ? marketData.requested_source.toLowerCase()
      : "mock") !== "mock" ||
    (typeof marketData.effective_source === "string"
      ? marketData.effective_source.toLowerCase()
      : "mock") !== "mock";

  const digestItems: DashboardDigestItem[] = [
    {
      id: "execution",
      source: "execution",
      engineStatus: args.execution.engine_status,
      executionMode: args.execution.execution_mode,
      lastRunId: args.execution.last_run_id,
      tone: args.execution.engine_status === "running" ? "success" : "warning",
    },
    {
      id: "market",
      source: "market",
      requestedSource: marketData.requested_source,
      effectiveSource: marketData.effective_source,
      marketStatus,
      latestEventAt: latestEventTime,
      detail: marketData.detail,
      tone:
        systemStatus === "normal"
          ? "success"
          : systemStatus === "fallback"
            ? "warning"
            : "danger",
    },
    {
      id: "system",
      source: "system",
      connectionStatus: args.connectionStatus,
      reconnectAttempts: args.reconnectAttempts,
      detail: marketData.detail,
      tone:
        args.connectionStatus === "live"
          ? "success"
          : args.connectionStatus === "reconnecting" || args.connectionStatus === "connecting"
            ? "warning"
            : "danger",
    },
    {
      id: "thesis",
      source: "thesis",
      recommendation: args.latestAnalysis?.overall_recommendation ?? null,
      status: args.latestAnalysis?.status ?? null,
      symbol: args.latestAnalysis?.symbol ?? null,
      timeframe: args.latestAnalysis?.timeframe ?? null,
      tone:
        args.latestAnalysis?.status === "completed"
          ? "success"
          : args.latestAnalysis?.status === "fallback"
            ? "warning"
            : "neutral",
    },
    {
      id: "strategy",
      source: "strategy",
      enabled: args.strategyStatus.enabled,
      generationStatus: args.strategyStatus.generation.status,
      effectiveProvider: args.strategyStatus.effective_provider,
      artifactCount: args.strategyStatus.artifact_count,
      tone:
        args.strategyStatus.generation.status === "completed"
          ? "success"
          : args.strategyStatus.generation.status === "failed" ||
              args.strategyStatus.generation.status === "timeout"
            ? "danger"
            : args.strategyStatus.enabled
              ? "warning"
              : "neutral",
    },
  ];

  const riskGateItems: DashboardGateItem[] = [
    {
      id: "halt",
      active: args.risk.halted,
      value: args.risk.halted ? "engaged" : "clear",
    },
    {
      id: "approval",
      active: args.risk.policy.require_agent_approval,
      value: args.risk.policy.require_agent_approval ? "required" : "optional",
    },
    {
      id: "live",
      active: args.risk.live_mode_enabled,
      value: args.risk.live_mode_enabled ? "armed" : "paper-first",
    },
  ];

  return {
    systemStatus,
    realSourceRequested,
    digestItems,
    riskGateItems,
    topStates: {
      execution: args.execution.execution_mode,
      halt: args.risk.halted ? "engaged" : "clear",
      system: systemStatus,
    },
  };
}

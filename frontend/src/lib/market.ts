export type MarketDataRuntime = {
  mode: string;
  requested_source: string;
  effective_source: string;
  status: string;
  fallback_active: boolean;
  detail: string | null;
};

export type RuntimeSnapshot = {
  name: string;
  service: string;
  status: string;
  app_env: string;
  app_mode: string;
  runtime_mode: string;
  market_data: MarketDataRuntime;
  ai_provider: string;
  ai_model: string | null;
  exchange_id: string;
  execution_mode: string;
  execution_adapter: string;
  ai_credentials_present: boolean;
  exchange_credentials_present: boolean;
  live_trading_requested: boolean;
  live_trading_enabled: boolean;
  warnings: string[];
};

export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketSnapshot = {
  symbol: string;
  timeframe: string;
  exchange_id: string;
  source: string;
  generated_at: string;
  last_price: number;
  change_percent: number;
  volume_24h: number;
  candles: Candle[];
};

export type EventEnvelope = {
  event_id: string;
  event_type: string;
  generated_at: string;
  source: string;
  payload: Record<string, unknown>;
};

export type MarketSnapshotResponse = {
  generated_at: string;
  runtime: RuntimeSnapshot;
  market_data: MarketDataRuntime;
  snapshots: MarketSnapshot[];
  recent_events: EventEnvelope[];
};

export type AgentRole =
  | "data"
  | "technical_analysis"
  | "news_geopolitics"
  | "risk_decision";

export type EvidencePoint = {
  label: string;
  detail: string;
  kind: "market" | "technical" | "news" | "macro" | "risk" | "internal";
};

export type SourceReference = {
  title: string;
  kind: "exchange" | "macro" | "news" | "internal" | "provider";
  url: string | null;
  note: string | null;
};

export type MacroCatalyst = {
  label: string;
  detail: string;
  impact: "bullish" | "bearish" | "neutral" | "cautious";
  horizon: "intraday" | "swing" | "macro";
};

export type MacroWatchItem = {
  label: string;
  trigger: string;
  implication: string;
};

export type MacroThesis = {
  regime: string;
  stance: "bullish" | "bearish" | "neutral" | "cautious";
  summary: string;
  catalysts: MacroCatalyst[];
  watch_items: MacroWatchItem[];
};

export type AgentAnalysisResult = {
  role: AgentRole;
  status: "completed" | "fallback";
  provider: string;
  model: string;
  generated_at: string;
  latency_ms: number | null;
  signal_bias: string;
  recommendation: "buy" | "sell" | "hold" | "reduce" | "wait";
  confidence: number;
  summary: string;
  rationale: string[];
  evidence: EvidencePoint[];
  sources: SourceReference[];
  macro_thesis: MacroThesis | null;
};

export type AnalysisRunResult = {
  run_id: string;
  symbol: string;
  timeframe: string;
  trigger: "manual" | "scheduled";
  status: "completed" | "fallback";
  provider: string;
  model: string;
  started_at: string;
  completed_at: string;
  market_snapshot: MarketSnapshot;
  outputs: AgentAnalysisResult[];
  overall_recommendation: "buy" | "sell" | "hold" | "reduce" | "wait";
};

export type ExecutionOrder = {
  order_id: string;
  run_id: string;
  symbol: string;
  timeframe: string;
  side: "buy" | "sell";
  status: "created" | "submitted" | "filled" | "skipped" | "blocked";
  quantity: number;
  requested_notional: number;
  fill_price: number | null;
  fill_value: number | null;
  fee_paid: number;
  adapter: string;
  adapter_trade_id?: string | null;
  adapter_detail?: string | null;
  created_at: string;
  filled_at: string | null;
  rationale_summary: string;
};

export type PaperPosition = {
  symbol: string;
  quantity: number;
  avg_entry_price: number;
  market_price: number;
  unrealized_pnl: number;
  adapter_trade_id?: string | null;
  updated_at: string;
};

export type ExecutionAdapterRuntime = {
  configured: boolean;
  status: "mock" | "connected" | "degraded" | "offline";
  detail: string;
  last_checked_at: string | null;
  last_error: string | null;
  endpoint: string | null;
};

export type ExecutionStatusResponse = {
  engine_status: "running" | "paused";
  execution_mode: string;
  adapter: string;
  adapter_runtime: ExecutionAdapterRuntime;
  starting_balance: number;
  cash_balance: number;
  equity_estimate: number;
  last_run_id: string | null;
  paused_reason: string | null;
  recent_orders: ExecutionOrder[];
  positions: PaperPosition[];
};

export type ExecutionDispatchResult = {
  engine_status: "running" | "paused";
  message: string;
  analysis: AnalysisRunResult;
  order: ExecutionOrder | null;
  status: ExecutionStatusResponse;
};

export type RiskPolicy = {
  max_position_notional_usd: number;
  max_concurrent_trades: number;
  daily_loss_limit_usd: number;
  blocked_symbols: string[];
  require_agent_approval: boolean;
  min_approval_confidence: number;
};

export type RiskStatusResponse = {
  policy: RiskPolicy;
  halted: boolean;
  halt_reason: string | null;
  daily_realized_pnl: number;
  live_mode_enabled: boolean;
  live_mode_reason: string | null;
};

export type StrategyArtifactFile = {
  path: string;
  kind: "markdown" | "json" | "python" | "text";
};

export type StrategyInvocationArtifact = {
  label: string;
  path: string;
  kind: "markdown" | "json" | "python" | "text";
  exists: boolean;
};

export type StrategyGenerationLogEntry = {
  generated_at: string;
  level: "info" | "warning" | "error";
  phase:
    | "idle"
    | "preparing"
    | "writing_artifacts"
    | "invoking_provider"
    | "collecting_artifacts"
    | "completed"
    | "failed"
    | "timeout";
  provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external" | null;
  message: string;
};

export type StrategyProviderRun = {
  provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  label: string;
  command: string[];
  status: "completed" | "failed" | "timeout";
  started_at: string | null;
  completed_at: string | null;
  returncode: number | null;
  timeout_seconds: number | null;
  detail: string | null;
  artifacts: StrategyInvocationArtifact[];
};

export type StrategyArtifact = {
  artifact_id: string;
  symbol: string;
  timeframe: string;
  run_id: string;
  created_at: string;
  configured_provider: string;
  effective_provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  recommendation: "buy" | "sell" | "hold" | "reduce" | "wait";
  summary: string;
  directory: string;
  files: StrategyArtifactFile[];
  provider_run: StrategyProviderRun | null;
};

export type StrategyGenerationState = {
  status: "idle" | "running" | "completed" | "failed" | "timeout";
  phase:
    | "idle"
    | "preparing"
    | "writing_artifacts"
    | "invoking_provider"
    | "collecting_artifacts"
    | "completed"
    | "failed"
    | "timeout";
  symbol: string | null;
  timeframe: string | null;
  run_id: string | null;
  active_provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external" | null;
  provider_label: string | null;
  artifact_directory: string | null;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  detail: string | null;
  stdout_path: string | null;
  stderr_path: string | null;
  run_meta_path: string | null;
  logs: StrategyGenerationLogEntry[];
  artifacts: StrategyInvocationArtifact[];
};

export type StrategyProviderRuntime = {
  provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  label: string;
  configured: boolean;
  effective: boolean;
  available: boolean;
  availability: "ready" | "fallback" | "unavailable";
  reason: string | null;
  command: string | null;
  timeout_seconds: number | null;
  requires_docker: boolean;
  invocation_prefix: string | null;
};

export type StrategyFactoryStatusResponse = {
  enabled: boolean;
  configured_provider: string;
  effective_provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  workspace: string;
  auto_generate: boolean;
  reason: string | null;
  artifact_count: number;
  latest_artifact: StrategyArtifact | null;
  generation: StrategyGenerationState;
  providers: StrategyProviderRuntime[];
};

export type StrategyGenerationResponse = {
  message: string;
  artifact: StrategyArtifact;
  status: StrategyFactoryStatusResponse;
};

export type AgentRuntimeRecord = {
  agent_id: string;
  category: "strategy_factory";
  provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  label: string;
  enabled: boolean;
  configured: boolean;
  effective: boolean;
  available: boolean;
  status: "disabled" | "ready" | "running" | "completed" | "failed" | "timeout" | "fallback" | "unavailable";
  phase: StrategyGenerationState["phase"];
  symbol: string | null;
  timeframe: string | null;
  run_id: string | null;
  detail: string | null;
  workspace: string;
  artifact_directory: string | null;
  latest_artifact_directory: string | null;
  started_at: string | null;
  completed_at: string | null;
  logs: StrategyGenerationLogEntry[];
  artifacts: StrategyInvocationArtifact[];
};

export type AgentRuntimeSummaryResponse = {
  generated_at: string;
  strategy_factory_enabled: boolean;
  configured_provider: string;
  effective_provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  agents: AgentRuntimeRecord[];
};

export type EquityCurvePoint = {
  timestamp: string;
  equity: number;
  cash_balance: number;
  drawdown: number;
  drawdown_amount: number;
};

export type PerformanceTrade = {
  trade_id: string;
  symbol: string;
  timeframe: string;
  opened_at: string;
  closed_at: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_percent: number;
  fees_paid: number;
  outcome: "win" | "loss" | "flat";
  run_id: string | null;
};

export type PerformanceReport = {
  mode: "paper" | "backtest";
  symbol: string | null;
  timeframe: string | null;
  source: string | null;
  strategy: string | null;
  starting_balance: number;
  ending_balance: number;
  total_return: number;
  max_drawdown: number;
  win_rate: number;
  trade_count: number;
  candle_count: number | null;
  equity_curve: EquityCurvePoint[];
  trades: PerformanceTrade[];
};

export type IntelligenceProviderStatus = {
  provider: "coingecko" | "fred" | "eia" | "finnhub";
  configured: boolean;
  available: boolean;
  detail: string;
};

export type IntelligenceMetric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  change_percent: number | null;
  as_of: string | null;
  source: "coingecko" | "fred" | "eia";
  url: string | null;
};

export type IntelligenceHeadline = {
  title: string;
  source: string;
  url: string;
  published_at: string | null;
  category: string;
};

export type IntelligenceSnapshotResponse = {
  generated_at: string;
  focus_symbol: string;
  focus_timeframe: string;
  status: "ready" | "partial" | "unavailable";
  summary: string;
  providers: IntelligenceProviderStatus[];
  crypto: IntelligenceMetric[];
  macro: IntelligenceMetric[];
  energy: IntelligenceMetric[];
  headlines: IntelligenceHeadline[];
  warnings: string[];
};

export const fallbackRuntimeSnapshot: RuntimeSnapshot = {
  name: "SFC-Quant",
  service: "backend",
  status: "degraded",
  app_env: "development",
  app_mode: "mock",
  runtime_mode: "paper",
  market_data: {
    mode: "mock",
    requested_source: "mock",
    effective_source: "mock",
    status: "fallback",
    fallback_active: true,
    detail: "Backend unavailable. Frontend fallback metadata is active.",
  },
  ai_provider: "mock",
  ai_model: "gpt-5.4",
  exchange_id: "binance",
  execution_mode: "paper",
  execution_adapter: "freqtrade_mock",
  ai_credentials_present: false,
  exchange_credentials_present: false,
  live_trading_requested: false,
  live_trading_enabled: false,
  warnings: ["Backend unavailable - showing local fallback runtime metadata."],
};

export const fallbackMarketSnapshot: MarketSnapshotResponse = {
  generated_at: new Date().toISOString(),
  runtime: fallbackRuntimeSnapshot,
  market_data: fallbackRuntimeSnapshot.market_data,
  snapshots: [],
  recent_events: [
    {
      event_id: "fallback-warning",
      event_type: "system.warning",
      generated_at: new Date().toISOString(),
      source: "frontend",
      payload: {
        message: "Backend unavailable - using local fallback market state.",
      },
    },
  ],
};

export const fallbackExecutionStatus: ExecutionStatusResponse = {
  engine_status: "paused",
  execution_mode: "paper",
  adapter: "freqtrade_mock",
  adapter_runtime: {
    configured: true,
    status: "mock",
    detail: "Execution runtime unavailable. Local fallback adapter metadata is active.",
    last_checked_at: null,
    last_error: null,
    endpoint: null,
  },
  starting_balance: 10000,
  cash_balance: 10000,
  equity_estimate: 10000,
  last_run_id: null,
  paused_reason: "Execution runtime unavailable.",
  recent_orders: [],
  positions: [],
};

export const fallbackRiskStatus: RiskStatusResponse = {
  policy: {
    max_position_notional_usd: 1000,
    max_concurrent_trades: 3,
    daily_loss_limit_usd: 250,
    blocked_symbols: [],
    require_agent_approval: true,
    min_approval_confidence: 0.55,
  },
  halted: false,
  halt_reason: null,
  daily_realized_pnl: 0,
  live_mode_enabled: false,
  live_mode_reason: "Risk runtime unavailable.",
};

export const fallbackStrategyStatus: StrategyFactoryStatusResponse = {
  enabled: false,
  configured_provider: "mock_rdq",
  effective_provider: "mock_rdq",
  workspace: "./var/strategy_factory",
  auto_generate: false,
  reason: "Strategy Factory runtime unavailable.",
  artifact_count: 0,
  latest_artifact: null,
  generation: {
    status: "idle",
    phase: "idle",
    symbol: null,
    timeframe: null,
    run_id: null,
    active_provider: null,
    provider_label: null,
    artifact_directory: null,
    started_at: null,
    updated_at: null,
    completed_at: null,
    detail: null,
    stdout_path: null,
    stderr_path: null,
    run_meta_path: null,
    logs: [],
    artifacts: [],
  },
  providers: [],
};

export const fallbackAgentRuntime: AgentRuntimeSummaryResponse = {
  generated_at: new Date().toISOString(),
  strategy_factory_enabled: false,
  configured_provider: "mock_rdq",
  effective_provider: "mock_rdq",
  agents: [],
};

export const fallbackPerformanceReport: PerformanceReport = {
  mode: "paper",
  symbol: null,
  timeframe: null,
  source: null,
  strategy: null,
  starting_balance: 10000,
  ending_balance: 10000,
  total_return: 0,
  max_drawdown: 0,
  win_rate: 0,
  trade_count: 0,
  candle_count: 0,
  equity_curve: [],
  trades: [],
};

export const fallbackIntelligenceSnapshot: IntelligenceSnapshotResponse = {
  generated_at: new Date().toISOString(),
  focus_symbol: "BTC/USDT",
  focus_timeframe: "1m",
  status: "unavailable",
  summary: "External intelligence is unavailable.",
  providers: [],
  crypto: [],
  macro: [],
  energy: [],
  headlines: [],
  warnings: [],
};

function normalizeMarketSnapshotResponse(
  payload: Partial<MarketSnapshotResponse> | null | undefined,
): MarketSnapshotResponse {
  const runtime = {
    ...fallbackRuntimeSnapshot,
    ...(payload?.runtime ?? {}),
  };
  const marketData = payload?.market_data ?? runtime.market_data ?? fallbackRuntimeSnapshot.market_data;

  return {
    generated_at: payload?.generated_at ?? new Date().toISOString(),
    runtime: {
      ...runtime,
      market_data: marketData,
    },
    market_data: marketData,
    snapshots: Array.isArray(payload?.snapshots) ? payload!.snapshots : [],
    recent_events: Array.isArray(payload?.recent_events) ? payload!.recent_events : [],
  };
}

function normalizeStrategyStatusResponse(
  payload: Partial<StrategyFactoryStatusResponse> | null | undefined,
): StrategyFactoryStatusResponse {
  return {
    ...fallbackStrategyStatus,
    ...(payload ?? {}),
    generation: {
      ...fallbackStrategyStatus.generation,
      ...(payload?.generation ?? {}),
    },
    providers: Array.isArray(payload?.providers) ? payload.providers : [],
  };
}

function readEnvValue(key: "VITE_API_BASE_URL" | "VITE_WS_URL"): string | undefined {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function resolveBackendBaseUrl(): string {
  const configured = readEnvValue("VITE_API_BASE_URL");
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  return "";
}

export function resolveBackendWsUrl(): string {
  const configured = readEnvValue("VITE_WS_URL");
  if (configured) {
    return configured;
  }

  if (typeof window === "undefined") {
    return "ws://localhost:8000/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveBackendBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let detail = `${path} failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Ignore parsing errors and keep the HTTP status fallback.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function loadMarketSnapshot(): Promise<MarketSnapshotResponse> {
  try {
    const payload = await requestJson<MarketSnapshotResponse>("/api/market/snapshot");
    return normalizeMarketSnapshotResponse(payload);
  } catch {
    return fallbackMarketSnapshot;
  }
}

export async function loadExecutionStatus(): Promise<ExecutionStatusResponse> {
  try {
    return await requestJson<ExecutionStatusResponse>("/api/execution/status");
  } catch {
    return fallbackExecutionStatus;
  }
}

export async function loadRiskStatus(): Promise<RiskStatusResponse> {
  try {
    return await requestJson<RiskStatusResponse>("/api/risk/status");
  } catch {
    return fallbackRiskStatus;
  }
}

export async function loadStrategyStatus(): Promise<StrategyFactoryStatusResponse> {
  try {
    const payload = await requestJson<StrategyFactoryStatusResponse>("/api/strategy/status");
    return normalizeStrategyStatusResponse(payload);
  } catch {
    return fallbackStrategyStatus;
  }
}

export async function loadAgentRuntime(): Promise<AgentRuntimeSummaryResponse> {
  try {
    return await requestJson<AgentRuntimeSummaryResponse>("/api/agents/runtime");
  } catch {
    return fallbackAgentRuntime;
  }
}

export async function loadPaperPerformance(): Promise<PerformanceReport> {
  try {
    return await requestJson<PerformanceReport>("/api/performance/paper");
  } catch {
    return fallbackPerformanceReport;
  }
}

export async function loadIntelligenceSnapshot(params: {
  symbol: string;
  timeframe: string;
}): Promise<IntelligenceSnapshotResponse> {
  const search = new URLSearchParams(params);
  try {
    return await requestJson<IntelligenceSnapshotResponse>(
      `/api/intelligence/macro?${search.toString()}`,
    );
  } catch {
    return {
      ...fallbackIntelligenceSnapshot,
      focus_symbol: params.symbol,
      focus_timeframe: params.timeframe,
    };
  }
}

export async function runBacktest(payload: {
  symbol?: string;
  timeframe?: string;
}): Promise<PerformanceReport> {
  return requestJson<PerformanceReport>("/api/backtest/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadStrategyArtifacts(params?: {
  symbol?: string;
  timeframe?: string;
  limit?: number;
}): Promise<StrategyArtifact[]> {
  const search = new URLSearchParams();
  if (params?.symbol) {
    search.set("symbol", params.symbol);
  }
  if (params?.timeframe) {
    search.set("timeframe", params.timeframe);
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  try {
    return await requestJson<StrategyArtifact[]>(`/api/strategy/artifacts${suffix}`);
  } catch {
    return [];
  }
}

export async function loadLatestAnalysis(params: {
  symbol: string;
  timeframe: string;
}): Promise<AnalysisRunResult | null> {
  const search = new URLSearchParams(params);
  try {
    return await requestJson<AnalysisRunResult>(`/api/analysis/latest?${search.toString()}`);
  } catch {
    return null;
  }
}

export async function runAnalysis(params: {
  symbol: string;
  timeframe: string;
  notes?: string;
}): Promise<AnalysisRunResult> {
  return requestJson<AnalysisRunResult>("/api/analysis/run", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function dispatchExecution(params: {
  symbol: string;
  timeframe: string;
  notes?: string;
}): Promise<ExecutionDispatchResult> {
  return requestJson<ExecutionDispatchResult>("/api/execution/dispatch", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function controlExecution(action: {
  action: "pause" | "resume";
  reason?: string;
}): Promise<ExecutionStatusResponse> {
  return requestJson<ExecutionStatusResponse>("/api/execution/control", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function controlRiskHalt(action: {
  action: "halt" | "clear";
  reason?: string;
}): Promise<RiskStatusResponse> {
  return requestJson<RiskStatusResponse>("/api/risk/halt", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function requestLiveMode(payload: {
  enable: boolean;
  confirmation_text?: string;
}): Promise<RiskStatusResponse> {
  return requestJson<RiskStatusResponse>("/api/risk/live-mode", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStrategyConfig(payload: {
  enabled?: boolean;
  provider?: string;
  auto_generate?: boolean;
}): Promise<StrategyFactoryStatusResponse> {
  return requestJson<StrategyFactoryStatusResponse>("/api/strategy/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateStrategyArtifact(payload: {
  symbol: string;
  timeframe: string;
  notes?: string;
}): Promise<StrategyGenerationResponse> {
  return requestJson<StrategyGenerationResponse>("/api/strategy/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

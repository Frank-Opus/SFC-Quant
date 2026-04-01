export type RuntimeSnapshot = {
  name: string;
  service: string;
  status: string;
  app_env: string;
  app_mode: string;
  runtime_mode: string;
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
  snapshots: MarketSnapshot[];
  recent_events: EventEnvelope[];
};

export type AgentRole =
  | "data"
  | "technical_analysis"
  | "news_geopolitics"
  | "risk_decision";

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
  updated_at: string;
};

export type ExecutionStatusResponse = {
  engine_status: "running" | "paused";
  execution_mode: string;
  adapter: string;
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

export const fallbackRuntimeSnapshot: RuntimeSnapshot = {
  name: "dSFC-Quant",
  service: "backend",
  status: "degraded",
  app_env: "development",
  app_mode: "mock",
  runtime_mode: "mock-safe",
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

  const host = window.location.hostname || "localhost";
  return `http://${host}:8000`;
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
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:8000/ws`;
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
    throw new Error(`${path} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadMarketSnapshot(): Promise<MarketSnapshotResponse> {
  try {
    return await requestJson<MarketSnapshotResponse>("/api/market/snapshot");
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

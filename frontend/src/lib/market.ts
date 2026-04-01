export type RuntimeSnapshot = {
  name: string;
  service: string;
  status: string;
  app_env: string;
  app_mode: string;
  runtime_mode: string;
  ai_provider: string;
  exchange_id: string;
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
  event_type:
    | "system.connected"
    | "system.warning"
    | "market.snapshot"
    | "market.tick";
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

export const fallbackRuntimeSnapshot: RuntimeSnapshot = {
  name: "dSFC-Quant",
  service: "backend",
  status: "degraded",
  app_env: "development",
  app_mode: "mock",
  runtime_mode: "mock-safe",
  ai_provider: "mock",
  exchange_id: "binance",
  ai_credentials_present: true,
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
      event_id: "fallback",
      event_type: "system.warning",
      generated_at: new Date().toISOString(),
      source: "frontend",
      payload: {
        message: "Backend unavailable - using local fallback market state.",
      },
    },
  ],
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

export async function loadMarketSnapshot(): Promise<MarketSnapshotResponse> {
  try {
    const response = await fetch(`${resolveBackendBaseUrl()}/api/market/snapshot`);
    if (!response.ok) {
      throw new Error(`snapshot request failed with ${response.status}`);
    }
    return (await response.json()) as MarketSnapshotResponse;
  } catch {
    return fallbackMarketSnapshot;
  }
}

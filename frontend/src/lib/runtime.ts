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
  warnings: ["Backend unavailable — showing local fallback runtime metadata."],
};

function resolveBackendBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const host = window.location.hostname || "localhost";
  return `http://${host}:8000`;
}

export async function loadRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  try {
    const response = await fetch(`${resolveBackendBaseUrl()}/health`);

    if (!response.ok) {
      throw new Error(`health request failed with ${response.status}`);
    }

    return (await response.json()) as RuntimeSnapshot;
  } catch {
    return fallbackRuntimeSnapshot;
  }
}


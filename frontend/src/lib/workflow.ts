import { isStaticPreviewMode, resolveBackendBaseUrl } from "./market";

export type WorkflowStageKey =
  | "market"
  | "analysis"
  | "strategy"
  | "risk"
  | "execution"
  | "performance";

export type WorkflowStageStatus =
  | "idle"
  | "ready"
  | "running"
  | "blocked"
  | "completed"
  | "degraded"
  | "failed";

export type WorkflowFactTone = "neutral" | "info" | "positive" | "warning" | "danger";

export type WorkflowFact = {
  label: string;
  value: string;
  tone: WorkflowFactTone;
};

export type WorkflowStageState = {
  key: WorkflowStageKey;
  label: string;
  status: WorkflowStageStatus;
  detail: string | null;
  updated_at: string | null;
  run_id: string | null;
  actor: string | null;
  facts: WorkflowFact[];
};

export type WorkflowRoleState = {
  role: "data" | "technical_analysis" | "news_geopolitics" | "risk_decision";
  label: string;
  status: WorkflowStageStatus;
  provider: string;
  model: string;
  recommendation: "buy" | "sell" | "hold" | "reduce" | "wait";
  confidence: number;
  summary: string;
  generated_at: string;
  run_id: string | null;
};

export type WorkflowProviderState = {
  provider: "mock_rdq" | "rd_agent_q" | "tradingagents_cn" | "external";
  label: string;
  status: WorkflowStageStatus;
  availability: "ready" | "fallback" | "unavailable";
  configured: boolean;
  effective: boolean;
  phase: string;
  detail: string | null;
  command: string | null;
  updated_at: string | null;
  run_id: string | null;
  artifact_count: number;
};

export type WorkflowNotice = {
  key: string;
  title: string;
  detail: string;
  severity: "warning" | "danger";
};

export type WorkflowSnapshot = {
  generated_at: string;
  symbol: string;
  timeframe: string;
  current_run_id: string | null;
  active_stage_key: WorkflowStageKey | null;
  current_handoff: string | null;
  execution_mode: string;
  execution_adapter: string;
  requested_market_source: string;
  effective_market_source: string;
  stages: Record<WorkflowStageKey, WorkflowStageState>;
  roles: WorkflowRoleState[];
  providers: WorkflowProviderState[];
  notices: WorkflowNotice[];
};

export const fallbackWorkflowSnapshot: WorkflowSnapshot = {
  generated_at: new Date().toISOString(),
  symbol: "BTC/USDT",
  timeframe: "1m",
  current_run_id: null,
  active_stage_key: "market",
  current_handoff: "Workflow snapshot unavailable; showing local fallback topology.",
  execution_mode: "paper",
  execution_adapter: "freqtrade_mock",
  requested_market_source: "mock",
  effective_market_source: "mock",
  stages: {
    market: {
      key: "market",
      label: "Market Feed",
      status: "ready",
      detail: "Fallback market topology is active.",
      updated_at: null,
      run_id: null,
      actor: "mock",
      facts: [],
    },
    analysis: {
      key: "analysis",
      label: "PrimoAgent",
      status: "idle",
      detail: "No workflow data yet.",
      updated_at: null,
      run_id: null,
      actor: null,
      facts: [],
    },
    strategy: {
      key: "strategy",
      label: "Strategy Factory",
      status: "idle",
      detail: "No workflow data yet.",
      updated_at: null,
      run_id: null,
      actor: null,
      facts: [],
    },
    risk: {
      key: "risk",
      label: "Risk Guard",
      status: "ready",
      detail: "Risk runtime unavailable.",
      updated_at: null,
      run_id: null,
      actor: null,
      facts: [],
    },
    execution: {
      key: "execution",
      label: "Paper Execution",
      status: "ready",
      detail: "Execution runtime unavailable.",
      updated_at: null,
      run_id: null,
      actor: null,
      facts: [],
    },
    performance: {
      key: "performance",
      label: "Performance",
      status: "idle",
      detail: "Performance runtime unavailable.",
      updated_at: null,
      run_id: null,
      actor: null,
      facts: [],
    },
  },
  roles: [],
  providers: [],
  notices: [],
};

export async function loadWorkflowSnapshot(selection?: {
  symbol?: string;
  timeframe?: string;
}): Promise<WorkflowSnapshot> {
  try {
    if (isStaticPreviewMode()) {
      throw new Error("Static preview mode disables workflow runtime requests.");
    }
    const params = new URLSearchParams();
    if (selection?.symbol) {
      params.set("symbol", selection.symbol);
    }
    if (selection?.timeframe) {
      params.set("timeframe", selection.timeframe);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await fetch(`${resolveBackendBaseUrl()}/api/workflow/snapshot${suffix}`);
    if (!response.ok) {
      throw new Error(`workflow snapshot failed with ${response.status}`);
    }
    return (await response.json()) as WorkflowSnapshot;
  } catch {
    return fallbackWorkflowSnapshot;
  }
}

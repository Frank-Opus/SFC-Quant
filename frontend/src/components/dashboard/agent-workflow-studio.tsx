import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  Cable,
  FlaskConical,
  LineChart,
  PanelRightOpen,
  PanelRightClose,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { useLocale } from "../../lib/i18n";
import type {
  AgentRuntimeSummaryResponse,
  AnalysisRunResult,
  EventEnvelope,
  ExecutionStatusResponse,
  PerformanceReport,
  StrategyFactoryStatusResponse,
} from "../../lib/market";
import type {
  WorkflowProviderState,
  WorkflowRoleState,
  WorkflowSnapshot,
  WorkflowStageKey,
  WorkflowStageState,
} from "../../lib/workflow";

type AgentWorkflowStudioProps = {
  workflow: WorkflowSnapshot | null;
  agentRuntime: AgentRuntimeSummaryResponse;
  latestAnalysis: AnalysisRunResult | null;
  eventFeed: EventEnvelope[];
  paperPerformance: PerformanceReport;
  backtestReport: PerformanceReport | null;
  strategyStatus: StrategyFactoryStatusResponse;
  execution: ExecutionStatusResponse;
  describeEvent: (event: EventEnvelope) => string;
};

type StudioSelection =
  | "core"
  | `stage:${WorkflowStageKey}`
  | `role:${WorkflowRoleState["role"]}`
  | `provider:${WorkflowProviderState["provider"]}`;

type DetailView = {
  eyebrow: string;
  title: string;
  status: string;
  statusColor: "green" | "amber" | "red" | "cyan";
  detail: string;
  meta: Array<{ label: string; value: string }>;
  facts: string[];
};

type StatusTone = "stable" | "active" | "warning" | "danger";

type StagePoint = { x: number; y: number };

type RolePoint = StagePoint & { sprite: string };

const STAGE_ORDER: WorkflowStageKey[] = [
  "market",
  "analysis",
  "strategy",
  "risk",
  "execution",
  "performance",
];

const ROLE_ORDER: WorkflowRoleState["role"][] = [
  "data",
  "technical_analysis",
  "news_geopolitics",
  "risk_decision",
];

const CORE_POINT: StagePoint = { x: 50, y: 50 };

const STAGE_POINTS: Record<WorkflowStageKey, StagePoint> = {
  market: { x: 18, y: 30 },
  analysis: { x: 35, y: 30 },
  strategy: { x: 65, y: 30 },
  risk: { x: 82, y: 30 },
  execution: { x: 38, y: 72 },
  performance: { x: 68, y: 72 },
};

const ROLE_POINTS: Record<WorkflowRoleState["role"], RolePoint> = {
  data: { x: 18, y: 80, sprite: "/star-office/guest_role_1.png" },
  technical_analysis: { x: 37, y: 84, sprite: "/star-office/guest_role_2.png" },
  news_geopolitics: { x: 63, y: 84, sprite: "/star-office/guest_role_3.png" },
  risk_decision: { x: 82, y: 80, sprite: "/star-office/guest_role_4.png" },
};

function badgeColor(status: string): "green" | "amber" | "red" | "cyan" {
  if (["completed", "ready", "connected"].includes(status)) {
    return "green";
  }
  if (["running", "active", "mock"].includes(status)) {
    return "cyan";
  }
  if (["blocked", "degraded", "fallback", "timeout"].includes(status)) {
    return "amber";
  }
  return "red";
}

function toneForStatus(status: string): StatusTone {
  if (["completed", "ready", "connected"].includes(status)) {
    return "stable";
  }
  if (["running", "active", "mock", "paper"].includes(status)) {
    return "active";
  }
  if (["blocked", "degraded", "fallback", "timeout", "offline"].includes(status)) {
    return "warning";
  }
  return "danger";
}

function stageIcon(key: WorkflowStageKey) {
  switch (key) {
    case "market":
      return LineChart;
    case "analysis":
      return BrainCircuit;
    case "strategy":
      return FlaskConical;
    case "risk":
      return ShieldAlert;
    case "execution":
      return Activity;
    case "performance":
      return BarChart3;
  }
}

function providerIcon(provider: WorkflowProviderState["provider"]) {
  switch (provider) {
    case "mock_rdq":
      return Bot;
    case "rd_agent_q":
      return FlaskConical;
    case "tradingagents_cn":
      return BrainCircuit;
    case "external":
      return Cable;
  }
}

function resolveStageLabel(t: (key: string) => string, stage: WorkflowStageState): string {
  const key = `workflow.stage.${stage.key}`;
  const translated = t(key);
  return translated === key ? stage.label : translated;
}

function resolveStatusLabel(t: (key: string) => string, status: string): string {
  const key = `workflow.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function resolveAvailabilityLabel(t: (key: string) => string, availability: string): string {
  const key = `strategy.availability.${availability}`;
  const translated = t(key);
  return translated === key ? availability : translated;
}

function resolveProviderAvailabilityLabel(
  t: (key: string) => string,
  provider: WorkflowProviderState,
): string {
  return resolveAvailabilityLabel(
    t,
    !provider.configured && !provider.effective ? "optional" : provider.availability,
  );
}

function providerBadgeColor(provider: WorkflowProviderState): "green" | "amber" | "red" | "cyan" {
  if (!provider.configured && !provider.effective) {
    return "amber";
  }
  return badgeColor(provider.status);
}

function resolveStrategyPhaseLabel(t: (key: string) => string, phase: string): string {
  const key = `strategy.phase.${phase}`;
  const translated = t(key);
  return translated === key ? phase : translated;
}

function nodeStyle(point: StagePoint): CSSProperties {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
    background: "none",
    border: "none",
    padding: 0,
  };
}

export function AgentWorkflowStudio({
  workflow,
  agentRuntime,
  latestAnalysis,
  eventFeed,
  paperPerformance,
  backtestReport,
  strategyStatus,
  execution,
  describeEvent,
}: AgentWorkflowStudioProps) {
  const { t, formatDateTime, formatPercent, formatRecommendation, formatRole } = useLocale();
  const snapshot = workflow;
  const [selection, setSelection] = useState<StudioSelection>("core");
  const [drawerOpen, setDrawerOpen] = useState(true);

  const roleMap = useMemo(
    () => new Map((snapshot?.roles ?? []).map((role) => [role.role, role])),
    [snapshot?.roles],
  );

  const providerMap = useMemo(
    () => new Map((snapshot?.providers ?? []).map((provider) => [provider.provider, provider])),
    [snapshot?.providers],
  );

  const activeStageKey = snapshot?.active_stage_key ?? "market";
  const selectedId: StudioSelection = snapshot
    ? selection === "core" && snapshot.active_stage_key
      ? `stage:${snapshot.active_stage_key}`
      : selection
    : "core";

  const recentEvents = useMemo(
    () =>
      eventFeed
        .filter(
          (event) =>
            event.event_type.startsWith("agent.") ||
            event.event_type.startsWith("strategy.") ||
            event.event_type.startsWith("execution.") ||
            event.event_type.startsWith("risk.") ||
            event.event_type.startsWith("market."),
        )
        .slice(0, 6),
    [eventFeed],
  );

  const summaryTiles = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        id: "run",
        label: t("workflow.currentRun"),
        value: snapshot.current_run_id ?? t("workflow.noRun"),
      },
      {
        id: "route",
        label: t("workflow.marketRoute"),
        value: `${snapshot.requested_market_source.toUpperCase()} -> ${snapshot.effective_market_source.toUpperCase()}`,
      },
      {
        id: "adapter",
        label: t("workflow.executionAdapter"),
        value: `${snapshot.execution_adapter} · ${snapshot.execution_mode.toUpperCase()}`,
      },
      {
        id: "decision",
        label: t("workflowStudio.latestDecision"),
        value: latestAnalysis
          ? formatRecommendation(latestAnalysis.overall_recommendation, { uppercase: true })
          : t("thesis.pending"),
      },
    ];
  }, [formatRecommendation, latestAnalysis, snapshot, t]);

  const valueAuditRows = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const paperLive = execution.execution_mode === "paper";
    const effectiveProvider = snapshot.providers.find((provider) => provider.effective) ?? null;
    const paperMetric = `${paperPerformance.trade_count} · ${formatPercent(paperPerformance.total_return)}`;
    const backtestMetric = backtestReport
      ? `${backtestReport.trade_count} · ${formatPercent(backtestReport.total_return)}`
      : t("performance.empty");

    return [
      {
        id: "market",
        area: resolveStageLabel(t, snapshot.stages.market),
        verdict:
          snapshot.effective_market_source === snapshot.requested_market_source
            ? t("workflowStudio.auditStrong")
            : t("workflowStudio.auditPartial"),
        tone:
          snapshot.effective_market_source === snapshot.requested_market_source
            ? "green"
            : "amber",
        reason: snapshot.stages.market.detail ?? t("workflow.noDetail"),
      },
      {
        id: "analysis",
        area: resolveStageLabel(t, snapshot.stages.analysis),
        verdict:
          snapshot.roles.length >= 3 || Boolean(latestAnalysis)
            ? t("workflowStudio.auditStrong")
            : t("workflowStudio.auditPartial"),
        tone:
          snapshot.roles.length >= 3 || Boolean(latestAnalysis)
            ? "green"
            : "amber",
        reason:
          latestAnalysis?.outputs.at(-1)?.summary ??
          snapshot.stages.analysis.detail ??
          t("workflow.noDetail"),
      },
      {
        id: "strategy",
        area: resolveStageLabel(t, snapshot.stages.strategy),
        verdict:
          strategyStatus.enabled || Boolean(effectiveProvider)
            ? t("workflowStudio.auditPartial")
            : t("workflowStudio.auditWeak"),
        tone: strategyStatus.enabled || Boolean(effectiveProvider) ? "amber" : "red",
        reason: snapshot.stages.strategy.detail ?? strategyStatus.reason ?? t("workflow.noDetail"),
      },
      {
        id: "risk",
        area: resolveStageLabel(t, snapshot.stages.risk),
        verdict: paperLive ? t("workflowStudio.auditStrong") : t("workflowStudio.auditPartial"),
        tone: paperLive ? "green" : "amber",
        reason: snapshot.stages.risk.detail ?? t("workflow.noDetail"),
      },
      {
        id: "execution",
        area: resolveStageLabel(t, snapshot.stages.execution),
        verdict:
          execution.adapter_runtime.status === "offline"
            ? t("workflowStudio.auditWeak")
            : t("workflowStudio.auditStrong"),
        tone: execution.adapter_runtime.status === "offline" ? "red" : "green",
        reason: `${execution.adapter_runtime.detail} · ${execution.recent_orders.length} orders / ${execution.positions.length} positions`,
      },
      {
        id: "performance",
        area: resolveStageLabel(t, snapshot.stages.performance),
        verdict:
          paperPerformance.trade_count > 0 || Boolean(backtestReport)
            ? t("workflowStudio.auditPartial")
            : t("workflowStudio.auditWeak"),
        tone: paperPerformance.trade_count > 0 || Boolean(backtestReport) ? "amber" : "red",
        reason: `paper ${paperMetric}${backtestReport ? ` · backtest ${backtestMetric}` : ""}`,
      },
    ] as const;
  }, [
    backtestReport,
    execution.adapter_runtime.detail,
    execution.adapter_runtime.status,
    execution.execution_mode,
    execution.positions.length,
    execution.recent_orders.length,
    formatPercent,
    latestAnalysis,
    paperPerformance.total_return,
    paperPerformance.trade_count,
    snapshot,
    strategyStatus.enabled,
    strategyStatus.reason,
    t,
  ]);

  const detailView = useMemo<DetailView | null>(() => {
    if (!snapshot) {
      return null;
    }

    if (selectedId === "core") {
      const effectiveProvider = snapshot.providers.find((provider) => provider.effective) ?? null;
      return {
        eyebrow: t("workflowStudio.inspector"),
        title: t("workflowStudio.core"),
        status: resolveStatusLabel(t, snapshot.stages[activeStageKey].status),
        statusColor: badgeColor(snapshot.stages[activeStageKey].status),
        detail: snapshot.current_handoff ?? t("workflow.noHandoff"),
        meta: [
          { label: t("workflow.currentRun"), value: snapshot.current_run_id ?? t("workflow.noRun") },
          {
            label: t("workflow.marketRoute"),
            value: `${snapshot.requested_market_source.toUpperCase()} -> ${snapshot.effective_market_source.toUpperCase()}`,
          },
          { label: t("workflow.executionAdapter"), value: snapshot.execution_adapter },
          { label: t("agentOps.provider"), value: effectiveProvider?.label ?? t("workflow.noProviders") },
        ],
        facts: [
          `${t("workflow.active")}: ${resolveStageLabel(t, snapshot.stages[activeStageKey])}`,
          latestAnalysis
            ? `${t("workflowStudio.latestDecision")}: ${formatRecommendation(latestAnalysis.overall_recommendation, { uppercase: true })}`
            : t("thesis.pending"),
          `${t("workflow.updatedAt", { time: formatDateTime(snapshot.generated_at) })}`,
        ],
      };
    }

    if (selectedId.startsWith("stage:")) {
      const stage = snapshot.stages[selectedId.replace("stage:", "") as WorkflowStageKey];
      return {
        eyebrow: t("workflowStudio.stageDetail"),
        title: resolveStageLabel(t, stage),
        status: resolveStatusLabel(t, stage.status),
        statusColor: badgeColor(stage.status),
        detail: stage.detail ?? t("workflow.noDetail"),
        meta: [
          { label: t("workflow.currentRun"), value: stage.run_id ?? snapshot.current_run_id ?? t("workflow.noRun") },
          { label: t("agentOps.provider"), value: stage.actor ?? "-" },
          { label: t("workflow.executionAdapter"), value: snapshot.execution_adapter },
        ],
        facts:
          stage.facts.length > 0
            ? stage.facts.map((fact) => `${fact.label}: ${fact.value}`)
            : [t("workflow.noDetail")],
      };
    }

    if (selectedId.startsWith("role:")) {
      const role = roleMap.get(selectedId.replace("role:", "") as WorkflowRoleState["role"]);
      if (!role) {
        return null;
      }
      return {
        eyebrow: t("workflowStudio.agentDetail"),
        title: formatRole(role.role),
        status: resolveStatusLabel(t, role.status),
        statusColor: badgeColor(role.status),
        detail: role.summary,
        meta: [
          { label: t("agentOps.provider"), value: role.provider },
          { label: t("agentOps.model"), value: role.model },
          {
            label: t("agentOps.recommendation"),
            value: formatRecommendation(role.recommendation, { uppercase: true }),
          },
          { label: t("agentOps.confidence"), value: formatPercent(role.confidence * 100, false) },
        ],
        facts: [
          `${t("workflow.currentRun")}: ${role.run_id ?? t("workflow.noRun")}`,
          `${t("workflow.updatedAt", { time: formatDateTime(role.generated_at) })}`,
        ],
      };
    }

    const provider = providerMap.get(
      selectedId.replace("provider:", "") as WorkflowProviderState["provider"],
    );
    if (!provider) {
      return null;
    }

    const runtimeRecord = agentRuntime.agents.find((agent) => agent.provider === provider.provider);
    return {
      eyebrow: t("workflowStudio.providerDetail"),
      title: provider.label,
      status: resolveProviderAvailabilityLabel(t, provider),
      statusColor: providerBadgeColor(provider),
      detail: provider.detail ?? provider.command ?? t("workflow.noDetail"),
      meta: [
        { label: t("agentOps.phase"), value: resolveStrategyPhaseLabel(t, provider.phase) },
        { label: t("workflow.effective"), value: provider.effective ? t("strategy.current") : "-" },
        {
          label: t("workflow.providerArtifacts", { count: provider.artifact_count }),
          value: `${provider.artifact_count}`,
        },
        { label: t("workflowStudio.command"), value: provider.command ?? "-" },
      ],
      facts: [
        `${t("agentOps.status")}: ${runtimeRecord?.status ?? provider.status}`,
        `${t("agentOps.logs", { count: runtimeRecord?.logs.length ?? 0 })}`,
        `${t("agentOps.artifacts", { count: runtimeRecord?.artifacts.length ?? 0 })}`,
      ],
    };
  }, [
    activeStageKey,
    agentRuntime.agents,
    formatDateTime,
    formatPercent,
    formatRecommendation,
    formatRole,
    latestAnalysis,
    providerMap,
    roleMap,
    selectedId,
    snapshot,
    t,
  ]);

  if (!snapshot) {
    return (
      <div className="extension-card workflow-studio-card" data-testid="workflow-studio">
        <div className="extension-card-headline">
          <div>
            <span className="section-label">{t("workflowStudio.kicker")}</span>
            <h3>{t("workflowStudio.title")}</h3>
          </div>
        </div>
        <div className="empty-state">{t("workflow.unavailable")}</div>
      </div>
    );
  }

  return (
    <div className="extension-card workflow-studio-card" data-testid="workflow-studio">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("workflowStudio.kicker")}</span>
          <h3>{t("workflowStudio.title")}</h3>
        </div>
        <Badge color={badgeColor(snapshot.stages[activeStageKey].status)}>
          {snapshot.execution_mode.toUpperCase()}
        </Badge>
      </div>

      <div className="workflow-command-summary">
        {summaryTiles.map((tile) => (
          <article className="workflow-command-summary-item" key={tile.id}>
            <span>{tile.label}</span>
            <strong className="token-ellipsis" title={tile.value}>
              {tile.value}
            </strong>
          </article>
        ))}
      </div>

      <div className="workflow-star-shell" data-drawer-open={drawerOpen}>
        <div className="workflow-star-main">
          <section className="workflow-star-stage-shell">
            <div className="workflow-star-stage-toolbar">
              <div>
                <span className="section-label">{t("workflowStudio.theater")}</span>
                <strong>{t("workflowStudio.graphDescription")}</strong>
              </div>
              <button
                type="button"
                className="workflow-star-toggle"
                onClick={() => setDrawerOpen((current) => !current)}
                aria-expanded={drawerOpen}
              >
                {drawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                <span>
                  {drawerOpen ? t("workflowStudio.closeInspector") : t("workflowStudio.openInspector")}
                </span>
              </button>
            </div>

            <div className="workflow-star-stage" data-testid="workflow-star-stage">
              <img className="workflow-star-background" src="/star-office/office_bg_small.webp" alt="" />
              <div className="workflow-star-noise" aria-hidden="true" />
              <img className="workflow-star-guide" src="/star-office/star-idle-v5.png" alt="" />

              <svg
                className="workflow-star-links"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="18" y1="30" x2="35" y2="30" data-active={activeStageKey === "market" || activeStageKey === "analysis"} />
                <line x1="35" y1="30" x2="65" y2="30" data-active={activeStageKey === "analysis" || activeStageKey === "strategy"} />
                <line x1="65" y1="30" x2="82" y2="30" data-active={activeStageKey === "strategy" || activeStageKey === "risk"} />
                <line x1="82" y1="30" x2="38" y2="72" data-active={activeStageKey === "risk" || activeStageKey === "execution"} />
                <line x1="38" y1="72" x2="68" y2="72" data-active={activeStageKey === "execution" || activeStageKey === "performance"} />
                <line x1="35" y1="30" x2="50" y2="50" data-active={activeStageKey === "analysis"} />
                <line x1="50" y1="50" x2="82" y2="30" data-active={activeStageKey === "risk"} />
                <line x1="18" y1="80" x2="35" y2="30" data-active={selectedId === "role:data"} />
                <line x1="37" y1="84" x2="35" y2="30" data-active={selectedId === "role:technical_analysis"} />
                <line x1="63" y1="84" x2="35" y2="30" data-active={selectedId === "role:news_geopolitics"} />
                <line x1="82" y1="80" x2="82" y2="30" data-active={selectedId === "role:risk_decision"} />
              </svg>

              <div className="workflow-star-plaque">
                <span>{t("workflowStudio.activeTicker")}</span>
                <strong>{snapshot.current_handoff ?? t("workflow.noHandoff")}</strong>
                <span>{t("workflow.updatedAt", { time: formatDateTime(snapshot.generated_at) })}</span>
              </div>

              <motion.button
                type="button"
                className="workflow-star-node"
                data-active={selectedId === "core"}
                data-tone={toneForStatus(snapshot.stages[activeStageKey].status)}
                onClick={() => setSelection("core")}
                style={nodeStyle(CORE_POINT)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22 }}
              >
                <span className="workflow-star-avatar" data-core="true">
                  <img src="/branding/sfc-mark.png" alt="SFC-Quant core" />
                </span>
                <span className="workflow-star-nameplate">
                  <span className="workflow-star-status-dot" data-tone={toneForStatus(snapshot.stages[activeStageKey].status)} />
                  <span className="workflow-star-nameplate-copy">
                    <span>{t("workflowStudio.core")}</span>
                    <strong>{resolveStageLabel(t, snapshot.stages[activeStageKey])}</strong>
                  </span>
                </span>
              </motion.button>

              {STAGE_ORDER.map((key, index) => {
                const stage = snapshot.stages[key];
                const Icon = stageIcon(key);
                return (
                  <motion.button
                    type="button"
                    className="workflow-star-node"
                    key={key}
                    data-active={selectedId === `stage:${key}`}
                    data-tone={toneForStatus(stage.status)}
                    onClick={() => setSelection(`stage:${key}`)}
                    style={nodeStyle(STAGE_POINTS[key])}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.04 }}
                  >
                    <span className="workflow-star-avatar">
                      <Icon size={18} />
                    </span>
                    <span className="workflow-star-nameplate">
                      <span className="workflow-star-status-dot" data-tone={toneForStatus(stage.status)} />
                      <span className="workflow-star-nameplate-copy">
                        <span>{resolveStageLabel(t, stage)}</span>
                        <strong>{stage.actor ?? resolveStatusLabel(t, stage.status)}</strong>
                      </span>
                    </span>
                  </motion.button>
                );
              })}

              {ROLE_ORDER.map((roleKey, index) => {
                const role = roleMap.get(roleKey);
                const position = ROLE_POINTS[roleKey];
                return (
                  <motion.button
                    type="button"
                    className="workflow-star-node"
                    data-testid="workflow-role-node"
                    data-kind="persona"
                    data-active={selectedId === `role:${roleKey}`}
                    data-tone={toneForStatus(role?.status ?? "idle")}
                    key={roleKey}
                    onClick={() => setSelection(`role:${roleKey}`)}
                    style={nodeStyle(position)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: 0.22 + index * 0.04 }}
                  >
                    <span className="workflow-star-avatar" data-kind="persona">
                      <img src={position.sprite} alt={formatRole(roleKey)} />
                    </span>
                    <span className="workflow-star-nameplate">
                      <span className="workflow-star-status-dot" data-tone={toneForStatus(role?.status ?? "idle")} />
                      <span className="workflow-star-nameplate-copy">
                        <span>{formatRole(roleKey)}</span>
                        <strong>
                          {role
                            ? `${formatRecommendation(role.recommendation, { uppercase: true })} · ${formatPercent(role.confidence * 100, false)}`
                            : resolveStatusLabel(t, "idle")}
                        </strong>
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <div className="workflow-star-bottom">
            <section className="workflow-star-panel">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.pipeline")}</span>
                  <strong>{t("workflowStudio.commandMap")}</strong>
                </div>
                <Badge color={badgeColor(snapshot.stages[activeStageKey].status)}>
                  {resolveStageLabel(t, snapshot.stages[activeStageKey])}
                </Badge>
              </div>
              <div className="workflow-star-lane-grid">
                {STAGE_ORDER.map((key) => {
                  const stage = snapshot.stages[key];
                  return (
                    <button
                      type="button"
                      className="workflow-star-lane-card"
                      key={key}
                      onClick={() => setSelection(`stage:${key}`)}
                    >
                      <div className="workflow-star-node-head">
                        <span>{resolveStageLabel(t, stage)}</span>
                        <Badge color={badgeColor(stage.status)}>{resolveStatusLabel(t, stage.status)}</Badge>
                      </div>
                      <strong>{stage.actor ?? resolveStatusLabel(t, stage.status)}</strong>
                      <p className="clamp-3 copy-break" title={stage.detail ?? t("workflow.noDetail")}>
                        {stage.detail ?? t("workflow.noDetail")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="workflow-star-panel">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.providerDock")}</span>
                  <strong>{t("workflow.providers")}</strong>
                </div>
                <Badge color="cyan">{snapshot.providers.length}</Badge>
              </div>
              <div className="workflow-star-provider-dock">
                {snapshot.providers.length > 0 ? (
                  snapshot.providers.map((provider) => {
                    const Icon = providerIcon(provider.provider);
                    return (
                      <button
                        type="button"
                        className="workflow-star-provider-card"
                        data-active={selectedId === `provider:${provider.provider}`}
                        data-tone={toneForStatus(provider.status)}
                        key={provider.provider}
                        onClick={() => setSelection(`provider:${provider.provider}`)}
                      >
                        <span className="workflow-star-provider-avatar">
                          <Icon size={18} />
                        </span>
                        <div className="workflow-star-provider-body">
                          <div className="workflow-star-provider-headline">
                            <div className="workflow-star-provider-copy">
                              <span>{resolveStrategyPhaseLabel(t, provider.phase)}</span>
                              <strong>{provider.label}</strong>
                            </div>
                            <Badge color={providerBadgeColor(provider)}>
                              {provider.effective
                                ? t("workflow.effective")
                                : resolveProviderAvailabilityLabel(t, provider)}
                            </Badge>
                          </div>
                          <p className="clamp-2 copy-break" title={provider.detail ?? provider.command ?? t("workflow.noDetail")}>
                            {provider.detail ?? provider.command ?? t("workflow.noDetail")}
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="empty-state">{t("workflow.noProviders")}</div>
                )}
              </div>
            </section>

            <section className="workflow-star-panel">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.missionLog")}</span>
                  <strong>{t("agentOps.recentEvents")}</strong>
                </div>
                <Badge color="cyan">{recentEvents.length}</Badge>
              </div>
              <div className="workflow-star-log-list">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <article className="workflow-star-log-row" key={event.event_id}>
                      <div className="workflow-star-log-head">
                        <span>{event.event_type}</span>
                        <small>{formatDateTime(event.generated_at)}</small>
                      </div>
                      <p className="clamp-3 copy-break" title={describeEvent(event)}>
                        {describeEvent(event)}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">{t("workflowStudio.noEvents")}</div>
                )}
              </div>
            </section>
          </div>
        </div>

        {drawerOpen ? (
          <aside className="workflow-star-drawer">
            <div className="workflow-star-drawer-head">
              <div>
                <span className="section-label">{detailView?.eyebrow ?? t("workflowStudio.inspector")}</span>
                <h4>{detailView?.title ?? t("workflow.title")}</h4>
              </div>
              {detailView ? <Badge color={detailView.statusColor}>{detailView.status}</Badge> : null}
            </div>

            <p className="quiet-copy clamp-4 copy-break" title={detailView?.detail ?? t("workflowStudio.selectionHint")}>
              {detailView?.detail ?? t("workflowStudio.selectionHint")}
            </p>

            <div className="workflow-star-inspector-meta">
              {(detailView?.meta ?? []).map((item) => (
                <article className="workflow-star-meta-row" key={`${item.label}-${item.value}`}>
                  <span>{item.label}</span>
                  <strong className="copy-break" title={item.value}>
                    {item.value}
                  </strong>
                </article>
              ))}
            </div>

            <div className="workflow-star-facts">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.summary")}</span>
                  <strong>{t("workflowStudio.executionTruth")}</strong>
                </div>
              </div>
              <div className="workflow-star-fact-list">
                {(detailView?.facts ?? []).map((fact) => (
                  <div className="workflow-star-fact-pill" key={fact}>
                    {fact}
                  </div>
                ))}
              </div>
            </div>

            <div className="workflow-star-facts">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.auditTitle")}</span>
                  <strong>{t("workflowStudio.auditDescription")}</strong>
                </div>
              </div>
              <div className="workflow-star-inspector-meta">
                {valueAuditRows.slice(0, 4).map((row) => (
                  <article className="workflow-star-meta-row" key={row.id}>
                    <span>{row.area}</span>
                    <strong>
                      <Badge color={row.tone}>{row.verdict}</Badge>
                    </strong>
                    <span className="copy-break" title={row.reason}>{row.reason}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="workflow-star-facts">
              <div className="workflow-star-panel-head">
                <div>
                  <span className="section-label">{t("workflowStudio.evalTitle")}</span>
                  <strong>{t("workflowStudio.evalCommandLine")}</strong>
                </div>
              </div>
              <div className="workflow-star-fact-list">
                <div className="workflow-star-fact-pill">cd frontend && npm run build</div>
                <div className="workflow-star-fact-pill">cd frontend && npm run e2e:release</div>
                <div className="workflow-star-fact-pill">cd backend && pytest tests/test_workflow_runtime.py</div>
                <div className="workflow-star-fact-pill">docker compose up backend frontend</div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

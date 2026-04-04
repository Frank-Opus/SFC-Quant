import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  Cable,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  LineChart,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

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

function resolveStrategyPhaseLabel(t: (key: string) => string, phase: string): string {
  const key = `strategy.phase.${phase}`;
  const translated = t(key);
  return translated === key ? phase : translated;
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
        verdict: snapshot.effective_market_source === snapshot.requested_market_source ? t("workflowStudio.auditStrong") : t("workflowStudio.auditPartial"),
        tone: snapshot.effective_market_source === snapshot.requested_market_source ? "green" : "amber",
        reason: snapshot.stages.market.detail ?? t("workflow.noDetail"),
        next: `${t("shell.overviewTitle")} / ${t("marketDeck.title")}`,
      },
      {
        id: "analysis",
        area: resolveStageLabel(t, snapshot.stages.analysis),
        verdict: snapshot.roles.length >= 3 || Boolean(latestAnalysis) ? t("workflowStudio.auditStrong") : t("workflowStudio.auditPartial"),
        tone: snapshot.roles.length >= 3 || Boolean(latestAnalysis) ? "green" : "amber",
        reason: latestAnalysis?.outputs.at(-1)?.summary ?? snapshot.stages.analysis.detail ?? t("workflow.noDetail"),
        next: t("thesis.title"),
      },
      {
        id: "strategy",
        area: resolveStageLabel(t, snapshot.stages.strategy),
        verdict: strategyStatus.enabled || Boolean(effectiveProvider) ? t("workflowStudio.auditPartial") : t("workflowStudio.auditWeak"),
        tone: strategyStatus.enabled || Boolean(effectiveProvider) ? "amber" : "red",
        reason: snapshot.stages.strategy.detail ?? strategyStatus.reason ?? t("workflow.noDetail"),
        next: t("extensions.title"),
      },
      {
        id: "risk",
        area: resolveStageLabel(t, snapshot.stages.risk),
        verdict: paperLive ? t("workflowStudio.auditStrong") : t("workflowStudio.auditPartial"),
        tone: paperLive ? "green" : "amber",
        reason: snapshot.stages.risk.detail ?? t("workflow.noDetail"),
        next: t("operator.title"),
      },
      {
        id: "execution",
        area: resolveStageLabel(t, snapshot.stages.execution),
        verdict: execution.adapter_runtime.status === "offline" ? t("workflowStudio.auditWeak") : t("workflowStudio.auditStrong"),
        tone: execution.adapter_runtime.status === "offline" ? "red" : "green",
        reason: `${execution.adapter_runtime.detail} · ${execution.recent_orders.length} orders / ${execution.positions.length} positions`,
        next: t("operator.title"),
      },
      {
        id: "performance",
        area: resolveStageLabel(t, snapshot.stages.performance),
        verdict: paperPerformance.trade_count > 0 || Boolean(backtestReport) ? t("workflowStudio.auditPartial") : t("workflowStudio.auditWeak"),
        tone: paperPerformance.trade_count > 0 || Boolean(backtestReport) ? "amber" : "red",
        reason: `paper ${paperMetric}${backtestReport ? ` · backtest ${backtestMetric}` : ""}`,
        next: t("analytics.title"),
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

  const evaluationDashboardItems = useMemo(
    () => [
      {
        where: t("shell.overviewTitle"),
        check: `${t("runtime.marketRequested")} / ${t("runtime.marketEffective")} / ${t("hero.execution")}`,
      },
      {
        where: t("thesis.title"),
        check: `${t("agentOps.recommendation")} / ${t("agentOps.confidence")} / ${t("workflow.roles")}`,
      },
      {
        where: t("extensions.title"),
        check: `${t("workflow.providers")} / ${t("strategy.recent")} / ${t("strategy.generation")}`,
      },
      {
        where: t("operator.title"),
        check: `${t("operator.runAnalysis")} / ${t("operator.dispatchPaper")} / ${t("hero.halt")}`,
      },
      {
        where: t("analytics.title"),
        check: `${t("performance.title")} / ${t("analytics.signalLog.title")} / ${t("analytics.factorRadar.title")}`,
      },
      {
        where: t("diagnostics.title"),
        check: `${t("diagnostics.warnings", { count: 0 })} / ${t("runtime.marketDetail")} / ${t("diagnostics.retries")}`,
      },
    ],
    [t],
  );

  const evaluationCliItems = useMemo(
    () => [
      {
        command: "cd frontend && npm run build",
        expectation: "Frontend production build completes without runtime/type errors.",
      },
      {
        command: "cd frontend && npm run e2e:release",
        expectation: "Release walkthrough and layout regression checks pass end-to-end.",
      },
      {
        command: "cd backend && pytest tests/test_workflow_runtime.py tests/test_performance_runtime.py tests/test_health.py",
        expectation: "Workflow snapshot, performance API, and health endpoints stay green.",
      },
      {
        command: "docker compose up backend frontend",
        expectation: "Local operator stack boots with two primary services and the dashboard is reachable.",
      },
    ],
    [],
  );

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
          { label: t("workflow.marketRoute"), value: `${snapshot.requested_market_source.toUpperCase()} -> ${snapshot.effective_market_source.toUpperCase()}` },
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
        facts: stage.facts.length > 0 ? stage.facts.map((fact) => `${fact.label}: ${fact.value}`) : [t("workflow.noDetail")],
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
          { label: t("agentOps.recommendation"), value: formatRecommendation(role.recommendation, { uppercase: true }) },
          { label: t("agentOps.confidence"), value: formatPercent(role.confidence * 100, false) },
        ],
        facts: [
          `${t("workflow.currentRun")}: ${role.run_id ?? t("workflow.noRun")}`,
          `${t("workflow.updatedAt", { time: formatDateTime(role.generated_at) })}`,
        ],
      };
    }

    const provider = providerMap.get(selectedId.replace("provider:", "") as WorkflowProviderState["provider"]);
    if (!provider) {
      return null;
    }

    const runtimeRecord = agentRuntime.agents.find((agent) => agent.provider === provider.provider);
    return {
      eyebrow: t("workflowStudio.providerDetail"),
      title: provider.label,
      status: resolveAvailabilityLabel(t, provider.availability),
      statusColor: badgeColor(provider.status),
      detail: provider.detail ?? provider.command ?? t("workflow.noDetail"),
      meta: [
        { label: t("agentOps.phase"), value: resolveStrategyPhaseLabel(t, provider.phase) },
        { label: t("workflow.effective"), value: provider.effective ? t("strategy.current") : "-" },
        { label: t("workflow.providerArtifacts", { count: provider.artifact_count }), value: `${provider.artifact_count}` },
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
            <strong className="token-ellipsis" title={tile.value}>{tile.value}</strong>
          </article>
        ))}
      </div>

      <div className="workflow-command-deck">
        <section className="workflow-command-card workflow-command-card--map">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{t("workflowStudio.graphTitle")}</span>
              <h4>{t("workflowStudio.graphDescription")}</h4>
            </div>
            <Badge color={badgeColor(snapshot.stages[activeStageKey].status)}>
              {resolveStageLabel(t, snapshot.stages[activeStageKey])}
            </Badge>
          </div>

          <div className="workflow-command-stage-track" data-testid="workflow-star-stage">
            {STAGE_ORDER.map((key, index) => {
              const stage = snapshot.stages[key];
              const Icon = stageIcon(key);
              const active = selectedId === `stage:${key}`;
              return (
                <div className="workflow-command-stage-unit" key={key}>
                  <motion.button
                    type="button"
                    className="workflow-command-stage-card"
                    data-active={active}
                    data-status={stage.status}
                    onClick={() => setSelection(`stage:${key}`)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                  >
                    <div className="workflow-command-stage-topline">
                      <span className="workflow-command-stage-icon">
                        <Icon size={16} />
                      </span>
                      <Badge color={badgeColor(stage.status)}>{resolveStatusLabel(t, stage.status)}</Badge>
                    </div>
                    <span className="section-label">{resolveStageLabel(t, stage)}</span>
                    <strong>{stage.actor ?? resolveStatusLabel(t, stage.status)}</strong>
                    <p className="clamp-3 copy-break" title={stage.detail ?? t("workflow.noDetail")}>
                      {stage.detail ?? t("workflow.noDetail")}
                    </p>
                  </motion.button>
                  {index < STAGE_ORDER.length - 1 ? (
                    <div className="workflow-command-stage-arrow" aria-hidden="true">
                      <ChevronRight size={16} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="workflow-command-support-grid">
            <section className="workflow-command-support-card">
              <div className="workflow-command-support-head">
                <BrainCircuit size={16} />
                <strong>{t("workflow.roles")}</strong>
              </div>
              <div className="workflow-command-role-grid">
                {ROLE_ORDER.map((roleKey) => {
                  const role = roleMap.get(roleKey);
                  return role ? (
                    <button
                      type="button"
                      className="workflow-role-node"
                      data-testid="workflow-role-node"
                      data-kind="persona"
                      data-active={selectedId === `role:${role.role}`}
                      data-status={role.status}
                      key={role.role}
                      onClick={() => setSelection(`role:${role.role}`)}
                    >
                      <span>{formatRole(role.role)}</span>
                      <strong>
                        {formatRecommendation(role.recommendation, { uppercase: true })} · {formatPercent(role.confidence * 100, false)}
                      </strong>
                      <small className="token-ellipsis" title={role.provider}>{role.provider}</small>
                    </button>
                  ) : (
                    <article
                      className="workflow-role-node workflow-role-node--empty"
                      data-testid="workflow-role-node"
                      data-kind="persona"
                      key={roleKey}
                    >
                      <span>{formatRole(roleKey)}</span>
                      <strong>{t("workflow.status.idle")}</strong>
                      <small>{t("workflow.noDetail")}</small>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="workflow-command-support-card">
              <div className="workflow-command-support-head">
                <Cable size={16} />
                <strong>{t("workflowStudio.providerMatrix")}</strong>
              </div>
              <div className="workflow-command-provider-grid">
                {snapshot.providers.map((provider) => {
                  const Icon = providerIcon(provider.provider);
                  return (
                    <button
                      type="button"
                      className="workflow-provider-node"
                      data-active={selectedId === `provider:${provider.provider}`}
                      data-status={provider.status}
                      key={provider.provider}
                      onClick={() => setSelection(`provider:${provider.provider}`)}
                    >
                      <span className="workflow-provider-node-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <span>{provider.label}</span>
                        <strong>{provider.effective ? t("workflow.effective") : resolveAvailabilityLabel(t, provider.availability)}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </section>

        <aside className="workflow-command-card workflow-command-card--detail">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{detailView?.eyebrow ?? t("workflowStudio.inspector")}</span>
              <h4>{detailView?.title ?? t("workflow.title")}</h4>
            </div>
            {detailView ? <Badge color={detailView.statusColor}>{detailView.status}</Badge> : null}
          </div>

          <p className="quiet-copy clamp-4 copy-break" title={detailView?.detail ?? t("workflowStudio.selectionHint")}>
            {detailView?.detail ?? t("workflowStudio.selectionHint")}
          </p>

          <div className="workflow-command-detail-meta">
            {(detailView?.meta ?? []).map((item) => (
              <article className="workflow-command-detail-item" key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong className="copy-break" title={item.value}>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="workflow-command-facts">
            {(detailView?.facts ?? []).map((fact) => (
              <div className="workflow-command-fact-pill" key={fact}>{fact}</div>
            ))}
          </div>
        </aside>
      </div>

      <div className="workflow-command-grid">
        <section className="workflow-command-card">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{t("workflowStudio.providerDock")}</span>
              <h4>{t("workflow.providers")}</h4>
            </div>
          </div>
          <div className="workflow-provider-matrix-list">
            {snapshot.providers.length > 0 ? (
              snapshot.providers.map((provider) => {
                const Icon = providerIcon(provider.provider);
                return (
                  <article className="workflow-provider-matrix-row" data-status={provider.status} key={provider.provider}>
                    <span className="workflow-provider-matrix-icon">
                      <Icon size={16} />
                    </span>
                    <div className="workflow-provider-matrix-copy">
                      <div className="workflow-provider-matrix-headline">
                        <strong>{provider.label}</strong>
                        <Badge color={badgeColor(provider.status)}>
                          {provider.effective ? t("workflow.effective") : resolveAvailabilityLabel(t, provider.availability)}
                        </Badge>
                      </div>
                      <span>
                        {resolveStatusLabel(t, provider.status)} · {resolveStrategyPhaseLabel(t, provider.phase)}
                      </span>
                      <p className="clamp-2 copy-break" title={provider.detail ?? provider.command ?? t("workflow.noDetail")}>
                        {provider.detail ?? provider.command ?? t("workflow.noDetail")}
                      </p>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">{t("workflow.noProviders")}</div>
            )}
          </div>
        </section>

        <section className="workflow-command-card">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{t("workflowStudio.missionLog")}</span>
              <h4>{t("agentOps.recentEvents")}</h4>
            </div>
          </div>
          <div className="workflow-command-log-list">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <article className="workflow-command-log-row" key={event.event_id}>
                  <div className="workflow-command-log-head">
                    <span>{event.event_type}</span>
                    <small>{formatDateTime(event.generated_at)}</small>
                  </div>
                  <p className="clamp-2 copy-break" title={describeEvent(event)}>{describeEvent(event)}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("workflowStudio.noEvents")}</div>
            )}
          </div>
        </section>
      </div>

      <div className="workflow-command-grid">
        <section className="workflow-command-card">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{t("workflowStudio.auditTitle")}</span>
              <h4>{t("workflowStudio.auditDescription")}</h4>
            </div>
          </div>
          <div className="workflow-audit-table">
            <div className="workflow-audit-table-head">
              <span>{t("workflowStudio.auditArea")}</span>
              <span>{t("workflowStudio.auditVerdict")}</span>
              <span>{t("workflowStudio.auditReason")}</span>
              <span>{t("workflowStudio.auditNext")}</span>
            </div>
            {valueAuditRows.map((row) => (
              <article className="workflow-audit-row" key={row.id}>
                <strong>{row.area}</strong>
                <Badge color={row.tone}>{row.verdict}</Badge>
                <p className="clamp-2 copy-break" title={row.reason}>{row.reason}</p>
                <span>{row.next}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-command-card">
          <div className="workflow-command-card-head">
            <div>
              <span className="section-label">{t("workflowStudio.evalTitle")}</span>
              <h4>{t("workflowStudio.evalDescription")}</h4>
            </div>
          </div>

          <div className="workflow-eval-section">
            <div className="workflow-eval-head">
              <ClipboardList size={16} />
              <strong>{t("workflowStudio.evalDashboard")}</strong>
            </div>
            <div className="workflow-eval-list">
              {evaluationDashboardItems.map((item) => (
                <article className="workflow-eval-row" key={item.where}>
                  <span>{t("workflowStudio.evalWhere")}</span>
                  <strong>{item.where}</strong>
                  <p>{item.check}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="workflow-eval-section">
            <div className="workflow-eval-head">
              <Activity size={16} />
              <strong>{t("workflowStudio.evalCommandLine")}</strong>
            </div>
            <div className="workflow-eval-list">
              {evaluationCliItems.map((item) => (
                <article className="workflow-eval-row" key={item.command}>
                  <span>{t("workflowStudio.evalCommand")}</span>
                  <code>{item.command}</code>
                  <p>{item.expectation}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="workflow-runbook-note">
            <span>{t("workflowStudio.docPathLabel")}</span>
            <strong>/Users/suhui/Documents/百度同步/Project_Interest/ai-quant-empire/docs/runbooks/system-workflow-evaluation.md</strong>
          </div>
        </section>
      </div>
    </div>
  );
}

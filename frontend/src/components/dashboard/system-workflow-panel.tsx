import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  FlaskConical,
  LineChart,
  ShieldAlert,
} from "lucide-react";

import { useLocale } from "../../lib/i18n";
import type {
  WorkflowNotice,
  WorkflowProviderState,
  WorkflowRoleState,
  WorkflowSnapshot,
  WorkflowStageKey,
  WorkflowStageState,
} from "../../lib/workflow";

const STAGE_ORDER: WorkflowStageKey[] = [
  "market",
  "analysis",
  "strategy",
  "risk",
  "execution",
  "performance",
];

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

function badgeColor(status: string): "green" | "amber" | "red" | "cyan" {
  if (["completed", "ready"].includes(status)) {
    return "green";
  }
  if (["running"].includes(status)) {
    return "cyan";
  }
  if (["blocked", "degraded"].includes(status)) {
    return "amber";
  }
  return "red";
}

function providerBadgeColor(provider: WorkflowProviderState): "green" | "amber" | "red" | "cyan" {
  if (provider.effective && provider.status === "completed") {
    return "green";
  }
  if (provider.status === "running" || provider.effective) {
    return "cyan";
  }
  if (provider.availability === "fallback") {
    return "amber";
  }
  if (provider.availability === "unavailable") {
    return "red";
  }
  return "green";
}

function noticeTone(notice: WorkflowNotice): "green" | "amber" | "red" | "cyan" {
  return notice.severity === "danger" ? "red" : "amber";
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

function resolveStrategyPhaseLabel(t: (key: string) => string, phase: string): string {
  const key = `strategy.phase.${phase}`;
  const translated = t(key);
  return translated === key ? phase : translated;
}

function resolveAvailabilityLabel(t: (key: string) => string, availability: string): string {
  const key = `strategy.availability.${availability}`;
  const translated = t(key);
  return translated === key ? availability : translated;
}

function RoleTrack({ role }: { role: WorkflowRoleState }) {
  const { t, formatDateTime, formatPercent, formatRecommendation, formatRole } = useLocale();

  return (
    <article className="workflow-role-card">
      <div className="workflow-role-topline">
        <span className="section-label">{formatRole(role.role)}</span>
        <Badge color={badgeColor(role.status)}>{resolveStatusLabel(t, role.status)}</Badge>
      </div>
      <strong>
        {formatRecommendation(role.recommendation, { uppercase: true })} · {formatPercent(role.confidence * 100, false)}
      </strong>
      <p className="clamp-2 copy-break" title={role.summary}>
        {role.summary}
      </p>
      <small>
        {role.provider} · {formatDateTime(role.generated_at)}
      </small>
    </article>
  );
}

export function SystemWorkflowPanel({
  workflow,
  compact = false,
}: {
  workflow: WorkflowSnapshot | null;
  compact?: boolean;
}) {
  const { t, formatDateTime } = useLocale();
  const snapshot = workflow ?? null;

  if (!snapshot) {
    return (
      <div className="extension-card workflow-system-card">
        <div className="extension-card-headline">
          <div>
            <span className="section-label">{t("workflow.kicker")}</span>
            <h3>{t("workflow.title")}</h3>
          </div>
        </div>
        <div className="empty-state">{t("workflow.unavailable")}</div>
      </div>
    );
  }

  return (
    <div
      className={`extension-card workflow-system-card${compact ? " workflow-system-card--compact" : ""}`}
    >
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("workflow.kicker")}</span>
          <h3>{t("workflow.title")}</h3>
        </div>
        <Badge color={badgeColor(snapshot.stages[snapshot.active_stage_key ?? "market"].status)}>
          {snapshot.execution_mode.toUpperCase()}
        </Badge>
      </div>

      <div className="workflow-summary-strip">
        <article className="workflow-summary-item">
          <span>{t("workflow.currentRun")}</span>
          <strong className="token-ellipsis" title={snapshot.current_run_id ?? t("workflow.noRun")}> 
            {snapshot.current_run_id ?? t("workflow.noRun")}
          </strong>
        </article>
        <article className="workflow-summary-item">
          <span>{t("workflow.marketRoute")}</span>
          <strong>{snapshot.requested_market_source.toUpperCase()} -&gt; {snapshot.effective_market_source.toUpperCase()}</strong>
        </article>
        <article className="workflow-summary-item">
          <span>{t("workflow.executionAdapter")}</span>
          <strong className="token-ellipsis" title={snapshot.execution_adapter}>{snapshot.execution_adapter}</strong>
        </article>
      </div>

      <div className="workflow-handoff-card">
        <div>
          <span className="section-label">{t("workflow.handoff")}</span>
          <strong>{snapshot.active_stage_key ? resolveStageLabel(t, snapshot.stages[snapshot.active_stage_key]) : t("workflow.noActiveStage")}</strong>
        </div>
        <p className="clamp-2 copy-break" title={snapshot.current_handoff ?? t("workflow.noHandoff")}>
          {snapshot.current_handoff ?? t("workflow.noHandoff")}
        </p>
      </div>

      <div className="workflow-stage-board" data-compact={compact}>
        {STAGE_ORDER.map((key, index) => {
          const stage = snapshot.stages[key];
          const Icon = stageIcon(key);
          const active = snapshot.active_stage_key === key;
          return (
            <motion.article
              className="workflow-stage-card"
              data-status={stage.status}
              data-active={active}
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <div className="workflow-stage-head">
                <div className="workflow-stage-title">
                  <span className="workflow-stage-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <span className="section-label">{resolveStageLabel(t, stage)}</span>
                    <strong>{resolveStatusLabel(t, stage.status)}</strong>
                  </div>
                </div>
                <Badge color={badgeColor(stage.status)}>
                  {active ? t("workflow.active") : resolveStatusLabel(t, stage.status)}
                </Badge>
              </div>
              {stage.actor ? (
                <div className="workflow-stage-actor token-ellipsis" title={stage.actor}>
                  <Bot size={14} />
                  <span>{stage.actor}</span>
                </div>
              ) : null}
              <p className="clamp-3 copy-break" title={stage.detail ?? t("workflow.noDetail")}>
                {stage.detail ?? t("workflow.noDetail")}
              </p>
              <div className="workflow-facts">
                {stage.facts.slice(0, compact ? 2 : 4).map((fact) => (
                  <span className="workflow-fact-pill" data-tone={fact.tone} key={`${stage.key}-${fact.label}`}>
                    {fact.label}: {fact.value}
                  </span>
                ))}
              </div>
              {stage.updated_at ? (
                <small>{t("workflow.updatedAt", { time: formatDateTime(stage.updated_at) })}</small>
              ) : null}
            </motion.article>
          );
        })}
      </div>

      {!compact ? (
        <>
          <div className="workflow-subgrid">
            <section className="source-block workflow-role-block">
              <div className="evidence-block-head">
                <BrainCircuit size={16} />
                <strong>{t("workflow.roles")}</strong>
              </div>
              <div className="workflow-role-grid">
                {snapshot.roles.length > 0 ? (
                  snapshot.roles.map((role) => <RoleTrack key={role.role} role={role} />)
                ) : (
                  <div className="empty-state">{t("workflow.noRoles")}</div>
                )}
              </div>
            </section>

            <section className="source-block workflow-provider-block">
              <div className="evidence-block-head">
                <FlaskConical size={16} />
                <strong>{t("workflow.providers")}</strong>
              </div>
              <div className="artifact-list">
                {snapshot.providers.length > 0 ? (
                  snapshot.providers.map((provider) => (
                    <article className="source-row artifact-row" key={provider.provider}>
                      <div>
                        <span className="section-label">{provider.label}</span>
                        <strong>
                          {resolveStatusLabel(t, provider.status)} · {resolveStrategyPhaseLabel(t, provider.phase)}
                        </strong>
                        <p className="clamp-2 copy-break" title={provider.detail ?? provider.command ?? provider.provider}>
                          {provider.detail ?? provider.command ?? provider.provider}
                        </p>
                        <small>
                          {t("workflow.providerArtifacts", { count: provider.artifact_count })}
                          {provider.run_id ? ` · ${provider.run_id}` : ""}
                        </small>
                      </div>
                      <Badge color={providerBadgeColor(provider)}>
                        {provider.effective
                          ? t("workflow.effective")
                          : resolveAvailabilityLabel(t, provider.availability)}
                      </Badge>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">{t("workflow.noProviders")}</div>
                )}
              </div>
            </section>
          </div>

          <section className="source-block workflow-notice-block">
            <div className="evidence-block-head">
              <ShieldAlert size={16} />
              <strong>{t("workflow.notices")}</strong>
            </div>
            <div className="artifact-list">
              {snapshot.notices.length > 0 ? (
                snapshot.notices.map((notice) => (
                  <article className="source-row artifact-row" key={`${notice.key}-${notice.title}`}>
                    <div>
                      <span className="section-label">{notice.title}</span>
                      <strong>{notice.detail}</strong>
                    </div>
                    <Badge color={noticeTone(notice)}>{t(`workflow.noticeSeverity.${notice.severity}`)}</Badge>
                  </article>
                ))
              ) : (
                <div className="empty-state">{t("workflow.noNotices")}</div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

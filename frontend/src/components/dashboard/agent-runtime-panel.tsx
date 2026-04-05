import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Bot, BrainCircuit, PlugZap, Radar } from "lucide-react";

import { useLocale } from "../../lib/i18n";
import type {
  AgentRole,
  AgentRuntimeSummaryResponse,
  AnalysisRunResult,
  EventEnvelope,
  ExecutionStatusResponse,
} from "../../lib/market";

type AgentRuntimePanelProps = {
  latestAnalysis: AnalysisRunResult | null;
  agentRuntime: AgentRuntimeSummaryResponse;
  execution: ExecutionStatusResponse;
  eventFeed: EventEnvelope[];
};

function badgeColor(status: string): "green" | "amber" | "red" | "cyan" {
  if (["completed", "ready", "connected"].includes(status)) {
    return "green";
  }
  if (["running", "mock"].includes(status)) {
    return "cyan";
  }
  if (["fallback", "degraded", "timeout"].includes(status)) {
    return "amber";
  }
  return "red";
}

function strategyAgentBadgeColor(
  agent: AgentRuntimeSummaryResponse["agents"][number],
): "green" | "amber" | "red" | "cyan" {
  if (!agent.configured && !agent.effective) {
    return "amber";
  }
  return badgeColor(agent.status);
}

export function AgentRuntimePanel({
  latestAnalysis,
  agentRuntime,
  execution,
  eventFeed,
}: AgentRuntimePanelProps) {
  const { t, formatDateTime, formatPercent, formatRecommendation, formatRole } = useLocale();

  const describeStrategyAgentStatus = (agent: AgentRuntimeSummaryResponse["agents"][number]) => {
    if (!agent.configured && !agent.effective) {
      return t("strategy.availability.optional");
    }
    return agent.status;
  };

  const roleEvents = eventFeed
    .filter((event) => event.event_type === "agent.role.completed")
    .slice(0, 6);

  return (
    <div className="extension-card agent-runtime-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("agentOps.kicker")}</span>
          <h3>{t("agentOps.title")}</h3>
        </div>
        <Badge color={badgeColor(execution.adapter_runtime.status)}>{execution.adapter_runtime.status}</Badge>
      </div>

      <p className="quiet-copy clamp-2 copy-break" title={t("agentOps.description")}>
        {t("agentOps.description")}
      </p>

      <div className="agent-runtime-grid">
        <section className="source-block">
          <div className="evidence-block-head">
            <BrainCircuit size={16} />
            <strong>{t("agentOps.liveRoles")}</strong>
          </div>
          <div className="artifact-list">
            {latestAnalysis?.outputs.map((role) => (
              <article className="source-row artifact-row" key={role.role}>
                <div>
                  <span className="section-label">{formatRole(role.role)}</span>
                  <strong>
                    {formatRecommendation(role.recommendation, { uppercase: true })} · {formatPercent(role.confidence * 100, false)}
                  </strong>
                  <p className="clamp-2 copy-break" title={role.summary}>
                    {role.summary}
                  </p>
                  <small>
                    {t("agentOps.provider")}: {role.provider} · {t("agentOps.model")}: {role.model}
                  </small>
                </div>
                <Badge color={badgeColor(role.status)}>
                  {role.latency_ms ? t("agentOps.latency", { value: role.latency_ms }) : role.status}
                </Badge>
              </article>
            )) ?? <div className="empty-state">{t("agentOps.noRoles")}</div>}
          </div>
        </section>

        <section className="source-block">
          <div className="evidence-block-head">
            <Bot size={16} />
            <strong>{t("agentOps.strategyAgents")}</strong>
          </div>
          <div className="artifact-list">
            {agentRuntime.agents.length > 0 ? (
              agentRuntime.agents.map((agent) => (
                <article className="source-row artifact-row" key={agent.agent_id}>
                  <div>
                    <span className="section-label">{agent.label}</span>
                    <strong>
                      {describeStrategyAgentStatus(agent)} · {agent.phase}
                    </strong>
                    <p className="clamp-2 copy-break" title={agent.detail ?? agent.workspace}>
                      {agent.detail ?? agent.workspace}
                    </p>
                    <small>
                      {t("agentOps.logs", { count: agent.logs.length })} · {t("agentOps.artifacts", { count: agent.artifacts.length })}
                    </small>
                  </div>
                  <Badge color={strategyAgentBadgeColor(agent)}>{agent.provider}</Badge>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("agentOps.noAgents")}</div>
            )}
          </div>
        </section>
      </div>

      <div className="agent-runtime-grid agent-runtime-grid--compact">
        <section className="source-block">
          <div className="evidence-block-head">
            <PlugZap size={16} />
            <strong>{t("agentOps.executionRuntime")}</strong>
          </div>
          <div className="agent-runtime-stats">
            <article className="runtime-overview-item runtime-overview-item--compact">
              <div className="runtime-overview-line">
                <span>{t("agentOps.adapter")}</span>
                <strong>{execution.adapter}</strong>
              </div>
              <p className="clamp-2 copy-break" title={execution.adapter_runtime.detail}>
                {execution.adapter_runtime.detail}
              </p>
            </article>
            <article className="runtime-overview-item runtime-overview-item--compact">
              <div className="runtime-overview-line">
                <span>{t("agentOps.endpoint")}</span>
                <strong className="token-ellipsis" title={execution.adapter_runtime.endpoint ?? "-"}>
                  {execution.adapter_runtime.endpoint ?? "-"}
                </strong>
              </div>
              <p className="clamp-2 copy-break" title={execution.adapter_runtime.last_error ?? execution.adapter_runtime.detail}>
                {execution.adapter_runtime.last_error ?? execution.adapter_runtime.detail}
              </p>
            </article>
          </div>
        </section>

        <section className="source-block">
          <div className="evidence-block-head">
            <Radar size={16} />
            <strong>{t("agentOps.recentEvents")}</strong>
          </div>
          <div className="artifact-list">
            {roleEvents.length > 0 ? (
              roleEvents.map((event) => {
                const role = String(event.payload.run_role ?? "data") as AgentRole;
                const symbol = String(event.payload.symbol ?? "instrument");
                const output = event.payload.output as Record<string, unknown> | undefined;
                const summary = typeof output?.summary === "string" ? output.summary : String(event.event_type);
                return (
                  <article className="source-row artifact-row" key={event.event_id}>
                    <div>
                      <span className="section-label">{formatRole(role)}</span>
                      <strong>{symbol}</strong>
                      <p className="clamp-2 copy-break" title={summary}>{summary}</p>
                    </div>
                    <Badge color="cyan">{formatDateTime(event.generated_at)}</Badge>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">{t("agentOps.noEvents")}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

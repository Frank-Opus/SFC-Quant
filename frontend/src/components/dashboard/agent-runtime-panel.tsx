import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Bot, BrainCircuit, PlugZap, Radar } from "lucide-react";
import { useMemo, useState } from "react";

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

type RoleFilter = "all" | "active" | "buy" | "sell" | "hold";
type AgentFilter = "all" | "effective" | "ready" | "issues";

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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");

  const describeStrategyAgentStatus = (agent: AgentRuntimeSummaryResponse["agents"][number]) => {
    if (!agent.configured && !agent.effective) {
      return t("strategy.availability.optional");
    }
    return agent.status;
  };

  const roleEvents = eventFeed
    .filter((event) => event.event_type === "agent.role.completed")
    .slice(0, 6);

  const filteredRoles = useMemo(() => {
    const roles = latestAnalysis?.outputs ?? [];
    switch (roleFilter) {
      case "active":
        return roles.filter((role) => role.status === "completed");
      case "buy":
      case "sell":
      case "hold":
        return roles.filter((role) => role.recommendation === roleFilter);
      default:
        return roles;
    }
  }, [latestAnalysis?.outputs, roleFilter]);

  const filteredAgents = useMemo(() => {
    switch (agentFilter) {
      case "effective":
        return agentRuntime.agents.filter((agent) => agent.effective);
      case "ready":
        return agentRuntime.agents.filter((agent) => agent.status === "ready");
      case "issues":
        return agentRuntime.agents.filter((agent) =>
          ["fallback", "degraded", "timeout", "offline", "failed"].includes(agent.status),
        );
      default:
        return agentRuntime.agents;
    }
  }, [agentFilter, agentRuntime.agents]);

  const runtimeHealth = useMemo(
    () => [
      {
        id: "roles",
        label: t("agentOps.health.roles"),
        value: String(latestAnalysis?.outputs.length ?? 0),
      },
      {
        id: "highConfidence",
        label: t("agentOps.health.highConfidence"),
        value: String((latestAnalysis?.outputs ?? []).filter((role) => role.confidence >= 0.7).length),
      },
      {
        id: "agents",
        label: t("agentOps.health.readyAgents"),
        value: `${agentRuntime.agents.filter((agent) => agent.status === "ready").length}/${agentRuntime.agents.length}`,
      },
      {
        id: "events",
        label: t("agentOps.health.roleEvents"),
        value: String(roleEvents.length),
      },
    ],
    [agentRuntime.agents, latestAnalysis?.outputs, roleEvents.length, t],
  );

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

      <div className="agent-runtime-health-strip">
        {runtimeHealth.map((item) => (
          <article className="agent-runtime-health-card" key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="agent-runtime-controlbar">
        <div className="agent-runtime-control-group">
          <span className="section-label">{t("agentOps.filterRoles")}</span>
          <div className="agent-runtime-chip-row">
            {(["all", "active", "buy", "sell", "hold"] as RoleFilter[]).map((filter) => (
              <button
                type="button"
                className="agent-runtime-chip"
                data-active={roleFilter === filter}
                key={filter}
                onClick={() => setRoleFilter(filter)}
              >
                {t(`agentOps.roleFilter.${filter}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="agent-runtime-control-group">
          <span className="section-label">{t("agentOps.filterAgents")}</span>
          <div className="agent-runtime-chip-row">
            {(["all", "effective", "ready", "issues"] as AgentFilter[]).map((filter) => (
              <button
                type="button"
                className="agent-runtime-chip"
                data-active={agentFilter === filter}
                key={filter}
                onClick={() => setAgentFilter(filter)}
              >
                {t(`agentOps.agentFilter.${filter}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="agent-runtime-grid">
        <section className="source-block">
          <div className="evidence-block-head">
            <BrainCircuit size={16} />
            <strong>{t("agentOps.liveRoles")}</strong>
          </div>
          <div className="artifact-list">
            {filteredRoles.map((role) => (
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
            ))}
            {filteredRoles.length === 0 ? <div className="empty-state">{t("agentOps.noFilteredRoles")}</div> : null}
          </div>
        </section>

        <section className="source-block">
          <div className="evidence-block-head">
            <Bot size={16} />
            <strong>{t("agentOps.strategyAgents")}</strong>
          </div>
          <div className="artifact-list">
            {filteredAgents.length > 0 ? (
              filteredAgents.map((agent) => (
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
              <div className="empty-state">{t("agentOps.noFilteredAgents")}</div>
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

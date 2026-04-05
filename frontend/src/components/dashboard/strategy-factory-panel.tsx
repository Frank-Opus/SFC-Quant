import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Bot, FileCode2, FolderOpen, Sparkles, TerminalSquare } from "lucide-react";

import { Button } from "../ui/button";
import { useLocale } from "../../lib/i18n";
import type { StrategyArtifact, StrategyFactoryStatusResponse } from "../../lib/market";

type StrategyFactoryPanelProps = {
  status: StrategyFactoryStatusResponse;
  artifacts: StrategyArtifact[];
  pendingAction: string | null;
  onToggle: (enabled: boolean) => Promise<void>;
  onGenerate: () => Promise<void>;
};

function badgeColor(enabled: boolean): "green" | "amber" {
  return enabled ? "green" : "amber";
}

function availabilityColor(availability: "ready" | "fallback" | "unavailable"): "green" | "amber" | "red" {
  if (availability === "ready") {
    return "green";
  }
  if (availability === "fallback") {
    return "amber";
  }
  return "red";
}

function providerAvailabilityColor(
  provider: StrategyFactoryStatusResponse["providers"][number],
): "green" | "amber" | "red" {
  if (!provider.configured && !provider.effective) {
    return "amber";
  }
  return availabilityColor(provider.availability);
}

export function StrategyFactoryPanel({
  status,
  artifacts,
  pendingAction,
  onToggle,
  onGenerate,
}: StrategyFactoryPanelProps) {
  const { t, formatDateTime } = useLocale();
  const generationIsActive = status.generation.status === "running";
  const currentArtifacts = status.generation.artifacts.slice(0, 4);
  const currentLogs = [...status.generation.logs].slice(-3).reverse();

  const resolvePhaseLabel = (phase: StrategyFactoryStatusResponse["generation"]["phase"]): string => {
    const key = `strategy.phase.${phase}`;
    const translated = t(key);
    return translated === key ? phase : translated;
  };

  const resolveAvailabilityLabel = (provider: StrategyFactoryStatusResponse["providers"][number]): string => {
    const key = `strategy.availability.${
      !provider.configured && !provider.effective ? "optional" : provider.availability
    }`;
    const translated = t(key);
    return translated === key ? provider.availability : translated;
  };

  return (
    <div className="extension-card strategy-factory-card" data-testid="strategy-factory-panel">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("strategy.kicker")}</span>
          <h3>{t("strategy.title")}</h3>
        </div>
        <Badge color={badgeColor(status.enabled)} data-testid="strategy-factory-status">
          {status.enabled ? t("strategy.enabled") : t("strategy.disabled")}
        </Badge>
      </div>

      <p className="quiet-copy clamp-2 copy-break" title={status.reason ?? t("strategy.ready")}>
        {status.reason ?? t("strategy.ready")}
      </p>

      <div className="macro-regime-row">
        <div>
          <span className="section-label">{t("strategy.provider")}</span>
          <strong className="token-ellipsis" title={status.effective_provider}>
            {status.generation.provider_label ?? status.effective_provider}
          </strong>
        </div>
        <div>
          <span className="section-label">{t("strategy.artifacts")}</span>
          <strong>{status.artifact_count}</strong>
        </div>
      </div>

      <div className="strategy-meta-card">
        <Bot size={16} />
        <div>
          <span className="section-label">{t("strategy.generation")}</span>
          <strong data-testid="strategy-generation-status">
            {t(`strategy.generation.${status.generation.status}`)} · {resolvePhaseLabel(status.generation.phase)}
          </strong>
          {status.generation.detail ? (
            <p className="clamp-2 copy-break" title={status.generation.detail}>
              {status.generation.detail}
            </p>
          ) : null}
          {status.generation.updated_at ? (
            <small>{t("strategy.generation.updated", { time: formatDateTime(status.generation.updated_at) })}</small>
          ) : null}
        </div>
      </div>

      <div className="strategy-meta-grid">
        <div className="strategy-meta-card">
          <FolderOpen size={16} />
          <div>
            <span className="section-label">{t("strategy.workspace")}</span>
            <strong className="token-ellipsis" title={status.workspace}>
              {status.workspace}
            </strong>
          </div>
        </div>
        <div className="strategy-meta-card">
          <Bot size={16} />
          <div>
            <span className="section-label">{t("strategy.configured")}</span>
            <strong className="token-ellipsis" title={status.configured_provider}>
              {status.configured_provider}
            </strong>
          </div>
        </div>
      </div>

      <div className="operator-actions two-up strategy-actions">
        <Button
          variant={status.enabled ? "danger" : "secondary"}
          onClick={() => void onToggle(!status.enabled)}
          disabled={Boolean(pendingAction) || generationIsActive}
        >
          <Sparkles size={16} />
          {status.enabled ? t("strategy.disable") : t("strategy.enable")}
        </Button>
        <Button
          onClick={() => void onGenerate()}
          disabled={Boolean(pendingAction) || !status.enabled || generationIsActive}
        >
          <FileCode2 size={16} />
          {t("strategy.generate")}
        </Button>
      </div>

      <section className="source-block strategy-artifact-block">
        <div className="evidence-block-head">
          <Bot size={16} />
          <strong>{t("strategy.providers")}</strong>
        </div>
        <div className="artifact-list">
          {status.providers.map((provider) => (
            <article className="source-row artifact-row" key={provider.provider}>
              <div>
                <span className="section-label">{provider.label}</span>
                <strong>
                  {resolveAvailabilityLabel(provider)}
                  {provider.effective ? ` · ${t("strategy.current")}` : ""}
                </strong>
                <p className="clamp-2 copy-break" title={provider.reason ?? provider.command ?? provider.provider}>
                  {provider.reason ?? provider.command ?? provider.provider}
                </p>
                {provider.command ? <small className="copy-break">{provider.command}</small> : null}
              </div>
              <Badge color={providerAvailabilityColor(provider)}>
                {provider.provider}
              </Badge>
            </article>
          ))}
        </div>
      </section>

      {currentArtifacts.length > 0 || currentLogs.length > 0 ? (
        <section className="source-block strategy-artifact-block">
          <div className="evidence-block-head">
            <TerminalSquare size={16} />
            <strong>{t("strategy.runtime")}</strong>
          </div>
          <div className="artifact-list">
            {status.generation.artifact_directory ? (
              <article className="source-row artifact-row">
                <div>
                  <span className="section-label">{t("strategy.phaseLabel")}</span>
                  <strong>{resolvePhaseLabel(status.generation.phase)}</strong>
                  <p className="clamp-2 copy-break" title={status.generation.artifact_directory}>
                    {status.generation.artifact_directory}
                  </p>
                </div>
                <span className="source-link source-link-muted">{status.generation.active_provider ?? "mock_rdq"}</span>
              </article>
            ) : null}
            {currentArtifacts.map((artifact) => (
              <article className="source-row artifact-row" key={artifact.path}>
                <div>
                  <span className="section-label">{artifact.kind}</span>
                  <strong className="token-ellipsis" title={artifact.label}>
                    {artifact.label}
                  </strong>
                  <p className="clamp-2 copy-break" title={artifact.path}>
                    {artifact.path}
                  </p>
                </div>
                <span className="source-link source-link-muted">{artifact.exists ? t("strategy.exists") : t("strategy.missing")}</span>
              </article>
            ))}
            {currentLogs.map((entry) => (
              <article className="source-row artifact-row" key={`${entry.generated_at}-${entry.message}`}>
                <div>
                  <span className="section-label">{entry.level}</span>
                  <strong>{resolvePhaseLabel(entry.phase)}</strong>
                  <p className="clamp-2 copy-break" title={entry.message}>
                    {entry.message}
                  </p>
                </div>
                <span className="source-link source-link-muted">{formatDateTime(entry.generated_at)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="source-block strategy-artifact-block" data-testid="strategy-recent-artifacts">
        <div className="evidence-block-head">
          <FileCode2 size={16} />
          <strong>{t("strategy.recent")}</strong>
        </div>
        <div className="artifact-list">
          {artifacts.map((artifact) => (
            <article className="source-row artifact-row" key={artifact.artifact_id}>
              <div>
                <span className="section-label">{artifact.recommendation}</span>
                <strong>
                  {artifact.symbol} {artifact.timeframe}
                </strong>
                <p className="clamp-2 copy-break" title={artifact.summary}>
                  {artifact.summary}
                </p>
                <small>{formatDateTime(artifact.created_at)}</small>
              </div>
              <span className="source-link source-link-muted">
                {t("strategy.files", { count: artifact.files.length })}
              </span>
            </article>
          ))}
          {artifacts.length === 0 ? (
            <div className="empty-state">{t("strategy.empty")}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

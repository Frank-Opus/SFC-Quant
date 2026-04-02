import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Bot, FileCode2, FolderOpen, Sparkles } from "lucide-react";

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

export function StrategyFactoryPanel({
  status,
  artifacts,
  pendingAction,
  onToggle,
  onGenerate,
}: StrategyFactoryPanelProps) {
  const { t, formatDateTime } = useLocale();
  const generationIsActive = status.generation.status === "running";

  return (
    <div className="extension-card strategy-factory-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("strategy.kicker")}</span>
          <h3>{t("strategy.title")}</h3>
        </div>
        <Badge color={badgeColor(status.enabled)}>
          {status.enabled ? t("strategy.enabled") : t("strategy.disabled")}
        </Badge>
      </div>

      <p className="quiet-copy">{status.reason ?? t("strategy.ready")}</p>

      <div className="macro-regime-row">
        <div>
          <span className="section-label">{t("strategy.provider")}</span>
          <strong>{status.effective_provider}</strong>
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
          <strong>{t(`strategy.generation.${status.generation.status}`)}</strong>
          {status.generation.detail ? <p>{status.generation.detail}</p> : null}
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
            <strong>{status.workspace}</strong>
          </div>
        </div>
        <div className="strategy-meta-card">
          <Bot size={16} />
          <div>
            <span className="section-label">{t("strategy.configured")}</span>
            <strong>{status.configured_provider}</strong>
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
                <p>{artifact.summary}</p>
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

import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Bot, FileCode2, FolderOpen, Sparkles } from "lucide-react";

import { Button } from "../ui/button";
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
  return (
    <div className="extension-card strategy-factory-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">Strategy Factory</span>
          <h3>Review workspace</h3>
        </div>
        <Badge color={badgeColor(status.enabled)}>{status.enabled ? "enabled" : "disabled"}</Badge>
      </div>

      <p className="quiet-copy">{status.reason ?? "Optional strategy generation seam ready."}</p>

      <div className="macro-regime-row">
        <div>
          <span className="section-label">Provider</span>
          <strong>{status.effective_provider}</strong>
        </div>
        <div>
          <span className="section-label">Artifacts</span>
          <strong>{status.artifact_count}</strong>
        </div>
      </div>

      <div className="strategy-meta-grid">
        <div className="strategy-meta-card">
          <FolderOpen size={16} />
          <div>
            <span className="section-label">Workspace</span>
            <strong>{status.workspace}</strong>
          </div>
        </div>
        <div className="strategy-meta-card">
          <Bot size={16} />
          <div>
            <span className="section-label">Configured</span>
            <strong>{status.configured_provider}</strong>
          </div>
        </div>
      </div>

      <div className="operator-actions two-up strategy-actions">
        <Button
          variant={status.enabled ? "danger" : "secondary"}
          onClick={() => void onToggle(!status.enabled)}
          disabled={Boolean(pendingAction)}
        >
          <Sparkles size={16} />
          {status.enabled ? "Disable factory" : "Enable factory"}
        </Button>
        <Button
          onClick={() => void onGenerate()}
          disabled={Boolean(pendingAction) || !status.enabled}
        >
          <FileCode2 size={16} />
          Generate artifact
        </Button>
      </div>

      <section className="source-block strategy-artifact-block">
        <div className="evidence-block-head">
          <FileCode2 size={16} />
          <strong>Recent artifacts</strong>
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
                <small>{new Date(artifact.created_at).toLocaleString()}</small>
              </div>
              <span className="source-link source-link-muted">{artifact.files.length} files</span>
            </article>
          ))}
          {artifacts.length === 0 ? (
            <div className="empty-state">
              No strategy artifacts yet. Generate one to populate the local review workspace.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

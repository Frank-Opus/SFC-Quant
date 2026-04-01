import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Globe2, Newspaper, Radar, ShieldAlert } from "lucide-react";

import type { AgentAnalysisResult } from "../../lib/market";

function toneColor(stance: string): "green" | "amber" | "red" | "cyan" {
  if (stance === "bullish") {
    return "green";
  }
  if (stance === "bearish") {
    return "red";
  }
  if (stance === "cautious") {
    return "amber";
  }
  return "cyan";
}

type ThesisEvidencePanelProps = {
  macroRole: AgentAnalysisResult | null;
};

export function ThesisEvidencePanel({ macroRole }: ThesisEvidencePanelProps) {
  if (!macroRole) {
    return (
      <div className="extension-card thesis-evidence-card">
        <div className="extension-card-headline">
          <div>
            <span className="section-label">Macro Evidence</span>
            <h3>Thesis evidence</h3>
          </div>
          <Badge color="amber">pending</Badge>
        </div>
        <div className="empty-state">
          Run analysis to populate source-linked macro/news evidence for the current thesis.
        </div>
      </div>
    );
  }

  const thesis = macroRole.macro_thesis;

  return (
    <div className="extension-card thesis-evidence-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">Macro Evidence</span>
          <h3>Thesis evidence</h3>
        </div>
        <Badge color={toneColor(thesis?.stance ?? macroRole.signal_bias)}>
          {thesis?.stance ?? macroRole.signal_bias}
        </Badge>
      </div>

      <p className="quiet-copy">{thesis?.summary ?? macroRole.summary}</p>

      {thesis ? (
        <div className="macro-regime-row">
          <div>
            <span className="section-label">Regime</span>
            <strong>{thesis.regime}</strong>
          </div>
          <div>
            <span className="section-label">Confidence</span>
            <strong>{Math.round(macroRole.confidence * 100)}%</strong>
          </div>
        </div>
      ) : null}

      <div className="evidence-grid">
        <section className="evidence-block">
          <div className="evidence-block-head">
            <Radar size={16} />
            <strong>Catalysts</strong>
          </div>
          <div className="evidence-list">
            {(thesis?.catalysts ?? []).map((item) => (
              <article className="evidence-row" key={`${item.label}-${item.horizon}`}>
                <div className="event-head">
                  <span className="event-type">{item.label}</span>
                  <span>{item.horizon}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
            {thesis?.catalysts.length ? null : (
              macroRole.evidence.map((item) => (
                <article className="evidence-row" key={`${item.label}-${item.kind}`}>
                  <div className="event-head">
                    <span className="event-type">{item.label}</span>
                    <span>{item.kind}</span>
                  </div>
                  <p>{item.detail}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="evidence-block">
          <div className="evidence-block-head">
            <ShieldAlert size={16} />
            <strong>Watch items</strong>
          </div>
          <div className="evidence-list">
            {(thesis?.watch_items ?? []).map((item) => (
              <article className="evidence-row" key={`${item.label}-${item.trigger}`}>
                <div className="event-head">
                  <span className="event-type">{item.label}</span>
                  <span>watch</span>
                </div>
                <p>{item.trigger}</p>
                <small>{item.implication}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="source-block">
        <div className="evidence-block-head">
          <Newspaper size={16} />
          <strong>Linked sources</strong>
        </div>
        <div className="source-list">
          {macroRole.sources.map((source) => (
            <article className="source-row" key={`${source.title}-${source.url ?? source.note ?? "note"}`}>
              <div>
                <span className="section-label">{source.kind}</span>
                <strong>{source.title}</strong>
                {source.note ? <p>{source.note}</p> : null}
              </div>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="source-link">
                  <Globe2 size={14} />
                  Open
                </a>
              ) : (
                <span className="source-link source-link-muted">Local</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

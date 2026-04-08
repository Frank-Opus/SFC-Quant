import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Globe2, Newspaper, Radar, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { useLocale } from "../../lib/i18n";
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

type SourceFilter = "all" | "news" | "macro" | "local";

export function ThesisEvidencePanel({ macroRole }: ThesisEvidencePanelProps) {
  const { t, formatDateTime, formatNumber } = useLocale();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  if (!macroRole) {
    return (
      <div className="extension-card thesis-evidence-card">
        <div className="extension-card-headline">
          <div>
            <span className="section-label">{t("macro.kicker")}</span>
            <h3>{t("macro.title")}</h3>
          </div>
          <Badge color="amber">{t("macro.pending")}</Badge>
        </div>
        <div className="empty-state">{t("macro.empty")}</div>
      </div>
    );
  }

  const thesis = macroRole.macro_thesis;
  const filteredSources = useMemo(() => {
    if (sourceFilter === "all") {
      return macroRole.sources;
    }
    if (sourceFilter === "local") {
      return macroRole.sources.filter((source) => !source.url);
    }
    return macroRole.sources.filter((source) => source.kind.toLowerCase().includes(sourceFilter));
  }, [macroRole.sources, sourceFilter]);

  return (
    <div className="extension-card thesis-evidence-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("macro.kicker")}</span>
          <h3>{t("macro.title")}</h3>
        </div>
        <Badge color={toneColor(thesis?.stance ?? macroRole.signal_bias)}>
          {thesis?.stance ?? macroRole.signal_bias}
        </Badge>
      </div>

      <p
        className="quiet-copy clamp-3 copy-break"
        title={thesis?.summary ?? macroRole.summary}
      >
        {thesis?.summary ?? macroRole.summary}
      </p>

      {thesis ? (
        <div className="macro-regime-row">
          <div>
            <span className="section-label">{t("macro.regime")}</span>
            <strong>{thesis.regime}</strong>
          </div>
          <div>
            <span className="section-label">{t("macro.confidence")}</span>
            <strong>{formatNumber(macroRole.confidence * 100)}%</strong>
          </div>
        </div>
      ) : null}

      <div className="thesis-health-strip">
        <article className="thesis-health-card">
          <span>{t("macro.health.catalysts")}</span>
          <strong>{String(thesis?.catalysts.length ?? macroRole.evidence.length)}</strong>
        </article>
        <article className="thesis-health-card">
          <span>{t("macro.health.watchItems")}</span>
          <strong>{String(thesis?.watch_items.length ?? 0)}</strong>
        </article>
        <article className="thesis-health-card">
          <span>{t("macro.health.sources")}</span>
          <strong>{String(macroRole.sources.length)}</strong>
        </article>
        <article className="thesis-health-card">
          <span>{t("macro.health.updated")}</span>
          <strong>{formatDateTime(macroRole.generated_at)}</strong>
        </article>
      </div>

      <div className="thesis-controlbar">
        <div className="thesis-control-group">
          <span className="section-label">{t("macro.filterSources")}</span>
          <div className="thesis-chip-row">
            {(["all", "news", "macro", "local"] as SourceFilter[]).map((filter) => (
              <button
                type="button"
                className="thesis-chip"
                data-active={sourceFilter === filter}
                key={filter}
                onClick={() => setSourceFilter(filter)}
              >
                {t(`macro.sourceFilter.${filter}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="evidence-grid">
        <section className="evidence-block">
          <div className="evidence-block-head">
            <Radar size={16} />
            <strong>{t("macro.catalysts")}</strong>
          </div>
          <div className="evidence-list">
            {(thesis?.catalysts ?? []).map((item) => (
              <article className="evidence-row" key={`${item.label}-${item.horizon}`}>
                <div className="event-head">
                  <span className="event-type">{item.label}</span>
                  <span>{item.horizon}</span>
                </div>
                <p className="clamp-3 copy-break" title={item.detail}>
                  {item.detail}
                </p>
              </article>
            ))}
            {thesis?.catalysts.length ? null : (
              macroRole.evidence.map((item) => (
                <article className="evidence-row" key={`${item.label}-${item.kind}`}>
                  <div className="event-head">
                    <span className="event-type">{item.label}</span>
                    <span>{item.kind}</span>
                  </div>
                  <p className="clamp-3 copy-break" title={item.detail}>
                    {item.detail}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="evidence-block">
          <div className="evidence-block-head">
            <ShieldAlert size={16} />
            <strong>{t("macro.watchItems")}</strong>
          </div>
          <div className="evidence-list">
            {(thesis?.watch_items ?? []).map((item) => (
              <article className="evidence-row" key={`${item.label}-${item.trigger}`}>
                <div className="event-head">
                  <span className="event-type">{item.label}</span>
                  <span>{t("macro.watch")}</span>
                </div>
                <p className="clamp-2 copy-break" title={item.trigger}>
                  {item.trigger}
                </p>
                <small className="clamp-2 copy-break" title={item.implication}>
                  {item.implication}
                </small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="source-block">
        <div className="evidence-block-head">
          <Newspaper size={16} />
          <strong>{t("macro.sources")}</strong>
        </div>
        <div className="source-list">
          {filteredSources.map((source) => (
            <article className="source-row" key={`${source.title}-${source.url ?? source.note ?? "note"}`}>
              <div>
                <span className="section-label">{source.kind}</span>
                <strong className="clamp-2 copy-break" title={source.title}>
                  {source.title}
                </strong>
                {source.note ? (
                  <p className="clamp-2 copy-break" title={source.note}>
                    {source.note}
                  </p>
                ) : null}
              </div>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="source-link">
                  <Globe2 size={14} />
                  {t("macro.open")}
                </a>
              ) : (
                <span className="source-link source-link-muted">{t("macro.local")}</span>
              )}
            </article>
          ))}
          {filteredSources.length === 0 ? <div className="empty-state">{t("macro.emptyFiltered")}</div> : null}
        </div>
      </section>
    </div>
  );
}

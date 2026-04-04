import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Activity, Fuel, Globe2, Landmark, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";

import { useLocale } from "../../lib/i18n";
import {
  fallbackIntelligenceSnapshot,
  loadIntelligenceSnapshot,
  type IntelligenceMetric,
  type IntelligenceSnapshotResponse,
} from "../../lib/market";

function badgeColor(status: IntelligenceSnapshotResponse["status"]): "green" | "amber" | "red" {
  if (status === "ready") {
    return "green";
  }
  if (status === "partial") {
    return "amber";
  }
  return "red";
}

function metricTone(metric: IntelligenceMetric): "green" | "amber" | "red" | "cyan" {
  if (metric.change_percent == null) {
    return "cyan";
  }
  if (metric.change_percent > 0) {
    return "green";
  }
  if (metric.change_percent < 0) {
    return "red";
  }
  return "amber";
}

type MacroIntelligencePanelProps = {
  symbol: string;
  timeframe: string;
};

export function MacroIntelligencePanel({ symbol, timeframe }: MacroIntelligencePanelProps) {
  const { t, formatDateTime, formatNumber, formatPercent } = useLocale();
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshotResponse>(fallbackIntelligenceSnapshot);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const next = await loadIntelligenceSnapshot({ symbol, timeframe });
      if (!active) {
        return;
      }
      setSnapshot(next);
    };

    void load();
    const timer = window.setInterval(load, 300000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol, timeframe]);

  return (
    <div className="extension-card macro-intel-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("macroIntel.kicker")}</span>
          <h3>{t("macroIntel.title")}</h3>
        </div>
        <Badge color={badgeColor(snapshot.status)}>{t(`macroIntel.status.${snapshot.status}`)}</Badge>
      </div>

      <p className="quiet-copy clamp-3 copy-break" title={snapshot.summary}>
        {snapshot.summary}
      </p>

      <div className="macro-regime-row">
        <div>
          <span className="section-label">{t("macroIntel.focus")}</span>
          <strong>{snapshot.focus_symbol} · {snapshot.focus_timeframe}</strong>
        </div>
        <div>
          <span className="section-label">{t("macroIntel.updatedAt")}</span>
          <strong>{formatDateTime(snapshot.generated_at)}</strong>
        </div>
      </div>

      <section className="source-block">
        <div className="evidence-block-head">
          <Activity size={16} />
          <strong>{t("macroIntel.providers")}</strong>
        </div>
        <div className="macro-intel-provider-list">
          {snapshot.providers.map((provider) => (
            <article className="macro-intel-provider-chip" data-active={provider.available} key={provider.provider}>
              <span className="section-label">{provider.provider}</span>
              <strong>{provider.available ? t("macroIntel.providerLive") : t("macroIntel.providerDown")}</strong>
              <p className="clamp-2 copy-break" title={provider.detail}>{provider.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="evidence-grid">
        <section className="source-block">
          <div className="evidence-block-head">
            <Globe2 size={16} />
            <strong>{t("macroIntel.crypto")}</strong>
          </div>
          <div className="source-list">
            {snapshot.crypto.length > 0 ? (
              snapshot.crypto.map((metric) => (
                <article className="source-row" key={metric.key}>
                  <div>
                    <span className="section-label">{metric.source}</span>
                    <strong>{metric.label}</strong>
                    <p>{metric.as_of ? formatDateTime(metric.as_of) : "-"}</p>
                  </div>
                  <div className="macro-intel-metric">
                    <strong>{formatNumber(metric.value, 2)} {metric.unit ?? ""}</strong>
                    {metric.change_percent != null ? (
                      <Badge color={metricTone(metric)}>{formatPercent(metric.change_percent, true)}</Badge>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("macroIntel.empty")}</div>
            )}
          </div>
        </section>

        <section className="source-block">
          <div className="evidence-block-head">
            <Landmark size={16} />
            <strong>{t("macroIntel.macro")}</strong>
          </div>
          <div className="source-list">
            {snapshot.macro.length > 0 ? (
              snapshot.macro.map((metric) => (
                <article className="source-row" key={metric.key}>
                  <div>
                    <span className="section-label">{metric.source}</span>
                    <strong>{metric.label}</strong>
                    <p>{metric.as_of ? formatDateTime(metric.as_of) : "-"}</p>
                  </div>
                  <div className="macro-intel-metric">
                    <strong>{formatNumber(metric.value, 2)} {metric.unit ?? ""}</strong>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("macroIntel.empty")}</div>
            )}
          </div>
        </section>
      </div>

      <div className="evidence-grid">
        <section className="source-block">
          <div className="evidence-block-head">
            <Fuel size={16} />
            <strong>{t("macroIntel.energy")}</strong>
          </div>
          <div className="source-list">
            {snapshot.energy.length > 0 ? (
              snapshot.energy.map((metric) => (
                <article className="source-row" key={metric.key}>
                  <div>
                    <span className="section-label">{metric.source}</span>
                    <strong>{metric.label}</strong>
                    <p>{metric.as_of ? formatDateTime(metric.as_of) : "-"}</p>
                  </div>
                  <div className="macro-intel-metric">
                    <strong>{formatNumber(metric.value, 2)} {metric.unit ?? ""}</strong>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("macroIntel.empty")}</div>
            )}
          </div>
        </section>

        <section className="source-block">
          <div className="evidence-block-head">
            <Newspaper size={16} />
            <strong>{t("macroIntel.headlines")}</strong>
          </div>
          <div className="source-list">
            {snapshot.headlines.length > 0 ? (
              snapshot.headlines.map((headline) => (
                <article className="source-row" key={`${headline.source}-${headline.url}`}>
                  <div>
                    <span className="section-label">{headline.source}</span>
                    <strong className="clamp-2 copy-break" title={headline.title}>{headline.title}</strong>
                    <p>{headline.published_at ? formatDateTime(headline.published_at) : "-"}</p>
                  </div>
                  <a className="source-link" href={headline.url} rel="noreferrer" target="_blank">
                    <Globe2 size={14} />
                    {t("macro.open")}
                  </a>
                </article>
              ))
            ) : (
              <div className="empty-state">{t("macroIntel.empty")}</div>
            )}
          </div>
        </section>
      </div>

      {snapshot.warnings.length > 0 ? (
        <section className="source-block">
          <div className="evidence-block-head">
            <Activity size={16} />
            <strong>{t("macroIntel.warnings")}</strong>
          </div>
          <div className="source-list">
            {snapshot.warnings.map((warning) => (
              <article className="source-row" key={warning}>
                <div>
                  <strong className="clamp-2 copy-break" title={warning}>{warning}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

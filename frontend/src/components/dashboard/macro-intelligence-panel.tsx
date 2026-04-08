import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { Activity, Fuel, Globe2, Landmark, Newspaper } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

function providerStatusLabel(
  t: (key: string) => string,
  provider: IntelligenceSnapshotResponse["providers"][number],
): string {
  if (provider.available) {
    return t("macroIntel.providerLive");
  }
  if (!provider.configured) {
    return t("macroIntel.providerNotConfigured");
  }
  return t("macroIntel.providerDown");
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

type MetricFilter = "all" | "crypto" | "macro" | "energy";
type HeadlineFilter = "all" | "latest" | "warnings";

export function MacroIntelligencePanel({ symbol, timeframe }: MacroIntelligencePanelProps) {
  const { t, formatDateTime, formatNumber, formatPercent } = useLocale();
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshotResponse>(fallbackIntelligenceSnapshot);
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("all");
  const [headlineFilter, setHeadlineFilter] = useState<HeadlineFilter>("all");

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

  const macroHealth = useMemo(
    () => [
      {
        id: "providers",
        label: t("macroIntel.health.liveProviders"),
        value: `${snapshot.providers.filter((provider) => provider.available).length}/${snapshot.providers.length}`,
      },
      {
        id: "metrics",
        label: t("macroIntel.health.metrics"),
        value: String(snapshot.crypto.length + snapshot.macro.length + snapshot.energy.length),
      },
      {
        id: "headlines",
        label: t("macroIntel.health.headlines"),
        value: String(snapshot.headlines.length),
      },
      {
        id: "warnings",
        label: t("macroIntel.health.warnings"),
        value: String(snapshot.warnings.length),
      },
    ],
    [snapshot, t],
  );

  const filteredMetricSections = useMemo(() => {
    const sections = [
      { key: "crypto" as const, title: t("macroIntel.crypto"), icon: Globe2, items: snapshot.crypto },
      { key: "macro" as const, title: t("macroIntel.macro"), icon: Landmark, items: snapshot.macro },
      { key: "energy" as const, title: t("macroIntel.energy"), icon: Fuel, items: snapshot.energy },
    ];

    return metricFilter === "all" ? sections : sections.filter((section) => section.key === metricFilter);
  }, [metricFilter, snapshot.crypto, snapshot.energy, snapshot.macro, t]);

  const filteredHeadlines = useMemo(() => {
    if (headlineFilter === "latest") {
      return snapshot.headlines.slice(0, 3);
    }
    if (headlineFilter === "warnings") {
      return snapshot.headlines.filter((headline) =>
        /fed|war|tariff|risk|liquid|hack|sanction|volatility/i.test(headline.title),
      );
    }
    return snapshot.headlines;
  }, [headlineFilter, snapshot.headlines]);

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

      <div className="macro-health-strip">
        {macroHealth.map((item) => (
          <article className="macro-health-card" key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

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

      <div className="macro-controlbar">
        <div className="macro-control-group">
          <span className="section-label">{t("macroIntel.filterMetrics")}</span>
          <div className="macro-chip-row">
            {(["all", "crypto", "macro", "energy"] as MetricFilter[]).map((filter) => (
              <button
                type="button"
                className="macro-chip"
                data-active={metricFilter === filter}
                key={filter}
                onClick={() => setMetricFilter(filter)}
              >
                {t(`macroIntel.metricFilter.${filter}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="macro-control-group">
          <span className="section-label">{t("macroIntel.filterHeadlines")}</span>
          <div className="macro-chip-row">
            {(["all", "latest", "warnings"] as HeadlineFilter[]).map((filter) => (
              <button
                type="button"
                className="macro-chip"
                data-active={headlineFilter === filter}
                key={filter}
                onClick={() => setHeadlineFilter(filter)}
              >
                {t(`macroIntel.headlineFilter.${filter}`)}
              </button>
            ))}
          </div>
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
              <strong>{providerStatusLabel(t, provider)}</strong>
              <p className="clamp-2 copy-break" title={provider.detail}>{provider.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="evidence-grid">
        {filteredMetricSections.map((section) => {
          const Icon = section.icon;
          return (
            <section className="source-block" key={section.key}>
              <div className="evidence-block-head">
                <Icon size={16} />
                <strong>{section.title}</strong>
              </div>
              <div className="source-list">
                {section.items.length > 0 ? (
                  section.items.map((metric) => (
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
          );
        })}
        <section className="source-block">
          <div className="evidence-block-head">
            <Newspaper size={16} />
            <strong>{t("macroIntel.headlines")}</strong>
          </div>
          <div className="source-list">
            {filteredHeadlines.length > 0 ? (
              filteredHeadlines.map((headline) => (
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
              <div className="empty-state">{t("macroIntel.noFilteredHeadlines")}</div>
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

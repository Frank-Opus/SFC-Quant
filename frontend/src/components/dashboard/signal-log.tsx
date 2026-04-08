import { Activity, AlertTriangle, Bot, ShieldAlert, TrendingUp, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { useLocale } from "../../lib/i18n";
import type { AnalysisRunResult, EventEnvelope } from "../../lib/market";

type SignalLogProps = {
  events: EventEnvelope[];
  latestAnalysis: AnalysisRunResult | null;
  describeEvent: (event: EventEnvelope) => string;
  summarizeEvent: (event: EventEnvelope) => {
    trackLabel: string;
    outcomeLabel: string;
    tone: "risk" | "agent" | "execution" | "market" | "system" | "strategy";
  };
};

type SignalFilter = "all" | "agent" | "execution" | "risk" | "strategy";

function EventIcon({ tone }: { tone: "risk" | "agent" | "execution" | "market" | "system" | "strategy" }) {
  if (tone === "risk") {
    return <ShieldAlert size={16} />;
  }
  if (tone === "agent") {
    return <Bot size={16} />;
  }
  if (tone === "execution") {
    return <TrendingUp size={16} />;
  }
  if (tone === "strategy") {
    return <Wrench size={16} />;
  }
  if (tone === "system") {
    return <AlertTriangle size={16} />;
  }
  return <Activity size={16} />;
}

export function SignalLog({ events, latestAnalysis, describeEvent, summarizeEvent }: SignalLogProps) {
  const { t, formatRecommendation, formatTime } = useLocale();
  const [filter, setFilter] = useState<SignalFilter>("all");

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return events;
    }
    return events.filter((event) => summarizeEvent(event).tone === filter);
  }, [events, filter, summarizeEvent]);

  return (
    <div className="analytics-card signal-log-card">
      <div className="section-kicker">
        <span className="section-label">{t("analytics.signalLog.kicker")}</span>
        <span className="mini-muted">
          {t("analytics.signalLog.entries", { count: events.length })}
        </span>
      </div>
      <div className="signal-log-headline">
        <h3>{t("analytics.signalLog.title")}</h3>
        <p>
          {latestAnalysis
            ? t("analytics.signalLog.latest", {
                recommendation: formatRecommendation(latestAnalysis.overall_recommendation, {
                  uppercase: true,
                }),
                symbol: latestAnalysis.symbol,
              })
            : t("analytics.signalLog.waiting")}
        </p>
      </div>
      <div className="signal-log-controlbar">
        <span className="section-label">{t("analytics.signalLog.filter")}</span>
        <div className="signal-log-chip-row">
          {(["all", "agent", "execution", "risk", "strategy"] as SignalFilter[]).map((option) => (
            <button
              type="button"
              className="signal-log-chip"
              data-active={filter === option}
              key={option}
              onClick={() => setFilter(option)}
            >
              {t(`analytics.signalLog.filter.${option}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="signal-log-list">
        {filteredEvents.map((event) => {
          const summary = summarizeEvent(event);
          return (
            <article
              className="signal-item"
              data-tone={summary.tone}
              key={`${event.event_id}-${event.generated_at}`}
            >
              <div className="signal-icon-wrap">
                <EventIcon tone={summary.tone} />
              </div>
              <div className="signal-copy">
                <div className="signal-meta-row signal-meta-operator">
                  <span className="signal-track">{summary.trackLabel}</span>
                  <strong className="signal-outcome">{summary.outcomeLabel}</strong>
                  <span>{formatTime(event.generated_at)}</span>
                </div>
                <p>{describeEvent(event)}</p>
              </div>
            </article>
          );
        })}
        {filteredEvents.length === 0 ? <div className="empty-state">{t("analytics.signalLog.emptyFiltered")}</div> : null}
      </div>
    </div>
  );
}

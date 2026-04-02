import { Activity, AlertTriangle, Bot, ShieldAlert, TrendingUp, Wrench } from "lucide-react";

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
      <div className="signal-log-list">
        {events.map((event) => {
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
      </div>
    </div>
  );
}

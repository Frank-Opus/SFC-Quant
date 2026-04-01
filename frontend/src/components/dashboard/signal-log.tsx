import { motion } from "framer-motion";
import { Activity, AlertTriangle, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

import type { AnalysisRunResult, EventEnvelope } from "../../lib/market";

type SignalLogProps = {
  events: EventEnvelope[];
  latestAnalysis: AnalysisRunResult | null;
  describeEvent: (event: EventEnvelope) => string;
};

function resolveTone(eventType: string): "risk" | "agent" | "execution" | "market" {
  if (eventType.startsWith("risk.")) {
    return "risk";
  }
  if (eventType.startsWith("agent.")) {
    return "agent";
  }
  if (eventType.startsWith("execution.")) {
    return "execution";
  }
  return "market";
}

function EventIcon({ tone }: { tone: "risk" | "agent" | "execution" | "market" }) {
  if (tone === "risk") {
    return <ShieldAlert size={16} />;
  }
  if (tone === "agent") {
    return <Sparkles size={16} />;
  }
  if (tone === "execution") {
    return <TrendingUp size={16} />;
  }
  if (tone === "market") {
    return <Activity size={16} />;
  }
  return <AlertTriangle size={16} />;
}

export function SignalLog({ events, latestAnalysis, describeEvent }: SignalLogProps) {
  return (
    <div className="analytics-card signal-log-card">
      <div className="section-kicker">
        <span className="section-label">Signal Log</span>
        <span className="mini-muted">{events.length} live entries</span>
      </div>
      <div className="signal-log-headline">
        <h3>Decision tape</h3>
        <p>
          {latestAnalysis
            ? `Latest ${latestAnalysis.overall_recommendation.toUpperCase()} thesis on ${latestAnalysis.symbol}.`
            : "Waiting for the next analysis cycle."}
        </p>
      </div>
      <div className="signal-log-list">
        {events.map((event, index) => {
          const tone = resolveTone(event.event_type);
          return (
            <motion.article
              className="signal-item"
              data-tone={tone}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              key={`${event.event_id}-${event.generated_at}`}
            >
              <div className="signal-icon-wrap">
                <EventIcon tone={tone} />
              </div>
              <div className="signal-copy">
                <div className="signal-meta-row">
                  <strong>{event.event_type}</strong>
                  <span>{new Date(event.generated_at).toLocaleTimeString()}</span>
                </div>
                <p>{describeEvent(event)}</p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

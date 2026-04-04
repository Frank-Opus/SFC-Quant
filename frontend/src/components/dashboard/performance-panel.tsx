import { Badge } from "@tremor/react/dist/components/text-elements/Badge/Badge";
import { BarChart3, RotateCcw } from "lucide-react";

import { Button } from "../ui/button";
import { useLocale } from "../../lib/i18n";
import type { PerformanceReport } from "../../lib/market";

type PerformancePanelProps = {
  paperReport: PerformanceReport;
  backtestReport: PerformanceReport | null;
  pendingAction: string | null;
  onRunBacktest: () => Promise<void>;
};

function toneColor(value: number): "green" | "amber" | "red" {
  if (value > 0) {
    return "green";
  }
  if (value < 0) {
    return "red";
  }
  return "amber";
}

function buildSparkline(points: PerformanceReport["equity_curve"]): string {
  if (points.length === 0) {
    return "";
  }
  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 100 - ((point.equity - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function PerformanceCard({
  report,
  label,
}: {
  report: PerformanceReport;
  label: string;
}) {
  const { t, formatCurrency, formatPercent, formatNumber, formatDateTime } = useLocale();
  const sparkline = buildSparkline(report.equity_curve);
  const trades = report.trades.slice(-4).reverse();

  return (
    <section className="source-block performance-card-block">
      <div className="evidence-block-head">
        <div className="performance-card-headline">
          <strong>{label}</strong>
          <span className="section-label">
            {report.symbol ?? "-"} {report.timeframe ?? ""}
          </span>
        </div>
        <Badge color={toneColor(report.total_return)}>{formatPercent(report.total_return)}</Badge>
      </div>

      <div className="performance-metric-grid">
        <article className="runtime-overview-item runtime-overview-item--compact">
          <div className="runtime-overview-line">
            <span>{t("performance.startingBalance")}</span>
            <strong>{formatCurrency(report.starting_balance)}</strong>
          </div>
          <p>{t("performance.tradeCount")}: {formatNumber(report.trade_count)}</p>
        </article>
        <article className="runtime-overview-item runtime-overview-item--compact">
          <div className="runtime-overview-line">
            <span>{t("performance.endingBalance")}</span>
            <strong>{formatCurrency(report.ending_balance)}</strong>
          </div>
          <p>{t("performance.winRate")}: {formatPercent(report.win_rate)}</p>
        </article>
        <article className="runtime-overview-item runtime-overview-item--compact">
          <div className="runtime-overview-line">
            <span>{t("performance.maxDrawdown")}</span>
            <strong>{formatPercent(-Math.abs(report.max_drawdown))}</strong>
          </div>
          <p>{t("performance.source")}: {report.source ?? "-"}</p>
        </article>
        <article className="runtime-overview-item runtime-overview-item--compact">
          <div className="runtime-overview-line">
            <span>{t("performance.strategy")}</span>
            <strong className="token-ellipsis" title={report.strategy ?? "-"}>
              {report.strategy ?? "-"}
            </strong>
          </div>
          <p>{t("performance.candleCount")}: {formatNumber(report.candle_count ?? 0)}</p>
        </article>
      </div>

      <div className="performance-sparkline-shell">
        {sparkline ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="performance-sparkline" aria-hidden="true">
            <polyline points={sparkline} />
          </svg>
        ) : (
          <div className="empty-state">{t("performance.empty")}</div>
        )}
      </div>

      <div className="artifact-list">
        {trades.length > 0 ? (
          trades.map((trade) => (
            <article className="source-row artifact-row" key={trade.trade_id}>
              <div>
                <span className="section-label">{trade.symbol}</span>
                <strong>
                  {formatCurrency(trade.entry_price)} {"->"} {formatCurrency(trade.exit_price)}
                </strong>
                <p>
                  {formatDateTime(trade.opened_at)} {"->"} {formatDateTime(trade.closed_at)}
                </p>
              </div>
              <Badge color={toneColor(trade.pnl)}>{formatCurrency(trade.pnl)}</Badge>
            </article>
          ))
        ) : (
          <div className="empty-state">{t("performance.empty")}</div>
        )}
      </div>
    </section>
  );
}

export function PerformancePanel({
  paperReport,
  backtestReport,
  pendingAction,
  onRunBacktest,
}: PerformancePanelProps) {
  const { t } = useLocale();

  return (
    <div className="extension-card performance-panel-card">
      <div className="extension-card-headline">
        <div>
          <span className="section-label">{t("performance.kicker")}</span>
          <h3>{t("performance.title")}</h3>
        </div>
        <Badge color={toneColor(paperReport.total_return)}>{paperReport.mode}</Badge>
      </div>

      <p className="quiet-copy clamp-2 copy-break" title={t("performance.description")}>
        {t("performance.description")}
      </p>

      <div className="operator-actions two-up strategy-actions">
        <Button onClick={() => void onRunBacktest()} disabled={Boolean(pendingAction)}>
          <RotateCcw size={16} />
          {t("performance.runBacktest")}
        </Button>
      </div>

      <div className="performance-grid">
        <PerformanceCard label={t("performance.paper")} report={paperReport} />
        {backtestReport ? (
          <PerformanceCard label={t("performance.backtest")} report={backtestReport} />
        ) : (
          <section className="source-block performance-card-block performance-card-block--empty">
            <div className="evidence-block-head">
              <BarChart3 size={16} />
              <strong>{t("performance.backtest")}</strong>
            </div>
            <div className="empty-state">{t("performance.unavailable")}</div>
          </section>
        )}
      </div>
    </div>
  );
}

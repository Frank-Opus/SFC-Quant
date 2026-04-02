import { useLocale } from "../../lib/i18n";

type HeatmapCell = {
  key: string;
  label: string;
  timeframe: string;
  changePercent: number;
  exposureUsd: number;
  pnlUsd: number;
  active: boolean;
};

type PositionsHeatmapProps = {
  cells: HeatmapCell[];
};

function cellTone(cell: HeatmapCell): string {
  if (cell.active && cell.pnlUsd < 0) {
    return "rgba(255, 120, 120, 0.4)";
  }
  if (cell.active && cell.pnlUsd >= 0) {
    return "rgba(130, 255, 190, 0.42)";
  }
  if (cell.changePercent >= 0) {
    return "rgba(121, 243, 255, 0.22)";
  }
  return "rgba(255, 194, 108, 0.22)";
}

export function PositionsHeatmap({ cells }: PositionsHeatmapProps) {
  const { t, formatCurrency, formatNumber, formatPercent } = useLocale();

  return (
    <div className="analytics-card heatmap-card">
      <div className="section-kicker">
        <span className="section-label">{t("analytics.heatmap.kicker")}</span>
        <span className="mini-muted">{t("analytics.heatmap.cells", { count: cells.length })}</span>
      </div>
      <div className="analytics-card-headline">
        <h3>{t("analytics.heatmap.title")}</h3>
        <p>{t("analytics.heatmap.description")}</p>
      </div>
      <div className="heatmap-grid">
        {cells.map((cell) => (
          <article
            className="heatmap-cell"
            key={cell.key}
            style={{ background: `linear-gradient(180deg, ${cellTone(cell)}, rgba(255,255,255,0.03))` }}
          >
            <div className="heatmap-cell-head">
              <strong>{cell.label}</strong>
              <span>{cell.timeframe}</span>
            </div>
            <div className="heatmap-cell-body">
              <span data-positive={cell.changePercent >= 0}>
                {formatPercent(cell.changePercent)}
              </span>
              <small>
                {cell.active
                  ? formatCurrency(cell.pnlUsd)
                  : t("analytics.heatmap.watch", {
                      value: formatNumber(cell.exposureUsd, 0),
                    })}
              </small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export type { HeatmapCell };

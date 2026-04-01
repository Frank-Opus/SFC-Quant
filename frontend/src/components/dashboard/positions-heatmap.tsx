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
  return (
    <div className="analytics-card heatmap-card">
      <div className="section-kicker">
        <span className="section-label">Positions Heatmap</span>
        <span className="mini-muted">{cells.length} cells</span>
      </div>
      <div className="analytics-card-headline">
        <h3>Exposure field</h3>
        <p>Active positions glow by live P&L while watchlist cells still show market pressure.</p>
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
                {cell.changePercent >= 0 ? "+" : ""}
                {cell.changePercent.toFixed(2)}%
              </span>
              <small>
                {cell.active
                  ? `${cell.pnlUsd >= 0 ? "+" : ""}${cell.pnlUsd.toFixed(2)} USD`
                  : `${cell.exposureUsd.toFixed(0)} USD watch`}
              </small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export type { HeatmapCell };

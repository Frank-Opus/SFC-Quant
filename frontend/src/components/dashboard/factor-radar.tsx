type RadarAxis = {
  label: string;
  value: number;
};

type FactorRadarProps = {
  axes: RadarAxis[];
  recommendation: string;
};

function polarPoint(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2;
  return {
    x: 110 + Math.cos(angle) * radius,
    y: 110 + Math.sin(angle) * radius,
  };
}

export function FactorRadar({ axes, recommendation }: FactorRadarProps) {
  const levels = [28, 48, 68, 88];
  const polygonPoints = axes
    .map((axis, index) => {
      const point = polarPoint(index, axes.length, (axis.value / 100) * 88);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="analytics-card radar-card">
      <div className="section-kicker">
        <span className="section-label">Factor Radar</span>
        <span className="mini-muted">{recommendation.toUpperCase()}</span>
      </div>
      <div className="analytics-card-headline">
        <h3>Signal geometry</h3>
        <p>Trend, momentum, macro, execution readiness, and remaining risk buffer on one frame.</p>
      </div>
      <div className="radar-shell">
        <svg className="radar-svg" viewBox="0 0 220 220" role="img">
          {levels.map((radius) => (
            <polygon
              className="radar-grid"
              key={radius}
              points={axes
                .map((_, index) => {
                  const point = polarPoint(index, axes.length, radius);
                  return `${point.x},${point.y}`;
                })
                .join(" ")}
            />
          ))}
          {axes.map((axis, index) => {
            const edge = polarPoint(index, axes.length, 96);
            return (
              <g key={axis.label}>
                <line className="radar-axis" x1="110" x2={edge.x} y1="110" y2={edge.y} />
                <text className="radar-label" x={edge.x} y={edge.y}>
                  {axis.label}
                </text>
              </g>
            );
          })}
          <polygon className="radar-shape" points={polygonPoints} />
          {axes.map((axis, index) => {
            const point = polarPoint(index, axes.length, (axis.value / 100) * 88);
            return (
              <circle
                className="radar-node"
                cx={point.x}
                cy={point.y}
                key={axis.label}
                r="4"
              />
            );
          })}
        </svg>
        <div className="radar-legend">
          {axes.map((axis) => (
            <div className="radar-legend-row" key={axis.label}>
              <span>{axis.label}</span>
              <strong>{Math.round(axis.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { RadarAxis };

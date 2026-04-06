type SectionTruthItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

type SectionTruthStripProps = {
  items: SectionTruthItem[];
  compact?: boolean;
};

export function SectionTruthStrip({
  items,
  compact = false,
}: SectionTruthStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`section-truth-strip${compact ? " section-truth-strip--compact" : ""}`}
      data-testid="section-truth-strip"
    >
      {items.map((item) => (
        <article
          className="section-truth-card"
          data-tone={item.tone ?? "default"}
          key={item.id}
        >
          <span>{item.label}</span>
          <strong className="token-ellipsis" title={item.value}>
            {item.value}
          </strong>
          {item.detail ? (
            <small className="clamp-2 copy-break" title={item.detail}>
              {item.detail}
            </small>
          ) : null}
        </article>
      ))}
    </div>
  );
}

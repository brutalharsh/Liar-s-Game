/** XP / progress bar with brass fill. */
export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: {
  value: number;
  max: number;
  label?: string;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between font-body text-xs text-ink-dim">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "progress"}
        className="h-3 w-full overflow-hidden rounded-full border border-wood-mid bg-wood-deep"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-brass-deep to-brass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

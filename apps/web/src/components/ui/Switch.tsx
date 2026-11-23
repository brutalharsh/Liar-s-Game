"use client";

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-12 min-w-12 items-center rounded-full border-2 px-1 transition-colors ${
        checked ? "border-brass bg-brass/25" : "border-ink-dim/50 bg-wood-deep"
      }`}
      aria-label={label}
    >
      <span
        className={`h-8 w-8 rounded-full transition-transform ${checked ? "translate-x-0 bg-brass" : "-translate-x-0.5 bg-ink-dim/60"}`}
        aria-hidden
      />
    </button>
  );
}

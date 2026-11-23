"use client";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  emoji?: string;
}

/** Accessible tab strip (48px targets). */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-2 ${className}`}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`min-h-12 rounded-btn border-2 px-4 font-display text-sm tracking-wide ${
              selected
                ? "border-brass bg-brass/15 text-brass"
                : "border-wood-mid/70 bg-wood/50 text-ink-dim hover:text-ivory"
            }`}
          >
            {tab.emoji && <span aria-hidden className="mr-1">{tab.emoji}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

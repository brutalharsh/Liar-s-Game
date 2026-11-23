"use client";

import type { ReactNode } from "react";
import type { IconProps } from "@/components/ui/icons";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Icon element (lucide wrapper — preferred over the emoji glyph). */
  icon?: (props: IconProps) => ReactNode;
  /** Legacy emoji glyph — survives until every caller passes `icon`. */
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
            {tab.icon ? (
              <span aria-hidden className="mr-1 inline-flex items-center">
                <tab.icon />
              </span>
            ) : tab.emoji ? (
              <span aria-hidden className="mr-1">
                {tab.emoji}
              </span>
            ) : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

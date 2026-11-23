import type { ReactNode } from "react";

/** Wooden bar-panel container. */
export function Panel({
  children,
  className = "",
  tone = "wood",
}: {
  children: ReactNode;
  className?: string;
  tone?: "wood" | "deep" | "felt";
}) {
  const tones = {
    wood: "bg-wood/70 border-wood-mid/60",
    deep: "bg-wood-deep/80 border-wood-mid/50",
    felt: "bg-felt-deep/50 border-felt/50",
  } as const;
  return (
    <div className={`rounded-card border ${tones[tone]} shadow-panel ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="mb-4">
      {kicker && <p className="mb-1 font-body text-xs uppercase tracking-[0.3em] text-lamp">{kicker}</p>}
      <h2 className="font-display text-3xl text-ivory md:text-4xl">{children}</h2>
    </div>
  );
}

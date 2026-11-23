"use client";

/** Big chamber counter for the hero strip + counters everywhere (x/6). */
export function ChamberPips({ pulled, showLabel = true }: { pulled: number; showLabel?: boolean }) {
  const risk = pulled >= 5 ? "bg-blood-bright" : pulled >= 3 ? "bg-lamp" : "bg-brass";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full border border-wood-deep ${
              i < pulled ? risk : "bg-wood-mid/70"
            }`}
          />
        ))}
      </span>
      {showLabel && (
        <span
          className={`font-display text-lg ${
            pulled >= 5 ? "text-blood-bright" : pulled >= 3 ? "text-lamp" : "text-brass"
          }`}
        >
          {pulled}/6
        </span>
      )}
      <span className="sr-only">{`${pulled} of 6 chambers used`}</span>
    </span>
  );
}

"use client";

import { useCountdown } from "@/hooks/useCountdown";

/**
 * Timer arc (research/09 §2.2c): SVG ring around the active seat / CHECK
 * button, amber → red when urgent. Renders from deadlineTs each second (no
 * tick spam — STR/07 §4: the client renders, the server acts); the 1s CSS
 * transition keeps the sweep smooth between ticks.
 */
export function TimerArc({
  deadlineTs,
  size = 44,
  width = 3,
  className = "",
  label,
}: {
  deadlineTs: number | null;
  size?: number;
  width?: number;
  className?: string;
  label?: string;
}) {
  const { secondsLeft, urgent, expired } = useCountdown(deadlineTs);
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const total = 10; // window/turn budgets live in the seconds range we sweep
  const fraction = deadlineTs === null || expired ? 0 : Math.max(0.04, Math.min(1, secondsLeft / total));
  const stroke = urgent ? "var(--color-blood-bright)" : "var(--color-lamp)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="timer"
      aria-label={label ? `${label} — ${Math.ceil(secondsLeft)}s left` : `${Math.ceil(secondsLeft)}s left`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-wood-mid)" strokeWidth={width} opacity={0.55} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
      />
    </svg>
  );
}

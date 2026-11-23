/**
 * Verdict display — colorblind-safe by design (STR/05 §7): NEVER color
 * alone; always icon + text.
 */
export function Verdict({
  verdict,
  size = "md",
}: {
  verdict: "TRUTH" | "LIE";
  size?: "md" | "xl";
}) {
  const truth = verdict === "TRUTH";
  const cls = size === "xl" ? "text-4xl md:text-6xl px-8 py-4" : "text-lg px-4 py-2";
  return (
    <span
      role="img"
      aria-label={verdict}
      className={`inline-flex items-center gap-2 rounded-btn border-4 font-display uppercase tracking-widest ${cls} ${
        truth
          ? "border-verdict bg-verdict/20 text-verdict"
          : "border-blood-bright bg-blood/20 text-blood-bright"
      }`}
    >
      <span aria-hidden>{truth ? "✓" : "✗"}</span>
      {verdict}
    </span>
  );
}

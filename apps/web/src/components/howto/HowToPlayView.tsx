"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RULE_SECTIONS, DECK_TABLE } from "@/lib/mock/rules-content";
import { RULE_ICON, type RuleIconSlug } from "@/components/ui/icons";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const LOOP: readonly { icon: RuleIconSlug; label: string; detail: string }[] = [
  { icon: "deal", label: "DEAL", detail: "table card drawn · 5 cards each" },
  { icon: "throw", label: "THROW", detail: "claim they match the table card" },
  { icon: "call", label: "CALL", detail: "cry LIAR on the previous play" },
  { icon: "reveal", label: "REVEAL", detail: "the accused flips, one by one" },
  { icon: "shot", label: "SHOT", detail: "loser pulls the trigger" },
  { icon: "win", label: "SURVIVE… OR WIN", detail: "last one standing takes the table" },
];

/**
 * The numbered game-loop diagram (pure CSS + props-driven highlight — no
 * images). The spotlight cycles 1→6 forever; reduced motion parks it on
 * step 1, static.
 */
function LoopDiagram() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setActive((a) => (a + 1) % LOOP.length), 1500);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <Panel tone="felt" className="p-4 md:p-6">
      <p className="mb-3 text-center font-body text-xs uppercase tracking-[0.3em] text-lamp">
        the round loop
      </p>
      <ol className="flex flex-col items-stretch justify-center gap-3 md:grid md:grid-cols-3 md:items-center xl:flex xl:flex-row">
        {LOOP.map((step, i) => {
          const lit = reduced ? i === 0 : i === active;
          const Glyph = RULE_ICON[step.icon];
          return (
            <li key={step.label} className="flex flex-col items-stretch xl:flex-1 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3 xl:flex-col xl:gap-1">
                <motion.span
                  animate={{ scale: lit ? 1.06 : 1 }}
                  transition={{ duration: reduced ? 0 : 0.3 }}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 font-display text-lg ${
                    lit
                      ? "border-brass bg-brass/20 text-brass"
                      : "border-wood-mid bg-wood-deep/60 text-ink-dim"
                  }`}
                >
                  <span aria-hidden>
                    <Glyph size={26} />
                  </span>
                </motion.span>
                <div className="xl:text-center">
                  <p className={`font-display text-sm tracking-wide ${lit ? "text-brass" : "text-ivory"}`}>
                    {i + 1}. {step.label}
                  </p>
                  <p className="font-body text-[11px] leading-tight text-ink-dim">{step.detail}</p>
                </div>
              </div>
              <span aria-hidden className="hidden text-brass xl:ml-auto xl:mt-2 xl:block">
                {i === LOOP.length - 1 ? "↺" : "→"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center font-body text-xs text-ink-dim">
        …and the wheel keeps spinning until one player is left standing.
      </p>
    </Panel>
  );
}

export function HowToPlayView() {
  return (
    <div className="flex flex-col gap-10 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-6xl">How to play</h1>
        <p className="mx-auto mt-3 max-w-lg font-body text-sm text-ink-dim">
          The full house rules, distilled from the table itself. Two minutes to learn — a lifetime
          to perfect the innocent face.
        </p>
      </section>

      <LoopDiagram />

      <section className="flex flex-col gap-6">
        {RULE_SECTIONS.map((rule) => {
          const Glyph = RULE_ICON[rule.icon];
          return (
            <Panel key={rule.id} className="flex flex-col gap-3 p-5 md:flex-row md:gap-8 md:p-7">
              <div className="flex min-w-32 items-start gap-4 md:flex-col">
                <span className="font-display text-5xl text-brass/80 md:text-6xl">{rule.step}</span>
                <span className="mt-1 text-brass/70 md:mt-2" aria-hidden>
                  <Glyph size={40} />
                </span>
              </div>
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl text-ivory md:text-3xl">{rule.title}</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {rule.body.map((para, i) => (
                    <li key={i} className="font-body text-sm leading-relaxed text-ink-dim">
                      · {para}
                    </li>
                  ))}
                </ul>
                {rule.callout && (
                  <p className="mt-3 rounded-btn border-l-4 border-brass bg-brass/10 px-4 py-2 font-body text-sm italic text-lamp">
                    “{rule.callout}”
                  </p>
                )}
              </div>
            </Panel>
          );
        })}
      </section>

      <section>
        <SectionTitle kicker="equipment">Deck scaling</SectionTitle>
        <Panel className="p-5">
          <table className="w-full text-left font-body text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-lamp">
                <th scope="col" className="py-2 pr-4">Players</th>
                <th scope="col" className="py-2 pr-4">Liar's deck</th>
                <th scope="col" className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {DECK_TABLE.map((row) => (
                <tr key={row.players} className="border-t border-wood-mid/40 text-ink-dim">
                  <td className="py-2 pr-4 font-display text-brass">{row.players}</td>
                  <td className="py-2 pr-4">{row.deck}</td>
                  <td className="py-2 text-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      <section className="text-center">
        <p className="font-body text-sm text-ink-dim">Got it? Prove it at the table.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/create"
            className="inline-flex min-h-16 touch-manipulation items-center justify-center rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-lamp px-8 font-display text-lg tracking-wide text-wood-deep hover:brightness-110 active:brightness-95"
          >
            CREATE A TABLE
          </Link>
        </div>
      </section>
    </div>
  );
}

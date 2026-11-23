"use client";

import Link from "next/link";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { InfoIcon, RulesIcon } from "@/components/ui/icons";

/**
 * ABOUT — the placemat under the glass: version, the house rules door, the
 * privacy note and the install hint. No controls, nothing editable, nothing
 * that leaves the tab.
 */
export function AboutSection() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="About Liar's Game">
        <SectionTitle kicker="the placemat">About</SectionTitle>
        <Panel tone="deep" className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="text-brass" aria-hidden>
              <InfoIcon size={22} />
            </span>
            <div>
              <p className="font-display text-xl text-ivory">Liar's Game</p>
              <p className="font-body text-xs text-ink-dim">
                v0.1.0 — mock-first build. The real tables land with the live server wave.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t-2 border-wood-mid/50 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-base text-ivory">How to play</p>
                <p className="font-body text-xs text-ink-dim">
                  Round flow, liar calls, the revolver — the full house rules.
                </p>
              </div>
              <Link
                href="/how-to-play"
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-btn border-2 border-ink-dim/70 px-4 font-display text-xs tracking-wide text-ivory hover:border-brass hover:text-red-text"
              >
                <RulesIcon size={16} /> RULES
              </Link>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-base text-ivory">Install to your device</p>
                <p className="font-body text-xs text-ink-dim">
                  Use your browser's "Add to Home Screen" — the game sits on your phone like any
                  app, works fullscreen, no store visit.
                </p>
              </div>
            </div>

            <div className="mt-1 rounded-btn border-l-4 border-lamp bg-lamp/10 px-3 py-2">
              <p className="font-body text-[11px] text-ink-dim">
                <span className="text-lamp">Privacy, short and honest:</span> your session rides
                a server cookie; sound, motion and comfort choices stay in this browser's
                storage. Nothing here listens to your microphone, reads your clipboard, or sells
                a single byte — coins are cosmetic-only and never cash out.
              </p>
            </div>

            <p className="font-body text-[10px] text-ink-dim">
              Cosmetics can't buy luck: no odds, no XP for money, PG-13 always.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

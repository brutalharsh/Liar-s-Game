"use client";

import Link from "next/link";
import { SectionTitle } from "@/components/ui/Panel";
import { Switch } from "@/components/ui/Switch";
import { PriceChip } from "@/components/ui/CoinBadge";
import { useSettingsStore } from "@/store/settings";
import { THEMES } from "@/lib/mock/themes";
import { useSettingsData } from "../settings-data";
import { OwnedBadge, SettingsSkeleton } from "../bits";

/**
 * APPEARANCE — the comfort + drape controls: the reduced-motion override
 * (carried from the W1 settings) and the room-cosmetic theme packs rendered
 * as swatch cards using the CURRENT pack values (live token swatches from
 * the theme registry). Theme packs dress whole tables; owning one makes it
 * pickable when you host a room from the create screen. Pure client controls
 * here work in every session state; the pack grid waits only for the
 * entitlements join (owned vs shop chips).
 */
export function AppearanceSection() {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const data = useSettingsData();

  return (
    <div className="flex flex-col gap-8">
      {/* reduced motion */}
      <section aria-label="Reduced motion">
        <SectionTitle kicker="comfort">Motion & comfort</SectionTitle>
        <div className="flex min-h-16 items-center justify-between gap-4 rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
          <div className="min-w-0">
            <p className="font-display text-base text-ivory">Reduced motion</p>
            <p className="font-body text-xs text-ink-dim">
              Screen shake becomes a vignette flash, cards crossfade, confetti becomes candlelight.
              Overrides the system preference when on.
            </p>
          </div>
          <Switch
            id="reduced-motion"
            checked={reducedMotion}
            onChange={setReducedMotion}
            label="Reduced motion"
          />
        </div>
      </section>

      {/* theme packs */}
      <section aria-label="Theme packs">
        <SectionTitle kicker="table dressing">Theme packs</SectionTitle>
        {data.phase === "loading" ? (
          <SettingsSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {THEMES.map((theme) => {
                const owned = theme.free || data.themeOwned(theme.id);
                return (
                  <div
                    key={theme.id}
                    className={`flex min-h-28 flex-col items-start gap-1 rounded-card border-2 p-3 text-left ${
                      owned ? "border-wood-mid/70 bg-wood/60" : "border-wood-mid/50 bg-wood-deep/60"
                    }`}
                    aria-label={`${theme.name}${owned ? " — owned" : ` — ${theme.price} coins in the shop`}`}
                  >
                    <span className="font-display text-base text-ivory">{theme.name}</span>
                    <span className="flex min-h-6 items-center">
                      {theme.free ? (
                        <PriceChip price={0} />
                      ) : owned ? (
                        <OwnedBadge />
                      ) : (
                        <PriceChip price={theme.price} />
                      )}
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 h-8 w-full rounded-btn border border-wood-mid"
                      style={{
                        background: `linear-gradient(135deg, ${theme.swatch.felt}, ${theme.swatch.wood})`,
                      }}
                    />
                    <span
                      aria-hidden
                      className="h-2 w-2/3 rounded-btn"
                      style={{ background: theme.swatch.accent }}
                    />
                    <p className="font-body text-[10px] leading-tight text-ink-dim">{theme.desc}</p>
                    {!owned && (
                      <Link
                        href="/shop"
                        className="mt-auto inline-flex min-h-8 items-center font-body text-[10px] text-brass underline hover:text-lamp"
                      >
                        claim it in the shop
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 font-body text-[11px] text-ink-dim">
              Packs decorate the felt for everyone at the table — a host picks theirs when opening a
              room. Swatches above show each pack's live tokens.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

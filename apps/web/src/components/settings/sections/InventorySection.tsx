"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/Panel";
import { EmptySeatIcon, MedalIcon } from "@/components/ui/icons";
import { PriceChip } from "@/components/ui/CoinBadge";
import { AvatarThumb } from "@/components/avatar";
import { useToasts } from "@/store/ui";
import { useAuthStore } from "@/store/auth-store";
import { apiErrorMessage } from "@/lib/api";
import { THEMES } from "@/lib/mock/themes";
import type { SlotName } from "../settings-data";
import { useSettingsData } from "../settings-data";
import { ItemCard, OnYouBadge, OwnedBadge, SectionGate, ShopCta } from "../bits";

/**
 * INVENTORY — everything the account owns, grouped the way the wardrobe is
 * wired: body · hair · beard · hat · shirt · glasses · frames · themes ·
 * titles. Every card is data-driven (GET /api/me/entitlements joined with
 * GET /api/catalog); tapping an owned piece equips it immediately (optimistic
 * + rollback in the provider). Frames/themes/titles are display racks this
 * wave — the equip contract only covers the five wear slots + base — and
 * empty racks explain themselves and hand you to the shop.
 */

const WEAR_GROUPS: readonly { slot: SlotName; label: string; kicker: string }[] = [
  { slot: "hat", label: "Hats", kicker: "hat rack" },
  { slot: "hair", label: "Hair", kicker: "barber shelf" },
  { slot: "beard", label: "Beards", kicker: "whisker drawer" },
  { slot: "shirt", label: "Shirts", kicker: "wardrobe" },
  { slot: "glasses", label: "Glasses", kicker: "optician" },
];

export function InventorySection() {
  const data = useSettingsData();
  const push = useToasts();
  const logout = useAuthStore((s) => s.logout);
  const activeTitle = data.profile?.title ?? null;
  const equippedFrame = data.equippedIn("frame");

  const equipOwned = async (slot: "base" | SlotName, itemId: string, name: string) => {
    const res = await data.equip(slot, itemId);
    if (res.ok) {
      push({ title: `${name} on`, sub: "The whole table sees it.", tone: "good" });
    } else {
      push({ title: apiErrorMessage(res.error, "The fitting room stuck."), tone: "bad" });
    }
  };

  const frames = data.catalog.filter((item) => item.category === "frame" && data.owns(item._id));

  return (
    <SectionGate data={data} signOut={() => void logout()}>
      <div className="flex flex-col gap-8">
        {/* body */}
        <section aria-label="Body">
          <SectionTitle kicker="free to every player">Body</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.baseRows
              .filter((row) => row.owned)
              .map((row) => (
                <ItemCard
                  key={row.base}
                  slot="base"
                  id={row.base}
                  name={row.name}
                  equipped={row.equipped}
                  owned
                  price={row.free ? 0 : row.price}
                  badge={row.free ? <PriceChip price={0} /> : undefined}
                  busy={data.busy}
                  onPick={() => void equipOwned("base", row.base, row.name)}
                />
              ))}
          </div>
          <p className="mt-2 font-body text-[11px] text-ink-dim">
            The two thin builds are free forever — species and gym bodies live behind the counter
            in the shop.
          </p>
        </section>

        {/* wearables */}
        {WEAR_GROUPS.map(({ slot, label, kicker }) => {
          const all = data.slotItems(slot);
          const ownedItems = all.filter((item) => data.owns(item._id));
          const unowned = all.length - ownedItems.length;
          const equippedId = data.equippedIn(slot);
          return (
            <section key={slot} aria-label={label}>
              <SectionTitle kicker={kicker}>{label}</SectionTitle>
              {ownedItems.length === 0 ? (
                <EmptyRack what={label} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ownedItems.map((item) => (
                    <ItemCard
                      key={item._id}
                      slot={slot}
                      id={item._id}
                      name={item.name}
                      equipped={equippedId === item._id}
                      owned
                      busy={data.busy}
                      onPick={() => void equipOwned(slot, item._id, item.name)}
                    />
                  ))}
                  {unowned > 0 && <ShopCta label={`${unowned} MORE IN THE SHOP`} />}
                </div>
              )}
            </section>
          );
        })}

        {/* frames — display rack (no equip slot on the wire this wave) */}
        <section aria-label="Frames">
          <SectionTitle kicker="portrait frames">Frames</SectionTitle>
          {frames.length === 0 ? (
            <EmptyRack what="Frames" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {frames.map((item) => (
                <div
                  key={item._id}
                  className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-card border-2 border-wood-mid/70 bg-wood/60 p-1.5 text-center"
                  aria-label={`${item.name}${equippedFrame === item._id ? " — equipped" : " — owned"}`}
                >
                  <AvatarThumb slot="frame" id={item._id} size={56} />
                  <span className="line-clamp-2 w-full font-body text-[10px] leading-tight text-ivory">
                    {item.name}
                  </span>
                  <span className="flex min-h-5 items-center justify-center">
                    {equippedFrame === item._id ? <OnYouBadge /> : <OwnedBadge />}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 font-body text-[11px] text-ink-dim">
            Frames ride the portrait but the equip wire has no frame slot this wave — they follow
            your look everywhere already.
          </p>
        </section>

        {/* themes — room cosmetics, host-picked at the create screen */}
        <section aria-label="Themes">
          <SectionTitle kicker="room cosmetics">Themes</SectionTitle>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {THEMES.map((theme) => {
              const owned = theme.free || data.themeOwned(theme.id);
              return (
                <div
                  key={theme.id}
                  className="flex min-h-24 flex-col items-start gap-1 rounded-card border-2 border-wood-mid/70 bg-wood/60 p-3 text-left"
                  aria-label={`${theme.name}${owned ? " — owned" : ` — ${theme.price} coins in the shop`}`}
                >
                  <span className="font-display text-base text-ivory">{theme.name}</span>
                  <span>{theme.free ? <PriceChip price={0} /> : owned ? <OwnedBadge /> : <PriceChip price={theme.price} />}</span>
                  <span
                    aria-hidden
                    className="mt-1 h-6 w-full rounded-btn border border-wood-mid"
                    style={{ background: `linear-gradient(135deg, ${theme.swatch.felt}, ${theme.swatch.wood})` }}
                  />
                  <p className="font-body text-[10px] leading-tight text-ink-dim">{theme.desc}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 font-body text-[11px] text-ink-dim">
            Themes dress whole tables, not people — hosts pick one when opening a room.
          </p>
        </section>

        {/* titles — earned at the tables, display rack */}
        <section aria-label="Titles">
          <SectionTitle kicker="earned, never bought">Titles</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.ownedTitles().map((title) => (
              <span
                key={title.key}
                className={`inline-flex min-h-12 items-center gap-2 rounded-btn border-2 px-3 font-display text-sm ${
                  activeTitle === title.key
                    ? "border-brass bg-brass/10 text-brass"
                    : "border-wood-mid/70 bg-wood-deep/60 text-ink-dim"
                }`}
                aria-label={`${title.name}${activeTitle === title.key ? " — equipped" : " — owned"}`}
              >
                <span aria-hidden className="text-lamp">
                  <MedalIcon size={14} />
                </span>
                {title.name}
                {activeTitle === title.key && <OnYouBadge />}
              </span>
            ))}
          </div>
          <p className="mt-2 font-body text-[11px] text-ink-dim">
            {data.ownedTitles().length === 0
              ? "No titles yet — win tables, catch liars, survive pulls. "
              : "Equipped titles ride the wire in a later wave. "}
            <Link href="/leaderboard" className="text-brass underline hover:text-lamp">
              see who holds what
            </Link>
          </p>
        </section>
      </div>
    </SectionGate>
  );
}

function EmptyRack({ what }: { what: string }): ReactNode {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-card border-2 border-dashed border-ink-dim/40 bg-wood/50 px-6 py-6 text-center"
    >
      <EmptySeatIcon size={28} />
      <p className="font-display text-lg text-ivory">Nothing on the {what.toLowerCase()} rack</p>
      <p className="font-body text-xs text-ink-dim">
        Not owned — browse the shop; everything there stays cosmetic, never lucky.
      </p>
      <ShopCta label="BROWSE THE SHOP" />
    </div>
  );
}

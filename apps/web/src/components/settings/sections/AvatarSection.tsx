"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { PriceChip } from "@/components/ui/CoinBadge";
import { Avatar, AvatarThumb } from "@/components/avatar";
import { LockIcon } from "@/components/ui/icons";
import { useToasts } from "@/store/ui";
import { useAuthStore } from "@/store/auth-store";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { apiErrorMessage, type PublicCatalogItem } from "@/lib/api";
import type { AvatarSpec } from "@/lib/wire";
import type { SlotName } from "../settings-data";
import { useSettingsData } from "../settings-data";
import { ItemCard, SectionGate, ShopCta } from "../bits";

/**
 * ============================================================================
 * AVATAR SECTION — the try-on studio (owner: "when tap on hat and all, avatar
 * really wears that clothes — same to same")
 * ============================================================================
 * Every catalog piece in this section is INSTANTLY wearable, owned or not:
 * a tap merges it onto the big paper-doll preview (the try-on is free), the
 * explicit WEAR IT action then POSTs /api/me/equip — optimistic mirror +
 * rollback; 403 EQUIPMENT_NOT_OWNED turns the bar into a friendly "not yours
 * yet" with a shop cross-link, and ITEM_SLOT_MISMATCH shakes the bar.
 * ============================================================================
 */

const SLOTS: readonly { slot: SlotName; label: string }[] = [
  { slot: "hat", label: "Hats" },
  { slot: "hair", label: "Hair" },
  { slot: "beard", label: "Beard" },
  { slot: "shirt", label: "Shirts" },
  { slot: "glasses", label: "Glasses" },
];

type WearPreview = { kind: "wear"; slot: SlotName; itemId: string; name: string; owned: boolean };
type BasePreview = { kind: "base"; base: string; name: string; owned: boolean };
type Preview = WearPreview | BasePreview;

function wearPatch(p: WearPreview): Partial<AvatarSpec> {
  switch (p.slot) {
    case "hair":
      return { hair: p.itemId };
    case "beard":
      return { beard: p.itemId };
    case "hat":
      return { hat: p.itemId };
    case "shirt":
      return { shirt: p.itemId };
    case "glasses":
      return { glasses: p.itemId };
  }
}

export function AvatarSection() {
  const data = useSettingsData();
  const push = useToasts();
  const logout = useAuthStore((s) => s.logout);
  const reduced = usePrefersReducedMotion();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const barRef = useRef<HTMLDivElement | null>(null);

  // ITEM_SLOT_MISMATCH (and any rejected wear) shakes the confirm bar once —
  // WAAPI on the wrapper so re-renders never replay the motion, and never at
  // all under reduced motion.
  useEffect(() => {
    if (!failure || reduced || !barRef.current) return;
    barRef.current.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 300, easing: "ease-out" },
    );
  }, [shakeKey, failure, reduced]);

  const dataSpec = data.displaySpec;
  const shownSpec: AvatarSpec | null =
    preview?.kind === "base"
      ? { ...(dataSpec ?? { base: "human-male-thin" }), base: preview.base }
      : dataSpec;
  const shownPreviewPatch: Partial<AvatarSpec> | undefined =
    preview?.kind === "wear" ? wearPatch(preview) : undefined;

  const startPreview = (next: Preview) => {
    setFailure(null);
    setPreview(next);
  };

  const clearPreview = () => {
    setPreview(null);
    setFailure(null);
  };

  const commit = async () => {
    if (!preview) return;
    const res =
      preview.kind === "base"
        ? await data.equip("base", preview.base)
        : await data.equip(preview.slot, preview.itemId);
    if (res.ok) {
      push({ title: `${preview.name} on`, sub: "The whole table sees it.", tone: "good" });
      clearPreview();
      return;
    }
    const code = res.error.error;
    setFailure({ code, message: res.error.message });
    setShakeKey((k) => k + 1);
    if (code === "EQUIPMENT_NOT_OWNED") {
      push({ title: "Not yours yet", sub: `${preview.name} — claim it in the shop first.`, tone: "bad" });
    } else if (code === "ITEM_SLOT_MISMATCH") {
      push({ title: "That piece doesn't fit", tone: "bad" });
    } else {
      push({ title: apiErrorMessage(res.error, "The fitting room stuck."), tone: "bad" });
    }
  };

  const unequip = async (slot: SlotName, label: string) => {
    setFailure(null);
    const res = await data.equip(slot, null);
    if (res.ok) {
      if (preview?.kind === "wear" && preview.slot === slot) setPreview(null);
      push({ title: `${label} off`, tone: "info" });
    } else {
      push({ title: apiErrorMessage(res.error, "The fitting room stuck."), tone: "bad" });
    }
  };

  return (
    <SectionGate data={data} signOut={() => void logout()}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[18rem_1fr] lg:items-start lg:gap-8">
        {/* live preview */}
        <Panel tone="deep" className="flex flex-col items-center gap-4 p-5 lg:sticky lg:top-24">
          <div className="relative flex h-52 w-52 items-center justify-center overflow-hidden rounded-card border-2 border-brass-deep bg-felt-deep">
            <Avatar spec={shownSpec} size={200} preview={shownPreviewPatch} />
            {preview?.kind === "base" && (
              <span className="absolute bottom-1 left-2 right-2 truncate rounded-btn bg-wood-deep/85 px-2 py-0.5 text-center font-body text-[10px] tracking-wide text-lamp">
                body try-on — {preview.name}
              </span>
            )}
          </div>
          <p className="font-body text-[11px] text-ink-dim">
            Tap anything on the right — the doll wears it instantly. Only WEAR IT talks to the
            house.
          </p>

          <AnimatePresence>
            {(preview || failure) && (
              <motion.div
                ref={barRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                aria-live="polite"
                className="w-full rounded-btn border-2 border-lamp/60 bg-wood/70 p-3"
              >
                <p className="font-display text-sm text-ivory">
                  {failure ? "The house refused." : `Trying on: ${preview?.name ?? ""}`}
                </p>
                {failure?.code === "EQUIPMENT_NOT_OWNED" ? (
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <p className="font-body text-xs text-ink-dim">
                      Not yours yet — {preview?.name ?? "that piece"} is still behind the counter.
                    </p>
                    <ShopCta label={`SHOP FOR ${(preview?.name ?? "IT").toUpperCase()}`} />
                  </div>
                ) : failure?.code === "ITEM_SLOT_MISMATCH" ? (
                  <p className="mt-2 font-body text-xs text-ink-dim">
                    That piece doesn't fit this slot — tap it in its own row.
                  </p>
                ) : failure ? (
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <p className="font-body text-xs text-ink-dim">{failure.message}</p>
                    <button
                      type="button"
                      className="font-body text-xs text-brass underline hover:text-lamp"
                      onClick={() => void data.retry()}
                    >
                      try the rack again
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant={preview?.owned ? "brass" : "outline"}
                      size="sm"
                      disabled={data.busy}
                      onClick={() => void commit()}
                    >
                      {preview?.kind === "base" ? "TAKE THIS BODY" : "WEAR IT"}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={data.busy} onClick={clearPreview}>
                      NOT TODAY
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {/* pickers */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* base */}
          <section>
            <SectionTitle kicker="the body">Base</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {data.baseRows.map((row) => (
                <ItemCard
                  key={row.base}
                  slot="base"
                  id={row.base}
                  name={row.name}
                  equipped={row.equipped}
                  owned={row.owned}
                  price={row.free ? 0 : row.price}
                  badge={row.free && !row.equipped ? <PriceChip price={0} /> : undefined}
                  locked={!row.owned}
                  previewing={preview?.kind === "base" && preview.base === row.base}
                  busy={data.busy}
                  onPick={() =>
                    startPreview({ kind: "base", base: row.base, name: row.name, owned: row.owned })
                  }
                />
              ))}
            </div>
            <p className="mt-2 font-body text-[11px] text-ink-dim">
              Both thin builds are free to every player — gyms and species cost coins in the shop.
            </p>
          </section>

          {/* wearable slots */}
          {SLOTS.map(({ slot, label }) => {
            const items = data.slotItems(slot);
            const equippedId = data.equippedIn(slot);
            const equippedName = equippedId ? data.itemName(equippedId) : null;
            const hasUnowned = items.some((item) => !data.owns(item._id));
            return (
              <section key={slot} aria-label={label}>
                <SectionTitle kicker={equippedName ? `wearing: ${equippedName}` : "nothing worn yet"}>
                  {label}
                </SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-card border-2 border-dashed border-wood-mid/60 p-1.5 text-center">
                    <AvatarThumb slot={slot} id={equippedId ?? "none"} size={56} className="opacity-60" />
                    <span className="font-body text-[10px] leading-tight text-ink-dim">
                      {equippedName ?? "bare"}
                    </span>
                    <span className="flex min-h-12 items-center">
                      <button
                        type="button"
                        onClick={() => void unequip(slot, label)}
                        disabled={!equippedId || data.busy}
                        className="flex min-h-12 w-full items-center justify-center rounded-btn border-2 border-ink-dim/50 px-1 font-body text-[10px] tracking-wide text-ink-dim hover:border-brass hover:text-brass disabled:pointer-events-none disabled:opacity-40"
                      >
                        REMOVE
                      </button>
                    </span>
                  </div>
                  {items.map((item) => (
                    <WearableCard
                      key={item._id}
                      item={item}
                      slot={slot}
                      busy={data.busy}
                      previewing={preview?.kind === "wear" && preview.slot === slot && preview.itemId === item._id}
                      equipped={equippedId === item._id}
                      owned={data.owns(item._id)}
                      onPick={() =>
                        startPreview({
                          kind: "wear",
                          slot,
                          itemId: item._id,
                          name: item.name,
                          owned: data.owns(item._id),
                        })
                      }
                    />
                  ))}
                  {hasUnowned && (
                    <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-wood-mid/50 p-1.5 text-center">
                      <span className="text-ink-dim" aria-hidden>
                        <LockIcon size={18} />
                      </span>
                      <Link
                        href="/shop"
                        className="flex min-h-12 items-center font-body text-[10px] leading-tight text-brass underline hover:text-lamp"
                      >
                        more in the shop
                      </Link>
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {/* frame note */}
          <p className="font-body text-[11px] text-ink-dim">
            Portrait frames ride on your look but aren't swappable here — the equip
            contract grows a frame slot in a later wave.
          </p>
        </div>
      </div>
    </SectionGate>
  );
}

function WearableCard({
  item,
  slot,
  equipped,
  owned,
  previewing,
  busy,
  onPick,
}: {
  item: PublicCatalogItem;
  slot: SlotName;
  equipped: boolean;
  owned: boolean;
  previewing: boolean;
  busy: boolean;
  onPick(): void;
}) {
  return (
    <ItemCard
      slot={slot}
      id={item._id}
      name={item.name}
      equipped={equipped}
      owned={owned}
      price={item.price}
      locked={!owned}
      previewing={previewing}
      busy={busy}
      onPick={onPick}
    />
  );
}


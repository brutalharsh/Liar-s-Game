"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AvatarThumb, type PartSlot } from "@/components/avatar";
import { BannedIcon, LockIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { PriceChip } from "@/components/ui/CoinBadge";
import type { SettingsData } from "./settings-data";

/**
 * Small shared pieces for the settings sections — one phase gate, item cards,
 * lock/owned badges, the not-yours shop CTA and the banned (86'd) notice.
 * Everything targets ≥48px, rides the noir tokens and never invents a hex.
 */

/** Standard settings skeleton stack (loading state). */
export function SettingsSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading your settings">
      <div className="h-48 animate-pulse rounded-card bg-wood-mid/60" aria-hidden />
      <div className="h-24 animate-pulse rounded-card bg-wood-mid/60" aria-hidden />
      <div className="h-24 animate-pulse rounded-card bg-wood-mid/60" aria-hidden />
    </div>
  );
}

/**
 * The per-section shared treatment: loading skeleton, banned notice (the
 * "86'd" pattern), error card with retry, then the live section. A failed
 * read with AUTH_REQUIRED falls through to the skeleton — the AuthGate is
 * simultaneously taking the page over.
 */
export function SectionGate({
  data,
  signOut,
  children,
}: {
  data: SettingsData;
  signOut(): void;
  children: ReactNode;
}): ReactNode {
  if (data.banned) return <BannedNotice onSignOut={signOut} />;
  if (data.phase === "error" && (!data.apiError || data.apiError.error !== "AUTH_REQUIRED")) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-card border-2 border-blood/70 bg-wood/70 px-6 py-8 text-center"
      >
        <h3 className="font-display text-2xl text-ivory">The back office stuck</h3>
        <p className="font-body text-sm text-ink-dim">
          {data.error?.message ?? "Couldn't load this section. The dealer is checking the deck."}
        </p>
        <Button variant="outline" onClick={data.retry}>
          Try again
        </Button>
      </div>
    );
  }
  if (data.phase !== "ready") return <SettingsSkeleton />;
  return <>{children}</>;
}

/** The 86'd pattern (the profile page's ban state, settings flavour). */
export function BannedNotice({ onSignOut }: { onSignOut: () => void }): ReactNode {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-card border-2 border-blood/70 bg-wood/70 px-6 py-8 text-center"
    >
      <span className="text-blood-bright" aria-hidden>
        <BannedIcon size={44} />
      </span>
      <h2 className="font-display text-2xl text-ivory">The house 86'd you</h2>
      <p className="font-body text-sm text-ink-dim">
        This account is barred from the tables — the wardrobe stays locked with it. Coins, XP and
        titles stay on your ledger; the door stays locked until the house says otherwise.
      </p>
      <Button variant="outline" onClick={onSignOut}>
        SIGN OUT
      </Button>
    </div>
  );
}

/** Equipped badge ("on you"). */
export function OnYouBadge(): ReactNode {
  return (
    <span className="rounded-full border-2 border-brass-deep bg-brass/15 px-1.5 py-0.5 font-body text-[9px] uppercase tracking-widest text-red-text">
      On you
    </span>
  );
}

/** Owned badge. */
export function OwnedBadge(): ReactNode {
  return (
    <span className="rounded-full border-2 border-verdict/70 bg-verdict/10 px-1.5 py-0.5 font-body text-[9px] uppercase tracking-widest text-verdict">
      Yours
    </span>
  );
}

/** Locked badge + price, for pieces you can try on but not yet wear. */
export function LockedTag({ price }: { price: number | null }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-dim" aria-hidden>
        <LockIcon size={12} />
      </span>
      {price !== null && price > 0 ? <PriceChip price={price} /> : null}
    </span>
  );
}

/** Cross-link tile used when a rack has unclaimed stock. */
export function ShopCta({ label }: { label?: string }): ReactNode {
  return (
    <Link
      href="/shop"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-btn border-2 border-dashed border-brass-deep/60 bg-brass/5 px-4 font-display text-xs tracking-wide text-red-text hover:border-brass hover:bg-brass/10"
    >
      {label ?? "CLAIM IT IN THE SHOP"}
    </Link>
  );
}

/**
 * ItemCard — one catalog piece as a tap target. `onPick` fires on tap/click;
 * the parent decides whether that means preview (avatar section) or equip
 * (inventory). Locked cards stay tappable: the try-on is free, the wearing
 * isn't. Equipped cards disable (you're already wearing them).
 */
export function ItemCard({
  slot,
  id,
  name,
  equipped,
  owned,
  price,
  previewing,
  busy,
  locked,
  badge,
  onPick,
}: {
  slot: PartSlot | "base";
  id: string;
  name: string;
  equipped?: boolean;
  owned?: boolean;
  price?: number | null;
  previewing?: boolean;
  busy?: boolean;
  locked?: boolean;
  badge?: ReactNode;
  onPick?(): void;
}): ReactNode {
  const state = equipped
    ? "border-brass bg-brass/10"
    : previewing
      ? "border-lamp bg-lamp/10"
      : locked
        ? "border-wood-mid/50 bg-wood-deep/60 hover:border-lamp"
        : "border-wood-mid/70 bg-wood/60 hover:border-brass";
  const note = equipped ? " — equipped" : owned ? " — yours" : locked ? ` — not owned, ${price ?? "?"} coins in the shop` : "";
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy || equipped}
      aria-pressed={previewing ?? false}
      aria-label={`${name}${note}`}
      className={`flex w-24 shrink-0 flex-col items-center gap-1 rounded-card border-2 p-1.5 text-center transition-colors disabled:cursor-default ${state}`}
    >
      <AvatarThumb slot={slot} id={id} size={56} />
      <span className="line-clamp-2 w-full font-body text-[10px] leading-tight text-ivory">{name}</span>
      <span className="flex min-h-5 items-center justify-center">
        {badge ?? (equipped ? <OnYouBadge /> : owned ? <OwnedBadge /> : <LockedTag price={price ?? null} />)}
      </span>
    </button>
  );
}

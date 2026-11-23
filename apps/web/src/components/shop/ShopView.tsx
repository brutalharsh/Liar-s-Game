"use client";

import { useMemo, useState } from "react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { CoinBadge, PriceChip } from "@/components/ui/CoinBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs } from "@/components/ui/Tabs";
import { useEconomyStore } from "@/store/economy";
import { useIdentityStore } from "@/store/identity";
import { useToasts } from "@/store/ui";
import { useMockQuery } from "@/hooks/useMockQuery";
import {
  SHOP_CATEGORIES,
  SHOP_ITEMS,
  FEATURED_ITEMS,
  COIN_PACKS,
  type ShopCategory,
  type ShopItem,
} from "@/lib/mock/catalog";
import { checkoutPack, getCatalogPage, type CatalogPage, type CoinPackRecord } from "@/lib/api";
import { formatInr, formatCoins } from "@/lib/format";
import { CoinIcon, HourglassIcon, WrenchIcon } from "@/components/ui/icons";

function TryOnSheet({ item, open, onClose }: { item: ShopItem | null; open: boolean; onClose: () => void }) {
  const buy = useEconomyStore((s) => s.buy);
  const equip = useEconomyStore((s) => s.equip);
  const unequip = useEconomyStore((s) => s.unequip);
  const owned = useEconomyStore((s) => (item ? s.owned.includes(item.id) : false));
  const equipped = useEconomyStore((s) => (item ? s.equipped[item.category] === item.id : false));
  const coins = useEconomyStore((s) => s.coins);
  const avatar = useIdentityStore((s) => s.avatar);
  const push = useToasts();

  if (!item) return null;

  const previewAvatar =
    item.category === "hat"
      ? { ...avatar, hat: item.id }
      : item.category === "glasses"
        ? { ...avatar, glasses: item.id }
        : item.category === "frame"
          ? { ...avatar, frame: item.id }
          : avatar;

  return (
    <Sheet open={open} onClose={onClose} title={`Try on — ${item.name}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-6 rounded-card border-2 border-wood-mid bg-felt-deep/40 px-10 py-6">
          <Avatar spec={avatar} size="xl" />
          <span className="text-3xl text-lamp" aria-hidden>
            →
          </span>
          <Avatar spec={previewAvatar} size="xl" />
        </div>
        <p className="text-center font-body text-sm text-ink-dim">{item.desc}</p>
        <div className="flex items-center gap-2">
          <PriceChip price={item.price} />
          {item.levelReq && (
            <span className="rounded-full bg-wood-deep px-2 py-0.5 font-body text-[10px] text-lamp">
              LEVEL {item.levelReq} — EARNED ONLY
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-dim">
            wallet: {formatCoins(coins)} <CoinIcon size={13} />
          </span>
        </div>
        <div className="flex w-full gap-3">
          {equipped ? (
            <Button variant="outline" className="flex-1" onClick={() => { unequip(item.category); push({ title: `${item.name} removed`, tone: "info" }); }}>
              UNEQUIP
            </Button>
          ) : owned || item.price === 0 ? (
            <Button variant="brass" className="flex-1" disabled={!!item.levelReq} onClick={() => { equip(item.category, item.id); push({ title: `${item.name} equipped`, tone: "good" }); }}>
              {owned ? "EQUIP" : "CLAIM FREE"}
            </Button>
          ) : (
            <Button
              variant="brass"
              className="flex-1"
              onClick={() => {
                if (buy(item.id, item.price)) push({ title: `${item.name} yours`, tone: "good" });
              }}
            >
              <span className="inline-flex items-center gap-1">
                BUY — <CoinIcon size={16} /> {item.price}
              </span>
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function ShopView() {
  const [category, setCategory] = useState<ShopCategory>("hat");
  const [tryOn, setTryOn] = useState<ShopItem | null>(null);
  const [payPack, setPayPack] = useState<string | null>(null);
  const [payResult, setPayResult] = useState<{ title: string; body: string; note: boolean } | null>(null);
  const owned = useEconomyStore((s) => s.owned);
  const equipped = useEconomyStore((s) => s.equipped);
  const coins = useEconomyStore((s) => s.coins);

  // Server-side pricing (STR/04 §3: server-validated prices): items + packs
  // now come from GET /api/catalog via the api client; on empty/error the
  // shop falls back to W1's fixture catalog so browsing never dies.
  const catalogQuery = useMockQuery<CatalogPage>(() => getCatalogPage(), []);
  const priceMap = useMemo(
    () => new Map((catalogQuery.data?.items ?? []).map((item) => [item._id, item])),
    [catalogQuery.data],
  );
  const packs = useMemo<CoinPackRecord[]>(() => {
    const fromApi = catalogQuery.data?.packs ?? [];
    if (fromApi.length > 0) return fromApi;
    return COIN_PACKS.map((p, i) => ({
      _id: p.id.replace(/^pack-/, ""),
      name: p.name,
      priceMajor: p.priceInr,
      coins: p.coins,
      bonus: p.bonus,
      active: true,
      sortOrder: i,
    }));
  }, [catalogQuery.data]);

  const items = SHOP_ITEMS.filter((item) => {
    if (item.category !== category) return false;
    const serverItem = priceMap.get(item.id);
    return !serverItem || serverItem.active !== false;
  });

  const buyPack = async (packId: string) => {
    setPayPack(packId);
    try {
      const outcome = await checkoutPack(packId); // POST /api/billing/checkout {packId}
      setPayPack(null);
      if (outcome.checkoutUrl) {
        window.location.assign(outcome.checkoutUrl); // same-tab → hosted pay page
        return;
      }
      setPayResult({
        title: "Payments aren't live yet",
        body: "The checkout provider hasn't been switched on — nothing was charged, nothing is owed. The moment it's live, this same button hops you to the hosted pay page and back, with your coins landing on return.",
        note: true,
      });
    } catch {
      setPayPack(null);
      setPayResult({
        title: "The checkout desk hit a snag",
        body: "Couldn't reach the till — nothing was charged. Give it a breath and try again; retries are always safe.",
        note: false,
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">The general store</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Cosmetics only. Coins can't buy luck, odds, XP — or a way out.
        </p>
        <div className="mt-3 flex justify-center">
          <CoinBadge amount={coins} size="lg" />
        </div>
      </section>

      {/* featured carousel */}
      <section>
        <SectionTitle kicker="featured">Tonight's window dressing</SectionTitle>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {FEATURED_ITEMS.map((item) => (
            <Panel
              key={item.id}
              className="min-w-72 max-w-72 shrink-0 snap-center p-4 md:min-w-80 md:max-w-80"
            >
              <div
                className="flex h-36 items-center justify-center rounded-card border border-wood-mid text-6xl"
                style={{
                  background:
                    "radial-gradient(80% 100% at 50% 0%, color-mix(in srgb, var(--color-lamp) 10%, transparent), transparent)",
                }}
                aria-hidden
              >
                {item.overlay}
              </div>
              <p className="mt-3 font-display text-xl text-ivory">{item.name}</p>
              <p className="font-body text-xs text-ink-dim">{item.desc}</p>
              <div className="mt-3 flex items-center justify-between">
                <PriceChip price={item.price} />
                <Button variant="outline" size="sm" onClick={() => setTryOn(item)}>
                  TRY ON
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* category tabs */}
      <Tabs
        tabs={SHOP_CATEGORIES.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))}
        active={category}
        onChange={setCategory}
        className="justify-center"
      />

      {/* item grid — prices + names from GET /api/catalog (fallback: W1 fixtures) */}
      <section>
        <h2 className="sr-only">
          {SHOP_CATEGORIES.find((c) => c.id === category)?.label ?? "Catalog"} rack
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const isOwned = owned.includes(item.id);
            const isEquipped = equipped[item.category] === item.id;
            const lockedByLevel = !!item.levelReq && !isOwned;
            const serverItem = priceMap.get(item.id);
            const price = serverItem?.price ?? item.price;
            const name = serverItem?.name ?? item.name;
            return (
              <Panel key={item.id} className={`flex flex-col gap-2 p-3 ${isEquipped ? "border-brass" : ""}`}>
                <div className="flex h-20 items-center justify-center rounded-btn bg-wood-deep text-4xl" aria-hidden>
                  {item.overlay}
                </div>
                <p className="truncate font-display text-base text-ivory" title={name}>
                  {name}
                </p>
                <div className="flex items-center justify-between gap-1">
                  <PriceChip price={lockedByLevel ? 0 : price} />
                  {isEquipped && <span className="font-body text-[10px] text-red-text">ON YOU</span>}
                </div>
                <Button
                  variant={isOwned ? "outline" : "brass"}
                  size="sm"
                  onClick={() => setTryOn(item)}
                  className="text-xs"
                >
                  {lockedByLevel ? "LEVEL LOCK" : isOwned ? "STYLED" : price === 0 ? "FREE" : "TRY ON"}
                </Button>
              </Panel>
            );
          })}
        </div>
      </section>

      {/* coin packs — prices from the server-side coin_packs table (via GET /api/catalog) */}
      <section>
        <SectionTitle kicker="top up">Coin packs</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {packs.map((pack) => {
            const badge = pack._id === "popular" ? "MOST POPULAR" : pack._id === "whale" ? "BEST VALUE" : undefined;
            return (
              <Panel key={pack._id} className="relative flex flex-col items-center gap-1 p-4 text-center">
                {badge && (
                  <span className="absolute -top-3 rounded-full border-2 border-brass-deep bg-brass px-2 py-0.5 font-body text-[9px] tracking-widest text-wood-deep">
                    {badge}
                  </span>
                )}
                <p className="font-body text-[11px] uppercase tracking-[0.25em] text-ink-dim">
                  {pack.name}
                </p>
                <p className="font-display text-2xl text-brass">
                  {formatCoins(pack.coins + pack.bonus)}
                  <span className="ml-1 font-body text-[11px] uppercase tracking-widest text-ink-dim">
                    coins
                  </span>
                </p>
                <p className="font-display text-lg text-ivory">{formatInr(pack.priceMajor)}</p>
                {pack.bonus > 0 && (
                  <p className="font-body text-[10px] text-verdict">+{formatCoins(pack.bonus)} bonus coins</p>
                )}
                <Button
                  variant="brass"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={payPack !== null}
                  onClick={() => void buyPack(pack._id)}
                >
                  {payPack === pack._id ? "CHECKING…" : "BUY"}
                </Button>
              </Panel>
            );
          })}
        </div>
        <Sheet
          open={payResult !== null}
          onClose={() => setPayResult(null)}
          title={payResult?.title ?? ""}
        >
          {payResult && (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex items-center gap-1 text-brass" aria-hidden>
                <CoinIcon size={36} />
                {payResult.note ? <HourglassIcon size={36} /> : <WrenchIcon size={36} />}
              </span>
              <p className="font-body text-sm text-ivory">{payResult.body}</p>
              {payResult.note && (
                <p className="font-body text-[11px] text-ink-dim">
                  The buy button already calls <code className="text-red-text">POST /api/billing/checkout</code>{" "}
                  with <code className="text-red-text">{`{packId}`}</code> — the moment the checkout provider
                  is activated, you'll hop to the hosted pay page and back to{" "}
                  <code className="text-red-text">/billing/return</code> with zero screen changes.
                </p>
              )}
              <Button variant="brass" onClick={() => setPayResult(null)}>
                UNDERSTOOD
              </Button>
            </div>
          )}
        </Sheet>
        <p className="mt-3 text-center font-body text-[11px] text-ink-dim">
          Coins are cosmetic-only and non-redeemable. No loot boxes, no odds, no XP for money —
          ever.
        </p>
      </section>

      <TryOnSheet item={tryOn} open={tryOn !== null} onClose={() => setTryOn(null)} />
      <p className="text-center font-body text-[11px] text-ink-dim">
        Curious what's equipped where? Your profile rack keeps score. Purchases are final —
        support can adjust the ledger if the house breaks something.
      </p>
      <p className="text-center">
        <a
          href="/profile"
          className="inline-flex min-h-12 items-center rounded-btn border-2 border-ink-dim/70 px-4 font-body text-[11px] tracking-wide text-red-text hover:border-brass hover:brightness-110"
        >
          CHECK YOUR PROFILE RACK
        </a>
      </p>
    </div>
  );
}

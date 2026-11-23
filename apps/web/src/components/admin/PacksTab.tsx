"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { adminListPacks, adminPatchPack, apiErrorMessage, type CoinPackRecord } from "@/lib/api";
import { Field } from "@/components/admin/bits";
import { formatCoins, formatInr } from "@/lib/format";
import { useToasts } from "@/store/ui";

/**
 * PACKS tab — the four coin packs (STR/04 §1), editable: name / priceMajor /
 * coins / bonus / active → PATCH /api/admin/packs/:key. Prices here are the
 * checkout authority (they're read server-side from coin_packs at checkout);
 * the amountMinor display is a sanity aid against paise mistakes.
 */
export function PacksTab() {
  const push = useToasts();
  const query = useMockQuery<CoinPackRecord[]>(() => adminListPacks(), []);

  return (
    <AsyncSection
      query={query}
      skeleton={
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      }
      isEmpty={(packs) => packs.length === 0}
      empty={<p className="py-8 text-center font-body text-sm text-ink-dim">No packs configured.</p>}
    >
      {(packs) => (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {packs.map((pack) => (
            <PackCard key={pack._id} pack={pack} push={push} />
          ))}
        </div>
      )}
    </AsyncSection>
  );
}

type Push = ReturnType<typeof useToasts>;

function PackCard({ pack, push }: { pack: CoinPackRecord; push: Push }) {
  const [draft, setDraft] = useState({
    name: pack.name,
    priceMajor: String(pack.priceMajor),
    coins: String(pack.coins),
    bonus: String(pack.bonus),
    active: pack.active,
  });
  const [busy, setBusy] = useState(false);

  const dirty =
    draft.name !== pack.name ||
    draft.priceMajor !== String(pack.priceMajor) ||
    draft.coins !== String(pack.coins) ||
    draft.bonus !== String(pack.bonus) ||
    draft.active !== pack.active;

  const amountMinor = Number.parseInt(draft.priceMajor, 10) * 100;

  const save = async () => {
    const name = draft.name.trim();
    const priceMajor = Number.parseInt(draft.priceMajor, 10);
    const coins = Number.parseInt(draft.coins, 10);
    const bonus = Number.parseInt(draft.bonus, 10);
    if (name === "" || [priceMajor, coins, bonus].some((n) => Number.isNaN(n) || n < 0)) {
      push({ title: "Whole numbers only — price, coins, bonus", tone: "bad" });
      return;
    }
    setBusy(true);
    const before = pack; // rollback anchor = server truth
    try {
      const saved = await adminPatchPack(pack._id, { name, priceMajor, coins, bonus, active: draft.active });
      push({
        title: `${saved.name} saved`,
        sub: `checkout will charge ${formatInr(saved.priceMajor)} (${saved.priceMajor * 100} paise)`,
        tone: "good",
      });
      void before;
    } catch (err) {
      setDraft({
        name: before.name,
        priceMajor: String(before.priceMajor),
        coins: String(before.coins),
        bonus: String(before.bonus),
        active: before.active,
      });
      push({ title: "Pack edit rolled back", sub: apiErrorMessage(err, "The till rejected it."), tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-wood-mid/50 bg-wood/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">pack key: {pack._id}</p>
        <Switch id={`pack-active-${pack._id}`} label={`${pack.name} active`} checked={draft.active} onChange={(active) => setDraft((d) => ({ ...d, active }))} />
      </div>

      <Field id={`pack-name-${pack._id}`} label="Name" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} />
      <Field
        id={`pack-price-${pack._id}`}
        label="Price (₹, MAJOR units)"
        type="number"
        value={draft.priceMajor}
        onChange={(priceMajor) => setDraft((d) => ({ ...d, priceMajor }))}
        hint={`charged as ${Number.isNaN(amountMinor) ? "—" : `₹${(amountMinor / 100).toFixed(2)} (${formatCoins(amountMinor)} paise)`}`}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field id={`pack-coins-${pack._id}`} label="Coins" type="number" value={draft.coins} onChange={(coins) => setDraft((d) => ({ ...d, coins }))} />
        <Field id={`pack-bonus-${pack._id}`} label="Bonus" type="number" value={draft.bonus} onChange={(bonus) => setDraft((d) => ({ ...d, bonus }))} />
      </div>

      <p className="font-body text-[10px] text-ink-dim">
        Buyer receives <span className="text-brass">{formatCoins((Number.parseInt(draft.coins, 10) || 0) + (Number.parseInt(draft.bonus, 10) || 0))}</span> coins
      </p>

      <Button variant="brass" size="sm" disabled={!dirty || busy} onClick={() => void save()}>
        {busy ? "SAVING…" : dirty ? "SAVE PACK" : "UNTOUCHED"}
      </Button>
    </div>
  );
}

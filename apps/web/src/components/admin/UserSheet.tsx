"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AsyncSection, ErrorState, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import {
  adminAdjustCoins,
  adminSetBan,
  getAdminUserDetail,
  type AdminUser,
  apiErrorMessage,
} from "@/lib/api";
import { specChips, toDisplaySpec } from "@/components/auth/viewer";
import { Badge, ConfirmSheet, Field, formatStamp, formatMinor, statusTone } from "@/components/admin/bits";
import { formatCoins } from "@/lib/format";
import { useToasts } from "@/store/ui";

/**
 * USER drawer — profile drill-down (STR/02): avatar spec chips, title,
 * XP/level bar, derived coin balance, ledger (last 50), payment history,
 * match count + the two mutations: coin adjust (reason, confirm) and
 * ban/unban (reason, confirm). Optimistic-UI with rollback + toast.
 */
export function UserSheet({
  userId,
  onClose,
  onUserUpdated,
}: {
  userId: string;
  onClose: () => void;
  onUserUpdated: (user: AdminUser) => void;
}) {
  const push = useToasts();
  const query = useMockQuery(() => getAdminUserDetail(userId), [userId]);
  const [localUser, setLocalUser] = useState<AdminUser | null>(null);
  const [mode, setMode] = useState<"idle" | "coins" | "banConfirm">("idle");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const user = localUser ?? query.data?.user ?? null;

  const runMutation = async (apply: () => Promise<AdminUser>, optimistic: AdminUser, success: string) => {
    setBusy(true);
    setLocalUser(optimistic); // optimistic-UI…
    try {
      const serverUser = await apply();
      setLocalUser(serverUser);
      onUserUpdated(serverUser);
      push({ title: success, tone: "good" });
      void query.reload(); // re-sync the ledger / derived balance
    } catch (err) {
      setLocalUser(null); // …rolled back to server truth on failure
      push({ title: "Mutation rolled back", sub: apiErrorMessage(err, "The house rejected it."), tone: "bad" });
    } finally {
      setBusy(false);
      setMode("idle");
      setDelta("");
      setReason("");
    }
  };

  const submitCoins = () => {
    const parsed = Number.parseInt(delta, 10);
    if (!user || Number.isNaN(parsed) || parsed === 0) {
      push({ title: "Enter a non-zero whole number of coins", tone: "bad" });
      return;
    }
    if (reason.trim() === "") {
      push({ title: "A reason goes in the ledger too", tone: "bad" });
      return;
    }
    void runMutation(
      () => adminAdjustCoins(user._id, parsed, reason.trim()),
      { ...user, coinBalance: user.coinBalance + parsed },
      `${parsed > 0 ? "+" : ""}${parsed} coins — ledger updated`,
    );
  };

  const submitBan = (banned: boolean) => {
    if (!user) return;
    if (reason.trim() === "") {
      push({ title: "Bans need a written reason", tone: "bad" });
      return;
    }
    void runMutation(
      () => adminSetBan(user._id, banned, reason.trim()),
      { ...user, banned, banReason: banned ? reason.trim() : undefined },
      banned ? "Player banned" : "Player unbanned",
    );
  };

  return (
    <>
      {/* main drawer — the confirm overlays render as siblings, NOT children,
          so the parent dialog's animation transform can't cage their fixed position */}
      <Sheet open onClose={onClose} title={user ? `Player — ${user.nickname}` : "Player"}>
        <AsyncSection
          query={query}
          skeleton={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          }
          isEmpty={() => !user}
          empty={<ErrorState onRetry={query.reload} sub="This player walked out of the ledger." />}
        >
          {(detail) => {
            const shown = user ?? detail.user;
          return (
            <div className="flex flex-col gap-5">
              {/* headline */}
              <div className="flex items-center gap-4">
                <Avatar spec={toDisplaySpec(shown.avatarSpec)} size="xl" />
                <div className="min-w-0">
                  <p className="font-display text-2xl text-ivory">
                    {shown.nickname} {shown.banned ? <Badge tone="bad">BANNED</Badge> : null}
                  </p>
                  <p className="font-body text-xs text-ink-dim">
                    {shown.name} · {shown.provider === "discord" ? "💬 discord" : "🔎 google"}
                  </p>
                  <p className="font-body text-xs text-lamp">“{shown.activeTitle ?? "no title"}”</p>
                </div>
              </div>

              {/* stat grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-btn border border-wood-mid/60 bg-wood/50 px-3 py-2">
                  <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">Coins</p>
                  <p className="font-display text-lg text-brass">🪙 {formatCoins(shown.coinBalance)}</p>
                  <p className="font-body text-[9px] text-ink-dim">derived from wallet ledger</p>
                </div>
                <div className="rounded-btn border border-wood-mid/60 bg-wood/50 px-3 py-2">
                  <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">Matches</p>
                  <p className="font-display text-lg text-ivory">{formatCoins(shown.matchCount)}</p>
                  <p className="font-body text-[9px] text-ink-dim">completed tables</p>
                </div>
                <div className="col-span-2 rounded-btn border border-wood-mid/60 bg-wood/50 px-3 py-2">
                  <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">
                    Level {shown.level} · XP
                  </p>
                  <ProgressBar value={shown.xp} max={shown.nextLevelXp} label={`${formatCoins(shown.xp)} / ${formatCoins(shown.nextLevelXp)} xp`} />
                </div>
              </div>

              {/* avatar spec chips */}
              <div>
                <p className="mb-1 font-body text-[10px] uppercase tracking-widest text-ink-dim">Avatar spec</p>
                <div className="flex flex-wrap gap-1.5">
                  {specChips(shown.avatarSpec).map((chip) => (
                    <Badge key={chip.slot} tone="brass">
                      {chip.slot}: {chip.value}
                    </Badge>
                  ))}
                  {shown.banReason ? <Badge tone="bad" className="max-w-full truncate">ban: {shown.banReason}</Badge> : null}
                </div>
              </div>

              {/* ledger (append-only; last 50) */}
              <div>
                <p className="mb-1 font-body text-[10px] uppercase tracking-widest text-ink-dim">
                  Wallet ledger · newest first
                </p>
                <div className="max-h-56 overflow-y-auto rounded-btn border border-wood-mid/50 bg-wood-deep/70">
                  {detail.ledger.length === 0 ? (
                    <p className="p-3 font-body text-xs text-ink-dim">No ledger movements yet.</p>
                  ) : (
                    <ul className="divide-y divide-wood-mid/40">
                      {detail.ledger.map((entry) => (
                        <li key={entry._id} className="flex items-center gap-2 px-3 py-2">
                          <span className={`font-body text-sm ${entry.delta >= 0 ? "text-verdict" : "text-blood-bright"}`}>
                            {entry.delta >= 0 ? "+" : ""}{formatCoins(entry.delta)}
                          </span>
                          <Badge>{entry.reason}</Badge>
                          <span className="min-w-0 flex-1 truncate font-body text-[10px] text-ink-dim">
                            {entry.refId}
                          </span>
                          <span className="font-body text-[10px] text-ink-dim">{formatStamp(entry.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* payment history */}
              <div>
                <p className="mb-1 font-body text-[10px] uppercase tracking-widest text-ink-dim">Payment history</p>
                {detail.payments.length === 0 ? (
                  <p className="font-body text-xs text-ink-dim">No coin packs bought.</p>
                ) : (
                  <ul className="divide-y divide-wood-mid/40 rounded-btn border border-wood-mid/50 bg-wood-deep/70">
                    {detail.payments.map((checkout) => (
                      <li key={checkout._id} className="flex items-center gap-2 px-3 py-2">
                        <span className="font-body text-sm text-ivory">{checkout.productName}</span>
                        <span className="font-display text-sm text-brass">{formatMinor(checkout.amountMinor)}</span>
                        <Badge tone={statusTone(checkout.status)}>{checkout.status}</Badge>
                        <span className="ml-auto font-body text-[10px] text-ink-dim">
                          {checkout.paidAt ? formatStamp(checkout.paidAt) : formatStamp(checkout.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* actions */}
              <div className="flex flex-wrap gap-2 border-t-2 border-wood-mid/50 pt-3">
                <Button
                  variant="brass"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setDelta("");
                    setMode("coins");
                  }}
                >
                  ADJUST COINS
                </Button>
                {!shown.banned ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setReason("");
                      setMode("banConfirm");
                    }}
                  >
                    BAN PLAYER
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setReason(shown.banReason ?? "");
                      setMode("banConfirm");
                    }}
                  >
                    LIFT BAN
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
                  CLOSE
                </Button>
              </div>
            </div>
          );
        }}
      </AsyncSection>
      </Sheet>

      {/* coin adjust — its own confirm step */}
      <Sheet open={mode === "coins"} onClose={() => setMode("idle")} title="Adjust coin balance">
        <div className="flex flex-col gap-4">
          <p className="font-body text-xs text-ink-dim">
            A compensating ledger entry is written with your reason — balances are derived, never
            edited. Current: <span className="text-brass">🪙 {formatCoins(user?.coinBalance ?? 0)}</span>
          </p>
          <Field
            id="coin-delta"
            label="Delta (may be negative)"
            type="number"
            value={delta}
            onChange={setDelta}
            placeholder="e.g. 250 or -100"
          />
          <Field
            id="coin-reason"
            label="Reason (required)"
            value={reason}
            onChange={setReason}
            placeholder="e.g. tournament prize make-good"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setMode("idle")}>
              CANCEL
            </Button>
            <Button variant="brass" className="flex-1" disabled={busy} onClick={submitCoins}>
              {busy ? "WRITING…" : "CONFIRM ADJUSTMENT"}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ban / unban confirm */}
      <ConfirmSheet
        open={mode === "banConfirm"}
        onClose={() => setMode("idle")}
        title={user?.banned ? "Lift the ban?" : "Ban this player?"}
        confirmLabel={user?.banned ? "CONFIRM UNBAN" : "CONFIRM BAN"}
        busy={busy}
        onConfirm={() => submitBan(!user?.banned)}
      >
        <p className="font-body text-xs text-ink-dim">
          {user?.banned
            ? "They can pull up a chair again immediately."
            : "They are refused at every door until the ban lifts. One written reason, immutable in the audit."}
        </p>
        <Field
          id="ban-reason"
          label="Reason (required)"
          value={reason}
          onChange={setReason}
          placeholder={user?.banned ? "e.g. appeal accepted" : "e.g. repeated table tampering"}
        />
      </ConfirmSheet>
    </>
  );
}

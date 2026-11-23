"use client";

import { useEffect, useState } from "react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Avatar as UiAvatar } from "@/components/ui/Avatar";
import { LogoutIcon, MedalIcon } from "@/components/ui/icons";
import { useToasts } from "@/store/ui";
import { useAuthStore } from "@/store/auth-store";
import { apiErrorMessage } from "@/lib/api";
import { sanitizeDisplayName } from "@/lib/wire";
import { memberSince, titleLabel } from "@/components/profile/display";
import { useSettingsData } from "../settings-data";
import { SectionGate } from "../bits";

/**
 * ACCOUNT — the front desk: nickname editor (PUT /api/me/profile, live 1..18
 * validation with the shared sanitizer's verdict shown politely), the avatar
 * summary chip (member since · level · title) and the sign-out door. Banned
 * accounts get the existing "86'd" treatment instead of the editor.
 */

const MAX_NICKNAME = 18;

export function AccountSection() {
  const data = useSettingsData();
  const push = useToasts();
  const logout = useAuthStore((s) => s.logout);
  const profile = data.profile;

  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nickname = profile?.user.nickname ?? "";

  useEffect(() => {
    if (profile && !pending) {
      setDraft((current) => (current === "" ? profile.user.nickname : current));
    }
  }, [profile, pending]);

  // Live validation (1..18 code points); the shared sanitizer previews the
  // verdict so a "clean" save never surprises after submit.
  const codePoints = [...draft].length;
  const clean = sanitizeDisplayName(draft);
  const tooLong = codePoints > MAX_NICKNAME;
  const barred = draft.length > 0 && codePoints <= MAX_NICKNAME && clean === "";
  const invalid = tooLong || barred;
  const changed = clean !== nickname && !invalid && clean !== "";

  const save = async () => {
    if (invalid || !changed) return;
    setPending(true);
    setNotice(null);
    const res = await data.saveNickname(draft);
    if (res.ok) {
      setDraft(res.nickname);
      push({ title: `You're ${res.nickname} now`, sub: "The ledger took the change.", tone: "good" });
    } else {
      // 422 NICKNAME_REJECTED — the house's verdict, politely.
      if (res.error.error === "NICKNAME_REJECTED") {
        setNotice("The house won't print that name — it's barred by the filter. Try another.");
      } else if (res.error.error === "BAD_REQUEST") {
        setNotice("Nicknames run 1 to 18 characters — trim it and try again.");
      } else {
        setNotice(apiErrorMessage(res.error, "The front desk didn't answer."));
      }
      push({ title: "Name not changed", tone: "bad" });
    }
    setPending(false);
  };

  const signOut = () => {
    void logout();
    push({ title: "Signed out", sub: "The bar remembers your tab.", tone: "info" });
  };

  return (
    <SectionGate data={data} signOut={signOut}>
      <div className="flex flex-col gap-8">
        {/* identity summary */}
        <section aria-label="Your account">
          <SectionTitle kicker="the front desk">Account</SectionTitle>
          <Panel className="flex flex-col items-start gap-4 p-4 md:flex-row md:items-center">
            <UiAvatar spec={data.displaySpec} size="xl" />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl text-ivory">{nickname}</p>
              <p className="font-body text-xs text-lamp">
                {titleLabel(profile?.title ?? null) ?? "no title equipped"}
              </p>
              <p className="mt-1 font-body text-[11px] text-ink-dim">
                Sitting here since {memberSince(profile?.user.createdAt ?? "")} · last seen{" "}
                {profile?.user.lastSeenAt ? formatAgo(profile.user.lastSeenAt) : "—"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border-2 border-brass-deep px-2 py-0.5 font-display text-sm text-red-text">
                  LVL {profile?.level ?? 1}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-brass-deep px-2 py-0.5 font-display text-sm text-red-text">
                  <span aria-hidden className="text-lamp">
                    <MedalIcon size={14} />
                  </span>
                  {profile?.unlockedTitleCount ?? 0} titles
                </span>
              </div>
            </div>
          </Panel>
        </section>

        {/* nickname editor */}
        <section aria-label="Nickname">
          <SectionTitle kicker="said at the table">Nickname</SectionTitle>
          <div className="max-w-lg rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
            <label htmlFor="nickname-input" className="block">
              <span className="mb-1 block font-body text-[10px] uppercase tracking-widest text-ink-dim">
                What the table calls you
              </span>
              <input
                id="nickname-input"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setNotice(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
                placeholder="1-18 characters"
                aria-describedby="nickname-hint"
                aria-invalid={invalid}
                className="min-h-12 w-full rounded-btn border-2 border-wood-mid bg-wood-deep px-3 font-display text-base text-ivory focus:border-brass"
              />
            </label>
            <p id="nickname-hint" className="mt-1 font-body text-[11px] text-ink-dim" aria-live="polite">
              {codePoints}/{MAX_NICKNAME} characters
              {draft.length > 0 && clean !== draft && !invalid ? ` · reads as “${clean}”` : ""}
            </p>
            {tooLong && (
              <p className="mt-1 font-body text-xs text-red-text" role="alert">
                That's past 18 characters — the house ledger stops at 18.
              </p>
            )}
            {barred && (
              <p className="mt-1 font-body text-xs text-red-text" role="alert">
                The house won't print that name — the filter bar it. Try another.
              </p>
            )}
            {notice && (
              <p className="mt-1 font-body text-xs text-red-text" role="alert">
                {notice}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="brass" size="sm" disabled={pending || invalid || !changed} onClick={() => void save()}>
                {pending ? "FILING…" : "SAVE NAME"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || draft === nickname}
                onClick={() => {
                  setDraft(nickname);
                  setNotice(null);
                }}
              >
                REVERT
              </Button>
            </div>
            <p className="mt-2 font-body text-[10px] text-ink-dim">
              Save freely — the house rate-limits writes (30 a minute) to keep the ledger honest.
              Trims spaces, drops invisible characters, folds lookalike letters — the server has the
              final word.
            </p>
          </div>
        </section>

        {/* sign out */}
        <section aria-label="Session">
          <SectionTitle kicker="your seat">Session</SectionTitle>
          <div className="flex min-h-16 items-center justify-between gap-4 rounded-card border-2 border-wood-mid/70 bg-wood/70 p-4">
            <div className="min-w-0">
              <p className="font-display text-base text-ivory">Sign out</p>
              <p className="font-body text-xs text-ink-dim">
                Leave the seat — your coins, wardrobe and settings stay exactly where you left
                them.
              </p>
            </div>
            <Button variant="outline" onClick={signOut}>
              <span aria-hidden className="inline-flex items-center gap-2">
                <LogoutIcon size={18} /> SIGN OUT
              </span>
            </Button>
          </div>
        </section>
      </div>
    </SectionGate>
  );
}

/** "3 min ago" / "5h ago" — client-relative for the last-seen line. */
function formatAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}


"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { CoinBadge } from "@/components/ui/CoinBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { AsyncSection, EmptyState, Skeleton } from "@/components/ui/AsyncSection";
import { toDisplaySpec } from "@/components/auth/viewer";
import { useMockQuery } from "@/hooks/useMockQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getProfile, isApiError, type ProfileMatchRecord, type ProfileMatchStats, type ProfileResponse } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useCountUp } from "@/motion/useCountUp";
import { formatCoins, titleCase } from "@/lib/format";
import { THEMES } from "@/lib/mock/themes";
import { formatWhen, memberSince, titleLabel } from "./display";
import {
  BannedIcon,
  BluffIcon,
  CandleIcon,
  CheckIcon,
  CloseIcon,
  CoinIcon,
  EmptySeatIcon,
  KillsIcon,
  MedalIcon,
  MissIcon,
  PullsIcon,
  RevealIcon,
  SettingsIcon,
  ShopIcon,
  SparkleIcon,
  TargetIcon,
  ThemeIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/ui/icons";

/**
 * Own profile (GET /api/me — E1). Identity + level bar + wallet + the last 10
 * match records, all server-owned numbers rendered read-only — this view never
 * writes XP, coins or titles (clients are dumb terminals, STR/06 §3).
 *
 * Error branches per the contract: 401 AUTH_REQUIRED → re-probe the session so
 * the existing auth gate takes over (sign-in wall); 403 BANNED → friendly
 * banned state; 404 USER_NOT_FOUND → reset suggestion.
 */
export function ProfileView() {
  const query = useMockQuery<ProfileResponse>(() => getProfile(), []);
  const reduced = usePrefersReducedMotion();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  const apiErr = isApiError(query.error) ? query.error : null;
  const signedOut = apiErr?.error === "AUTH_REQUIRED";
  const banned = apiErr?.error === "BANNED";
  const missing = apiErr?.error === "USER_NOT_FOUND";

  // Session died between the gate's probe and this fetch → hand the route back
  // to the gate (it flips to guest and renders the sign-in wall itself).
  useEffect(() => {
    if (signedOut) void fetchMe(true);
  }, [signedOut, fetchMe]);

  const ready = !query.loading && !query.error && !!query.data;
  const coinsTarget = query.data?.coins ?? 0;
  const coinsShown = useCountUp(coinsTarget, ready, 900, reduced);

  if (banned) {
    return <BannedState onSignOut={() => void logout()} />;
  }

  if (missing) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <h1 className="sr-only">Your rack</h1>
        <EmptyState
          icon={<EmptySeatIcon size={28} />}
          title="Your seat vanished"
          sub="The ledger holds your coins but couldn't find the account. Signing out and back in usually resets the door."
          action={
            <Button variant="outline" onClick={() => void logout()}>
              SIGN OUT
            </Button>
          }
        />
      </div>
    );
  }

  if (signedOut) {
    // momentary handoff — the gate swaps this for the sign-in wall
    return (
      <div className="flex flex-col gap-4 py-8" role="status" aria-label="Checking your seat">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Your rack</h1>
      </section>

      <AsyncSection
        query={query}
        errorTitle="The ledger wouldn't open"
        skeleton={
          <div className="flex flex-col gap-4" aria-hidden>
            <Skeleton className="h-44" />
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        }
        isEmpty={(p) => !p}
        empty={
          <EmptyState
            icon={<CandleIcon size={28} />}
            title="Nothing at this seat"
            sub="The account read came back empty. Try again in a beat."
          />
        }
      >
        {(profile) => {
          const progress = profile.levelProgress;
          return (
            <>
              {/* identity + wallet */}
              <Panel className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar spec={toDisplaySpec(profile.user.avatarSpec)} size="xl" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-3xl text-ivory">{profile.user.nickname}</p>
                      {profile.user.role !== "user" && (
                        <span className="rounded-full border-2 border-lamp px-2 py-0.5 font-display text-[10px] tracking-widest text-lamp">
                          HOUSE
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-lamp">
                      {titleLabel(profile.title) ?? "no title equipped"}
                    </p>
                    <p className="mt-1 font-body text-[11px] text-ink-dim">
                      Sitting here since {memberSince(profile.user.createdAt)} · last seen{" "}
                      {formatWhen(profile.user.lastSeenAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LevelBadge level={profile.level} />
                      <span
                        className="inline-flex items-center gap-1 rounded-full border-2 border-brass-deep px-2 py-0.5 font-display text-sm text-red-text"
                        title="titles unlocked server-side"
                      >
                        <MedalIcon size={14} /> {profile.unlockedTitleCount} titles
                      </span>
                      <CoinBadge amount={coinsShown} size="lg" />
                    </div>
                  </div>
                </div>
                <div className="w-full md:max-w-sm">
                  {progress.atMax ? (
                    <>
                      <ProgressBar value={1} max={1} label="MAX LEVEL" />
                      <p className="mt-2 font-body text-[11px] text-red-text">
                        The ceiling. {formatCoins(progress.xp)} XP banked — there is no level 101.
                      </p>
                    </>
                  ) : (
                    <>
                      <ProgressBar
                        value={progress.xpIntoLevel}
                        max={progress.xpForLevel ?? 1}
                        label={`LVL ${progress.level} → ${progress.level + 1}`}
                      />
                      <p className="mt-2 font-body text-[11px] text-ink-dim">
                        {formatCoins(progress.xpIntoLevel)} / {formatCoins(progress.xpForLevel ?? 0)} XP ·{" "}
                        {formatCoins(progress.xpToNextLevel ?? 0)} to next · win 12 · survive 6 · die 4 per
                        match
                      </p>
                    </>
                  )}
                </div>
              </Panel>

              {/* recent tables */}
              <section>
                <SectionTitle kicker={`${profile.recentMatchRecords.length} on the record`}>
                  Recent tables
                </SectionTitle>
                <ol className="flex flex-col gap-2">
                  {profile.recentMatchRecords.map((rec, i) => (
                    <MatchRow key={rec.matchId} rec={rec} index={i} />
                  ))}
                </ol>
                <p className="mt-2 font-body text-[11px] text-ink-dim">
                  Ten tables deep, your line only. Replays + full box scores land with a later wave
                  — rows stay quiet till then.
                </p>
              </section>

              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/shop"
                  className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-brass-soft px-5 font-display text-base tracking-wide text-wood-deep hover:brightness-110"
                >
                  <ShopIcon size={18} /> VISIT THE SHOP
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-btn border-2 border-ink-dim/70 bg-transparent px-5 font-display text-base tracking-wide text-ivory hover:border-brass hover:text-red-text"
                >
                  <TrophyIcon size={18} /> SEE THE RANKS
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-btn border-2 border-ink-dim/70 bg-transparent px-5 font-display text-base tracking-wide text-ivory hover:border-brass hover:text-red-text"
                >
                  <SettingsIcon size={18} /> SETTINGS
                </Link>
              </div>
            </>
          );
        }}
      </AsyncSection>
    </div>
  );
}

/** LVL chip — every 10th level rides a prestige frame (earned-only, STR/04 §5). */
function LevelBadge({ level }: { level: number }) {
  const prestige = level >= 10 && level % 10 === 0;
  return (
    <span
      className={`rounded-full border-2 px-2 py-0.5 font-display text-sm ${
        prestige ? "border-brass bg-brass/15 text-red-text" : "border-brass-deep text-red-text"
      }`}
    >
      LVL {level}
      {prestige ? " ✦" : ""}
    </span>
  );
}

/** One match_records line — result chip + room/theme/seat + your stat chips. */
function MatchRow({ rec, index }: { rec: ProfileMatchRecord; index: number }) {
  const stats: ProfileMatchStats = rec.you.stats;
  const themeName =
    THEMES.find((t) => t.id === rec.theme)?.name ?? titleCase(rec.theme || "saloon");
  const outcome = stats.won
    ? { icon: <TrophyIcon size={12} />, label: "WON", cls: "border-brass text-red-text" }
    : stats.deaths > 0
      ? { icon: <CloseIcon size={12} />, label: "DIED", cls: "border-blood-bright text-blood-bright" }
      : { icon: <CheckIcon size={12} />, label: "SURVIVED", cls: "border-verdict text-verdict" };
  const playedTitle = titleLabel(rec.you.titleAtPlay);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.24 }}
    >
      <Panel className="flex flex-col gap-2 p-3">
        <div className="flex min-h-12 items-center gap-2">
          <span className={`inline-flex items-center gap-1 shrink-0 rounded-btn border-2 px-2 py-0.5 font-display text-xs ${outcome.cls}`}>
            {outcome.icon} {outcome.label}
          </span>
          <span
            className="shrink-0 rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-display text-xs tracking-widest text-ivory"
            title={`room ${rec.roomCode}`}
          >
            {rec.roomCode}
          </span>
          <span className="ml-auto shrink-0 font-body text-[11px] text-ink-dim">
            {formatWhen(rec.endedAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-ink-dim">
          <span className="inline-flex items-center gap-1">
            <ThemeIcon size={12} className="text-lamp" /> {themeName}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon size={12} className="text-lamp" /> {rec.capacity}-seat · your seat {rec.you.seat}
          </span>
          <span className="inline-flex items-center gap-1">
            <TargetIcon size={12} className="text-lamp" /> {rec.summary.rounds} rounds ·{" "}
            {rec.summary.totalPulls} pulls
            {rec.summary.dareDevilMoments > 0
              ? ` · ${rec.summary.dareDevilMoments} daredevil`
              : ""}
          </span>
          {playedTitle && <span>“{playedTitle}” at play</span>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StatChip icon={<KillsIcon size={12} />} label={`${stats.kills} kills`} value={stats.kills} />
          <StatChip icon={<RevealIcon size={12} />} label={`${stats.catches} liars caught`} value={stats.catches} />
          <StatChip icon={<BluffIcon size={12} />} label={`${stats.bluffSuccesses} bluffs unchallenged`} value={stats.bluffSuccesses} />
          <StatChip icon={<PullsIcon size={12} />} label={`${stats.pullsSurvived} trigger pulls survived`} value={stats.pullsSurvived} />
          {stats.falseAccusations > 0 && (
            <StatChip icon={<MissIcon size={12} />} label={`${stats.falseAccusations} false calls`} value={stats.falseAccusations} tone="bad" />
          )}
          <StatChip icon={<SparkleIcon size={12} />} label={`${stats.xpEarned} XP earned`} value={stats.xpEarned} always />
          <StatChip icon={<CoinIcon size={12} />} label={`${stats.coinsEarned} coins earned`} value={stats.coinsEarned} always />
        </div>
      </Panel>
    </motion.li>
  );
}

/** Stat chip — icon + text (never color-only, STR/05 §7). Zero-value stats hide. */
function StatChip({
  icon,
  label,
  value,
  tone = "plain",
  always = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "plain" | "bad";
  always?: boolean;
}) {
  if (value === 0 && !always) return null;
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border-2 bg-wood-deep px-2 font-body text-[11px] ${
        tone === "bad" ? "border-blood-bright/70 text-blood-bright" : "border-wood-mid text-ink-dim"
      }`}
    >
      <span aria-hidden className="inline-flex items-center">{icon}</span> {label}
    </span>
  );
}

/** 403 BANNED — the friendly way out; no redemption claim, no table access. */
function BannedState({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Panel className="w-full p-8 text-center">
        <span className="inline-flex justify-center text-blood-bright" aria-hidden>
          <BannedIcon size={48} />
        </span>
        <h1 className="mt-4 font-display text-3xl text-ivory">The house 86'd you</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          This account is barred from the tables. Coins, XP and titles stay on your ledger —
          but the door stays locked until the house says otherwise.
        </p>
        <p className="mt-2 font-body text-xs text-ink-dim">
          If you think this is a mistake, reach the house through the project's support channel.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="outline" onClick={onSignOut}>
            SIGN OUT
          </Button>
          <Link href="/how-to-play" className="font-body text-xs text-ink-dim underline hover:text-red-text">
            or re-read the house rules
          </Link>
        </div>
      </Panel>
    </div>
  );
}

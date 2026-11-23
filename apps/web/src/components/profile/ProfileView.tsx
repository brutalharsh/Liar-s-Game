"use client";

import Link from "next/link";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { CoinBadge } from "@/components/ui/CoinBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { mockFetch } from "@/lib/mock/api";
import { MOCK_PROFILE, type MockProfile } from "@/lib/mock/profile";
import { TITLES } from "@/lib/mock/titles";
import { useEconomyStore } from "@/store/economy";
import { useIdentityStore } from "@/store/identity";
import { useToasts } from "@/store/ui";
import { formatCoins } from "@/lib/format";

/** KILLS is the headline stat (STR/02 v1 — "kills (headline)"). */
function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Panel className="flex min-h-24 flex-col items-center justify-center gap-1 p-4">
      <span className="font-display text-3xl text-brass">{value}</span>
      <span className="font-body text-[10px] uppercase tracking-widest text-ink-dim">{label}</span>
      {sub && <span className="font-body text-[9px] text-lamp">{sub}</span>}
    </Panel>
  );
}

export function ProfileView() {
  const coins = useEconomyStore((s) => s.coins);
  const equippedTitle = useEconomyStore((s) => s.equippedTitle);
  const setTitle = useEconomyStore((s) => s.setTitle);
  const nickname = useIdentityStore((s) => s.nickname);
  const avatar = useIdentityStore((s) => s.avatar);
  const push = useToasts();
  const query = useMockQuery<MockProfile>(() => mockFetch(MOCK_PROFILE, { minDelayMs: 300 }), []);

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Your rack</h1>
      </section>

      <AsyncSection
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        }
        isEmpty={(p) => p == null}
        empty={<span />}
      >
        {(profile) => (
          <>
            {/* identity + wallet */}
            <Panel className="flex flex-col items-center gap-6 p-6 md:flex-row md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar spec={avatar} size="xl" />
                <div>
                  <p className="font-display text-3xl text-ivory">{nickname || "YOU"}</p>
                  <p className="font-body text-xs text-lamp">
                    {equippedTitle
                      ? (TITLES.find((t) => t.id === equippedTitle)?.name ?? "Regular")
                      : "Regular"}
                  </p>
                  <p className="mt-1 font-body text-[11px] text-ink-dim">
                    Guest profile — claim an account (v1.x) to keep your stash across devices.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full border-2 border-brass-deep px-2 py-0.5 font-display text-sm text-brass">
                      LVL {profile.level}
                    </span>
                    <CoinBadge amount={coins} size="lg" />
                  </div>
                </div>
              </div>
              <div className="w-full max-w-sm">
                <ProgressBar
                  value={profile.xp}
                  max={profile.nextLevelXp}
                  label={`${formatCoins(profile.xp)} / ${formatCoins(profile.nextLevelXp)} XP → level ${profile.level + 1}`}
                />
                <p className="mt-2 font-body text-[10px] text-ink-dim">
                  XP per match: win 12 · survive 6 · die 4. Ten levels = a prestige frame (earned
                  only, never sold).
                </p>
              </div>
            </Panel>

            {/* headline kills */}
            <div className="text-center">
              <p className="font-body text-xs uppercase tracking-[0.3em] text-lamp">headline stat</p>
              <p className="font-display text-7xl text-brass md:text-8xl">{profile.kills}</p>
              <p className="font-display text-2xl text-ivory">KILLS</p>
              <p className="mt-1 font-body text-xs text-ink-dim">
                executions where the target didn't walk away
              </p>
            </div>

            {/* stat grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard label="catches" value={profile.catches} sub="liars exposed" />
              <StatCard label="wins" value={profile.wins} sub="last one standing" />
              <StatCard label="matches" value={profile.matches} sub="seats taken" />
              <StatCard label="deaths" value={profile.deaths} sub="candles lit" />
              <StatCard label="pulls survived" value={profile.pullsSurvived} sub="clicks heard" />
              <StatCard label="false calls" value={profile.falseAccusations} sub="oops" />
            </div>

            {/* titles wall */}
            <section>
              <SectionTitle kicker={`owned ${profile.unlockedTitles.length}/12`}>Titles wall</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TITLES.map((title) => {
                  const unlocked = profile.unlockedTitles.includes(title.id);
                  const equipped = equippedTitle === title.id;
                  return (
                    <div
                      key={title.id}
                      className={`flex min-h-20 flex-col gap-1 rounded-card border-2 p-3 ${
                        unlocked
                          ? equipped
                            ? "border-brass bg-brass/10"
                            : "border-wood-mid bg-wood/60"
                          : "border-wood-mid/40 bg-wood-deep/40 opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base text-ivory">
                          {unlocked ? title.name : "🔒 " + title.name}
                        </span>
                        {equipped && <span className="text-xs text-brass">EQUIPPED</span>}
                      </div>
                      <p className="font-body text-[10px] text-ink-dim">{title.unlock}</p>
                      <div className="mt-auto flex justify-end">
                        {unlocked && !equipped && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTitle(title.id);
                              push({ title: `Title equipped: ${title.name}`, tone: "good" });
                            }}
                            className="text-xs text-brass"
                          >
                            EQUIP
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 font-body text-[11px] text-ink-dim">
                Titles unlock server-side at match end — never mid-round, never purchasable.
              </p>
            </section>

            {/* match history strip */}
            <section>
              <SectionTitle kicker="recent">Last five tables</SectionTitle>
              <ol className="flex flex-col gap-2">
                {profile.matchHistory.map((match) => (
                  <li key={match.id}>
                    <Panel className="flex min-h-14 items-center gap-3 p-3">
                      <span
                        className={`rounded-btn border-2 px-2 py-0.5 font-display text-xs ${
                          match.result === "won"
                            ? "border-brass text-brass"
                            : match.result === "survived"
                              ? "border-verdict text-verdict"
                              : "border-blood-bright text-blood-bright"
                        }`}
                      >
                        {match.result === "won" ? "🏆 WON" : match.result === "survived" ? "✓ SURVIVED" : "✖ DIED"}
                      </span>
                      <span className="font-body text-xs text-ink-dim">
                        round {match.round} · vs {match.opponents.join(", ")}
                      </span>
                      <span className="ml-auto flex items-center gap-2 font-display text-sm">
                        <span title="kills" className="text-blood-bright">
                          🗡 {match.kills}
                        </span>
                        <span title="xp" className="text-lamp">
                          ✨ {match.xp}
                        </span>
                        <span title="coins" className="text-brass">
                          🪙 {match.coins}
                        </span>
                      </span>
                    </Panel>
                  </li>
                ))}
              </ol>
              <p className="mt-2 font-body text-[11px] text-ink-dim">
                Match history archive (last 20) lands with v1.x.
              </p>
            </section>

            <div className="flex justify-center gap-3">
              <Link href="/shop">
                <Button variant="brass">🛍 SPEND {formatCoins(coins)} COINS</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">⚙️ SETTINGS</Button>
              </Link>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}

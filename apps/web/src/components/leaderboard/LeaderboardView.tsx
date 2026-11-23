"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { useMockQuery } from "@/hooks/useMockQuery";
import { mockFetch } from "@/lib/mock/api";
import {
  makeLeaderboard,
  metricValue,
  METRIC_LABELS,
  type LeaderboardRow,
  type LeaderboardMetric,
} from "@/lib/mock/leaderboard";

const TAB_ITEMS = (Object.keys(METRIC_LABELS) as LeaderboardMetric[]).map((id) => ({
  id,
  label: METRIC_LABELS[id].label,
  emoji: METRIC_LABELS[id].emoji,
}));

/** Global all-time leaderboard: podium top-3 + ranked rows, tabs by metric. */
export function LeaderboardView() {
  const [metric, setMetric] = useState<LeaderboardMetric>("wins");
  const query = useMockQuery<LeaderboardRow[]>(() => mockFetch(makeLeaderboard()), []);

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Leaderboard</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">Global · all-time · no MMR, just scars.</p>
      </section>

      <Tabs tabs={TAB_ITEMS} active={metric} onChange={setMetric} className="justify-center" />

      <AsyncSection
        query={query}
        skeleton={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={<span />}
      >
        {(rows) => {
          const sorted = [...rows].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
          const [first, second, third] = sorted;
          const rest = sorted.slice(3);
          const podium = [
            { row: second, rank: 2 },
            { row: first, rank: 1 },
            { row: third, rank: 3 },
          ];

          return (
            <div className="flex flex-col gap-6">
              {/* podium */}
              <div className="grid grid-cols-3 items-end gap-2 md:mx-auto md:w-2/3">
                {podium.map(({ row, rank }) =>
                  row ? (
                    <div key={rank} className={`flex flex-col items-center gap-1 ${rank === 1 ? "md:-translate-y-4" : ""}`}>
                      <Avatar spec={{ animal: row.avatar }} size={rank === 1 ? "xl" : "lg"} />
                      <span className="font-display text-base text-ivory">{row.nickname}</span>
                      <span className="font-body text-[10px] text-lamp">{row.title}</span>
                      <span
                        className={`flex w-full items-center justify-center rounded-t-card border-2 border-brass-deep bg-wood py-2 font-display ${
                          rank === 1 ? "h-24 text-3xl text-brass" : rank === 2 ? "h-16 text-xl text-ivory" : "h-12 text-lg text-ink-dim"
                        }`}
                      >
                        {rank === 1 ? "🏆" : rank} · {metricValue(row, metric)}
                      </span>
                    </div>
                  ) : (
                    <div key={rank} />
                  ),
                )}
              </div>

              {/* rows */}
              <ol className="flex flex-col gap-2">
                {rest.map((row, i) => (
                  <li key={row.playerId}>
                    <Link href="/profile" className="block">
                      <Panel className="flex min-h-16 items-center gap-3 p-3 transition-colors hover:border-brass">
                        <span className="w-8 text-center font-display text-lg text-ink-dim">{i + 4}</span>
                        <Avatar spec={{ animal: row.avatar }} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-base text-ivory">{row.nickname}</span>
                          <span className="block truncate font-body text-[10px] text-lamp">{row.title}</span>
                        </span>
                        <span className="font-display text-lg text-brass">
                          {metricValue(row, metric)}
                          <span className="ml-1 font-body text-[10px] text-ink-dim">
                            {METRIC_LABELS[metric].label.toLowerCase()}
                          </span>
                        </span>
                      </Panel>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          );
        }}
      </AsyncSection>

      <SectionTitle kicker="the fine print">
        <span className="text-lg">Rows link to the profile view in this build</span>
      </SectionTitle>
      <p className="mx-auto max-w-md text-center font-body text-sm text-ink-dim">
        The real thing links to each player's public profile once accounts land (v1.x). Tap any
        row to preview what profiles look like.
      </p>
    </div>
  );
}

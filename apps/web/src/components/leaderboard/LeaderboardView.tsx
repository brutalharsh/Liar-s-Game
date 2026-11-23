"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Panel } from "@/components/ui/Panel";
import { AsyncSection, EmptyState, Skeleton } from "@/components/ui/AsyncSection";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toDisplaySpec } from "@/components/auth/viewer";
import { useMockQuery } from "@/hooks/useMockQuery";
import {
  getLeaderboard,
  LEADERBOARD_PER_PAGE_DEFAULT,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LeaderboardPage,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { formatCoins } from "@/lib/format";
import { titleLabel } from "@/components/profile/display";
import { MedalIcon, SparkleIcon, FlameIcon, TrophyIcon } from "@/components/ui/icons";

/** perPage is fixed client-side (URL keeps only metric + page — STR/07 §0). */
const PER_PAGE = LEADERBOARD_PER_PAGE_DEFAULT;

const METRICS: readonly string[] = ["wins", "kills", "xp", "titles"];

const METRIC_TABS: readonly TabItem<LeaderboardMetric>[] = [
  { id: "xp", label: "XP", icon: SparkleIcon },
  { id: "wins", label: "Wins", icon: TrophyIcon },
  { id: "kills", label: "Kills", icon: FlameIcon },
  { id: "titles", label: "Titles", icon: MedalIcon },
];

/** Rank 1–3 medal tints — token classes only (brass / ivory / lamp). */
const MEDALS: readonly string[] = ["text-brass", "text-ivory", "text-lamp"];

function parseMetric(raw: string | null): LeaderboardMetric {
  return METRICS.includes(raw ?? "") ? (raw as LeaderboardMetric) : "xp";
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Global all-time board: metric tabs, ranked rows (medal top-3), URL paging. */
export function LeaderboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const myId = useAuthStore((s) => s.user?.id) ?? null;

  const metric = parseMetric(searchParams.get("metric"));
  const page = parsePage(searchParams.get("page"));

  const query = useMockQuery<LeaderboardPage>(
    () => getLeaderboard({ metric, page, perPage: PER_PAGE }),
    [metric, page],
  );

  /** Tab/page changes ride the URL (shareable + back-button sane); existing
   *  params (?apimode=, ?mock=) survive the push. */
  const navigate = (nextMetric: LeaderboardMetric, nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", nextMetric);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6 py-8">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Leaderboard</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Global · all-time · no MMR, just scars. Board refreshes once a minute.
        </p>
      </section>

      <Tabs
        tabs={METRIC_TABS}
        active={metric}
        onChange={(m) => navigate(m, 1)}
        className="justify-center"
      />

      <AsyncSection
        query={query}
        errorTitle="The board went dark"
        skeleton={
          <div className="flex flex-col gap-2" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        }
        isEmpty={(data) => !data || data.leaderboard.length === 0}
        empty={
          <EmptyState
            icon={<TrophyIcon size={28} />}
            title={page > 1 ? `Nothing on page ${page}` : "The board's bare"}
            sub={
              page > 1
                ? "The ranks don't stretch this far for this metric."
                : "No names carved into the board yet. A single match fixes that."
            }
            action={
              page > 1 ? (
                <Button variant="outline" onClick={() => navigate(metric, 1)}>
                  BACK TO PAGE 1
                </Button>
              ) : (
                <a
                  href="/how-to-play"
                  className="flex min-h-12 items-center rounded-btn border-2 border-brass bg-brass px-5 font-display text-sm text-wood-deep"
                >
                  LEARN THE GAME
                </a>
              )
            }
          />
        }
      >
        {(data) => (
          <>
            <ol className="flex flex-col gap-2">
              {data.leaderboard.map((row, i) => (
                <LeaderboardRow
                  key={row.accountId}
                  row={row}
                  metric={data.metric}
                  me={row.accountId === myId}
                  index={i}
                />
              ))}
            </ol>

            <Pager
              page={data.page}
              perPage={data.perPage}
              total={data.total}
              metric={data.metric}
              onFlip={(next) => navigate(data.metric, next)}
            />
          </>
        )}
      </AsyncSection>
    </div>
  );
}

/** One ranked row — medal styling for ranks 1–3, plain number cell otherwise.
 * Highlights ride `ring` (box-shadow), not border classes: Panel's base
 * bg and border utilities win the cascade over same-property overrides we
 * append in className, so brass/lamp rings are the conflict-safe channel. */
function LeaderboardRow({
  row,
  metric,
  me,
  index,
}: {
  row: LeaderboardEntry;
  metric: LeaderboardMetric;
  me: boolean;
  index: number;
}) {
  const medalTint = row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.24 }}
    >
      <Panel
        className={`flex min-h-16 items-center gap-3 p-3 ${
          me ? "ring-2 ring-lamp" : medalTint ? "ring-2 ring-brass/70" : ""
        }`}
      >
        <span
          className={`flex w-10 shrink-0 flex-col items-center justify-center rounded-btn border-2 py-1 ${
            medalTint ? "border-brass bg-brass/10 text-red-text" : "border-wood-mid text-ink-dim"
          }`}
          aria-label={`rank ${row.rank}`}
        >
          {medalTint ? (
            <MedalIcon size={18} className={medalTint} />
          ) : (
            <span className="font-display text-lg leading-none">{row.rank}</span>
          )}
          {medalTint && <span className="font-display text-[10px] leading-tight">{row.rank}</span>}
        </span>

        <Avatar spec={toDisplaySpec(row.avatarSpec)} size="md" />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate font-display text-base ${me ? "text-lamp" : "text-ivory"}`}>
              {row.nickname}
            </span>
            {me && (
              <span className="shrink-0 rounded-full border-2 border-lamp px-1.5 font-display text-[9px] tracking-widest text-lamp">
                YOU
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2 font-body text-[10px]">
            <span className={row.activeTitle ? "text-lamp" : "text-ink-dim"}>
              {titleLabel(row.activeTitle) ?? "no title yet"}
            </span>
            <span className="rounded-full border-2 border-wood-mid px-1.5 text-[9px] text-ink-dim">
              LVL {row.level}
            </span>
          </span>
        </span>

        <span className="ml-auto flex shrink-0 flex-col items-end">
          <span className="font-display text-lg text-red-text">{formatCoins(row.value)}</span>
          <span className="font-body text-[9px] uppercase tracking-widest text-ink-dim">
            {metric}
          </span>
        </span>
      </Panel>
    </motion.li>
  );
}

/** Prev/next footer — total count, current page, ≥48px targets. */
function Pager({
  page,
  perPage,
  total,
  metric,
  onFlip,
}: {
  page: number;
  perPage: number;
  total: number;
  metric: LeaderboardMetric;
  onFlip: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Leaderboard pages">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onFlip(page - 1)}
        aria-label="Previous page"
      >
        ← PREV
      </Button>
      <p className="text-center font-body text-xs text-ink-dim">
        page {page} of {totalPages} · {formatCoins(total)} players on the {metric} board
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onFlip(page + 1)}
        aria-label="Next page"
      >
        NEXT →
      </Button>
    </nav>
  );
}

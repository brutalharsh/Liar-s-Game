"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { adminListUsers, type AdminUser, type AdminUsersPage } from "@/lib/api";
import { toDisplaySpec } from "@/components/auth/viewer";
import { Badge, CoinAmount, formatStamp, Pager } from "@/components/admin/bits";
import { UserSheet } from "@/components/admin/UserSheet";

const PAGE_SIZE = 8;

/**
 * USERS tab — paginated, searchable roster (STR/02 admin: avatar, level,
 * coins, titles, banned badge). Row → detail drawer (UserSheet).
 */
export function UsersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** live patches so rows update the instant a drawer mutation lands */
  const [overrides, setOverrides] = useState<Record<string, AdminUser>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMockQuery<AdminUsersPage>(() => adminListUsers(debounced, page, PAGE_SIZE), [debounced, page]);
  const rows = useMemo(() => {
    const base = query.data?.users ?? [];
    return base.map((u) => overrides[u._id] ?? u);
  }, [query.data, overrides]);

  const onUserUpdated = (user: AdminUser) => {
    setOverrides((prev) => ({ ...prev, [user._id]: user }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* search (48px) */}
      <label htmlFor="user-search" className="block">
        <span className="sr-only">Search players</span>
        <input
          id="user-search"
          type="search"
          value={search}
          placeholder="Search nickname, name or email…"
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-12 w-full rounded-btn border-2 border-wood-mid bg-wood-deep px-3 font-body text-sm text-ivory placeholder:text-ink-dim/75 focus:border-brass"
        />
      </label>

      <AsyncSection
        query={query}
        skeleton={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        }
        isEmpty={(data) => data.users.length === 0}
        empty={
          <p className="py-8 text-center font-body text-sm text-ink-dim">
            No players match “{debounced}”.
          </p>
        }
      >
        {() => (
          <>
            <h2 className="sr-only">Player roster</h2>
            {/* desktop table */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-wood-mid/60 font-body text-[10px] uppercase tracking-widest text-ink-dim">
                    <th className="px-2 py-2">Player</th>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2 text-right">Level</th>
                    <th className="px-2 py-2 text-right">Coins</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Last seen (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr key={user._id} className="border-b border-wood-mid/40 hover:bg-wood/40">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(user._id)}
                          className="flex min-h-12 items-center gap-3 rounded-btn text-left hover:text-red-text"
                        >
                          <Avatar spec={toDisplaySpec(user.avatarSpec)} size="sm" />
                          <span>
                            <span className="block font-display text-base text-ivory">{user.nickname}</span>
                            <span className="block font-body text-[10px] text-ink-dim">
                              {user.provider} · {user.email ?? "no email"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2 font-body text-xs text-lamp">{user.activeTitle ?? "—"}</td>
                      <td className="px-2 py-2 text-right font-body text-sm text-ivory">{user.level}</td>
                      <td className="px-2 py-2 text-right font-body text-sm">
                        <CoinAmount amount={user.coinBalance} />
                      </td>
                      <td className="px-2 py-2">
                        {user.banned ? <Badge tone="bad">BANNED</Badge> : <Badge tone="good">OK</Badge>}
                      </td>
                      <td className="px-2 py-2 font-body text-xs text-ink-dim">{formatStamp(user.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards → bottom-sheet detail */}
            <div className="flex flex-col gap-2 lg:hidden">
              {rows.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => setSelectedId(user._id)}
                  className="flex min-h-12 items-center gap-3 rounded-btn border border-wood-mid/60 bg-wood-deep/60 px-3 py-2 text-left"
                >
                  <Avatar spec={toDisplaySpec(user.avatarSpec)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base text-ivory">{user.nickname}</span>
                    <span className="block font-body text-[10px] text-ink-dim">
                      lvl {user.level} · <CoinAmount amount={user.coinBalance} className="text-[10px]" />
                      {user.activeTitle ? ` · ${user.activeTitle}` : ""}
                    </span>
                  </span>
                  {user.banned ? <Badge tone="bad">BANNED</Badge> : null}
                </button>
              ))}
            </div>

            <Pager page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </AsyncSection>

      {selectedId && (
        <UserSheet
          key={selectedId}
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUserUpdated={onUserUpdated}
        />
      )}
    </div>
  );
}

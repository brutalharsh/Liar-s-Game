"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { adminListAudit, type AdminAuditEntry } from "@/lib/api";
import { Badge, formatStamp } from "@/components/admin/bits";

const PAGE_SIZE = 20;

/**
 * AUDIT tab — the `admin_audit` trail (STR/09): actor, action, target,
 * details, time. Pages of 20 with a load-more; newest first.
 */
export function AuditTab() {
  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<AdminAuditEntry[]>([]);
  const query = useMockQuery(() => adminListAudit(1, PAGE_SIZE), []);
  const [loadingMore, setLoadingMore] = useState(false);

  const total = query.data?.total ?? 0;
  const current = query.data?.entries ?? [];
  const rows = page === 1 ? current : [...current, ...extra];

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await adminListAudit(page + 1, PAGE_SIZE);
      setExtra((prev) => [...prev, ...next.entries.filter((e) => !current.some((c) => c._id === e._id) && !prev.some((p) => p._id === e._id))]);
      setPage((p) => p + 1);
    } catch {
      // best effort — totals won't lie, the button just stays
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <AsyncSection
      query={query}
      skeleton={
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      }
      isEmpty={(data) => data.entries.length === 0}
      empty={<p className="py-8 text-center font-body text-sm text-ink-dim">A clean house — no mutations yet.</p>}
    >
      {(data) => (
        <div className="flex flex-col gap-2">
          <h2 className="sr-only">Audit trail</h2>
          <div className="max-h-[60vh] overflow-y-auto pr-1" tabIndex={0} aria-label="Audit trail" role="group">
            <ul className="flex flex-col gap-1.5">
              {rows.map((entry) => (
                <li key={entry._id} className="flex flex-wrap items-center gap-2 rounded-btn border border-wood-mid/50 bg-wood/40 px-3 py-2">
                  <span className="font-body text-[10px] text-ink-dim">{formatStamp(entry.at)}</span>
                  <Badge tone="brass">{entry.actor}</Badge>
                  <span className="font-display text-sm text-ivory">{entry.action}</span>
                  <span className="font-mono text-[10px] text-lamp">
                    {entry.targetType}:{entry.targetId}
                  </span>
                  {entry.details ? (
                    <span className="min-w-0 flex-1 truncate font-body text-xs text-ink-dim" title={entry.details}>
                      {entry.details}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          {rows.length < (data.total ?? total) && (
            <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "POURING…" : `LOAD MORE (${(data.total ?? total) - rows.length} left)`}
            </Button>
          )}
        </div>
      )}
    </AsyncSection>
  );
}

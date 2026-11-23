"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import { adminListPayments, type CheckoutRecord, type CheckoutStatus } from "@/lib/api";
import { Badge, Cell, formatMinor, formatStamp, Pager, statusTone } from "@/components/admin/bits";

const PAGE_SIZE = 10;

type StatusFilter = CheckoutStatus | "all";

const FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "created", label: "Created" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "expired", label: "Expired" },
];

/**
 * PAYMENTS tab — checkout records browser (STR/09 `checkouts`): filter by
 * status, ₹ amounts rendered from amountMinor, provider payment id, paid-at.
 */
export function PaymentsTab() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const query = useMockQuery(
    () => adminListPayments(status, page, PAGE_SIZE),
    [status, page],
  );
  const rows = query.data?.checkouts ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        active={status}
        onChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />

      <AsyncSection
        query={query}
        skeleton={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        }
        isEmpty={(data) => data.checkouts.length === 0}
        empty={
          <p className="py-8 text-center font-body text-sm text-ink-dim">
            No checkouts with status “{status}”.
          </p>
        }
      >
        {(data) => (
          <>
            {/* desktop table */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-wood-mid/60 font-body text-[10px] uppercase tracking-widest text-ink-dim">
                    <th className="px-2 py-2">Player</th>
                    <th className="px-2 py-2">Pack</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Payment id</th>
                    <th className="px-2 py-2">Paid at (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <CheckoutRowDesktop key={c._id} checkout={c} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="flex flex-col gap-2 lg:hidden">
              {rows.map((c) => (
                <div key={c._id} className="grid grid-cols-2 gap-2 rounded-btn border border-wood-mid/60 bg-wood/40 px-3 py-2">
                  <Cell label="Player">{c.userNickname ?? c.userId}</Cell>
                  <Cell label="Status">
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </Cell>
                  <Cell label="Pack">{c.productName}</Cell>
                  <Cell label="Amount">
                    <span className="text-brass">{formatMinor(c.amountMinor)}</span>
                  </Cell>
                  <Cell label="Payment id">{c.providerPaymentId ?? "—"}</Cell>
                  <Cell label="Paid (UTC)">{c.paidAt ? formatStamp(c.paidAt) : "—"}</Cell>
                </div>
              ))}
            </div>

            <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
          </>
        )}
      </AsyncSection>
    </div>
  );
}

function CheckoutRowDesktop({ checkout }: { checkout: CheckoutRecord }) {
  return (
    <tr className="border-b border-wood-mid/40">
      <td className="px-2 py-2 font-body text-sm text-ivory">{checkout.userNickname ?? checkout.userId}</td>
      <td className="px-2 py-2 font-body text-xs text-lamp">{checkout.productName}</td>
      <td className="px-2 py-2 text-right font-display text-sm text-brass">
        {formatMinor(checkout.amountMinor)}
      </td>
      <td className="px-2 py-2">
        <Badge tone={statusTone(checkout.status)}>{checkout.status}</Badge>
      </td>
      <td className="max-w-40 truncate px-2 py-2 font-mono text-[11px] text-ink-dim">
        {checkout.providerPaymentId ?? "—"}
      </td>
      <td className="px-2 py-2 font-body text-xs text-ink-dim">
        {checkout.paidAt ? formatStamp(checkout.paidAt) : "—"}
      </td>
    </tr>
  );
}

"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { CoinIcon } from "@/components/ui/icons";
import { formatCoins } from "@/lib/format";

/** UTC timestamp rendering — SSR-stable (no locale/timezone drift). */
export function formatStamp(iso: string | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

/** amountMinor → ₹ display (major units, paise shown only when non-zero). */
export function formatMinor(amountMinor: number): string {
  const major = amountMinor / 100;
  const hasPaise = amountMinor % 100 !== 0;
  return `₹${hasPaise ? major.toFixed(2) : major.toFixed(0)}`;
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "brass";
  className?: string;
}) {
  const tones = {
    neutral: "border-ink-dim/50 text-ink-dim",
    good: "border-verdict text-verdict",
    bad: "border-blood-bright text-blood-bright",
    warn: "border-lamp text-lamp",
    brass: "border-brass text-red-text",
  } as const;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 font-body text-[10px] tracking-wider ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "neutral" | "good" | "bad" | "warn" {
  switch (status) {
    case "paid":
      return "good";
    case "failed":
      return "bad";
    case "expired":
      return "warn";
    default:
      return "neutral";
  }
}

/** Gold coin figure — lamp-tone money text (the icon replaces the old coin glyph). */
export function CoinAmount({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-lamp ${className}`}>
      <CoinIcon size={14} />
      {formatCoins(amount)}
    </span>
  );
}

/** Smallest readable row for desktop tables / mobile cards alike. */
export function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">{label}</p>
      <div className="truncate font-body text-sm text-ivory">{children}</div>
    </div>
  );
}

/** 48px text input. */
export function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  min,
  step,
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: "text" | "number" | "password";
  value: string | number;
  onChange: (next: string) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block font-body text-[10px] uppercase tracking-widest text-ink-dim">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-btn border-2 border-wood-mid bg-wood-deep px-3 font-body text-sm text-ivory placeholder:text-ink-dim/75 focus:border-brass"
      />
      {hint && <span className="mt-1 block font-body text-[10px] text-ink-dim">{hint}</span>}
    </label>
  );
}

/** Confirm-guard modal (mission: destructive actions confirm twice-think). */
export function ConfirmSheet({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  danger = true,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={busy ? () => undefined : onClose} title={title}>
      <div className="flex flex-col gap-4">
        {children}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={onClose}>
            CANCEL
          </Button>
          <Button
            variant={danger ? "danger" : "brass"}
            className="flex-1"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "WORKING…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Prev/next pager for the paginated tabs. */
export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← PREV
      </Button>
      <p className="font-body text-xs text-ink-dim">
        page {page} of {last} · {total} rows
      </p>
      <Button variant="outline" size="sm" disabled={page >= last} onClick={() => onChange(page + 1)}>
        NEXT →
      </Button>
    </div>
  );
}

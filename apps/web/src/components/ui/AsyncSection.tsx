import type { ReactNode } from "react";
import type { MockQuery } from "@/hooks/useMockQuery";
import { Button } from "@/components/ui/Button";
import { CardIcon, EmptySeatIcon, SweatIcon } from "@/components/ui/icons";

/** Shimmering placeholder block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-btn bg-wood-mid/60 ${className}`} aria-hidden />;
}

/** The standard loading / empty / error treatment for async mock data. */
export function AsyncSection<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  children,
  errorTitle = "Fell off the table",
}: {
  query: MockQuery<T>;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  errorTitle?: string;
}) {
  if (query.loading) {
    return <div role="status" aria-label="Loading">{skeleton}</div>;
  }
  if (query.error) {
    return (
      <ErrorState title={errorTitle} sub={query.error.message} onRetry={query.reload} />
    );
  }
  const data = query.data as T;
  if (isEmpty && isEmpty(data)) {
    return <>{empty ?? null}</>;
  }
  return <>{children(data)}</>;
}

export function ErrorState({
  title = "Fell off the table",
  sub,
  onRetry,
}: {
  title?: string;
  sub?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-card border-2 border-blood/70 bg-wood/70 px-6 py-8 text-center"
    >
      <span
        className="flex items-center justify-center gap-2 text-blood-bright"
        aria-hidden
      >
        <CardIcon size={36} />
        <SweatIcon size={36} />
      </span>
      <h3 className="font-display text-2xl text-ivory">{title}</h3>
      <p className="font-body text-sm text-ink-dim">{sub ?? "Something went wrong. The dealer is checking the deck."}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  sub,
  icon,
  action,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-card border-2 border-dashed border-ink-dim/40 bg-wood/50 px-6 py-8 text-center"
    >
      <span className="text-ink-dim" aria-hidden>
        {icon ?? <EmptySeatIcon size={32} />}
      </span>
      <h3 className="font-display text-2xl text-ivory">{title}</h3>
      {sub && <p className="font-body text-sm text-ink-dim">{sub}</p>}
      {action}
    </div>
  );
}

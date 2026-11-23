import { formatCoins } from "@/lib/format";
import { CoinIcon } from "@/components/ui/icons";

/** Brass coin wallet/price badge. */
export function CoinBadge({
  amount,
  size = "md",
  className = "",
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-6 min-w-6 text-xs",
    md: "h-7 min-w-7 text-sm",
    lg: "h-10 min-w-10 text-lg",
  } as const;
  const iconSizes = { sm: 12, md: 14, lg: 18 } as const;
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full border-2 border-brass-deep bg-wood-deep px-2 font-display text-brass ${sizes[size]} ${className}`}
      aria-label={`${amount} coins`}
    >
      <CoinIcon size={iconSizes[size]} /> {formatCoins(amount)}
    </span>
  );
}

export function PriceChip({ price, className = "" }: { price: number; className?: string }) {
  if (price === 0) {
    return (
      <span className={`inline-flex items-center rounded-full bg-felt px-2 py-0.5 font-body text-xs text-ivory ${className}`}>
        FREE
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-wood-deep px-2 py-0.5 font-body text-xs text-brass ${className}`}>
      <CoinIcon size={12} /> <strong className="font-display">{price}</strong>
    </span>
  );
}

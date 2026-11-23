import type { CreateOrderRequest, CreateOrderResponse } from "@/lib/wire";

/**
 * Payments seam (STR/04 §1 / STR/02 payments v1):
 * Buy → POST /api/payments/create-order {packId}.
 * The endpoint does NOT exist yet on purpose (payments are MOCK until the
 * owner picks a provider). We still make the real fetch call — and handle
 * ANY failure gracefully, surfacing the friendly "coming soon" modal.
 * W3/wiring swaps the base URL to the Express server; zero UI change.
 */

export type PaymentOutcome =
  | { kind: "coming-soon"; detail: string }
  | { kind: "unexpected"; detail: string };

export async function createCoinPackOrder(req: CreateOrderRequest): Promise<PaymentOutcome> {
  try {
    const res = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = (await res.json().catch(() => null)) as CreateOrderResponse | null;
    if (res.ok && data?.status === "coming_soon") {
      return { kind: "coming-soon", detail: "The payment provider is being wired up." };
    }
    return {
      kind: "coming-soon",
      detail: "The payment gateway opens with the next release.",
    };
  } catch {
    // Network/404/HTML error pages all mean the same thing right now: not live yet.
    return {
      kind: "coming-soon",
      detail: "Payments go live once the gateway is connected. Nothing was charged.",
    };
  }
}

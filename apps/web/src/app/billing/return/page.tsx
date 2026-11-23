import type { Metadata } from "next";
import { ReturnClient } from "./ReturnClient";

export const metadata: Metadata = {
  title: "Payment return",
  robots: { index: false, follow: false },
};

/**
 * /billing/return — the payment gateway's landing dock (full-screen, no site
 * chrome). Everything interesting happens inside ReturnClient: the query is
 * only a hint; POST /api/billing/verify decides.
 */
export default function BillingReturnPage() {
  return (
    <div className="min-h-dvh px-safe pb-safe pt-safe">
      <ReturnClient />
    </div>
  );
}

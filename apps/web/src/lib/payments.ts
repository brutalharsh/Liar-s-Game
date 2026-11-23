/**
 * Payments seam (STR/04 §1 / STR/07 §0) — moved onto the real REST surface:
 * POST /api/billing/checkout {packId} → {checkoutUrl}. A null checkoutUrl
 * means the payment proxy isn't activated yet → the shop shows its friendly
 * "coming soon" modal instead of a redirect. The heavy lifting lives in
 * `@/lib/api` (mock/live adapter); this module stays as the shop's seam so
 * W3 can re-point one import if the contract shifts.
 */

export { checkoutPack } from "@/lib/api";

/**
 * entitlements — what an account owns (STR/09). Unique on
 * {accountId, kind, key} so purchase/claim flows are naturally idempotent.
 * kinds: `item` (avatar cosmetics), `theme` (bar themes), `title`,
 * `capacity` (future Big-Table seats).
 */
import { Schema, model } from 'mongoose';

export const ENTITLEMENT_KINDS = ['item', 'theme', 'title', 'capacity'] as const;
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number];

export interface EntitlementFields {
  accountId: unknown; // ObjectId ref users
  kind: EntitlementKind;
  key: string;
  source: string;
  at: Date;
}

const EntitlementSchema = new Schema<EntitlementFields>({
  accountId: { type: Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ENTITLEMENT_KINDS, required: true },
  key: { type: String, required: true },
  source: { type: String, default: 'purchase' },
  at: { type: Date, default: () => new Date() },
});

EntitlementSchema.index({ accountId: 1, kind: 1, key: 1 }, { unique: true });
EntitlementSchema.index({ accountId: 1 });

export const Entitlement = model<EntitlementFields>('entitlements', EntitlementSchema);

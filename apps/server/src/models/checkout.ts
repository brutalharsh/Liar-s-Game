/**
 * checkouts — payment records for the hosted payment proxy (STR/09).
 * The row is created (status `created`) BEFORE the client ever sees the
 * checkout URL; `amountMinor` saved here is the ONLY amount later trusted.
 * `grantedAt` is set exactly once, only after a backend status read returns
 * `paid` AND the proxy's amountMinor matches this record.
 */
import { Schema, model } from 'mongoose';

export const CHECKOUT_STATUSES = ['created', 'paid', 'failed', 'expired'] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export interface CheckoutFields {
  token: string;
  userId: unknown; // ObjectId ref users
  packId: string;
  productName: string;
  amountMinor: number;
  currency: string;
  status: CheckoutStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  paidAt?: Date;
  grantedAt?: Date;
  createdAt: Date;
}

const CheckoutSchema = new Schema<CheckoutFields>({
  token: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  packId: { type: String, required: true },
  productName: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: CHECKOUT_STATUSES, default: 'created' },
  providerOrderId: { type: String },
  providerPaymentId: { type: String },
  paidAt: { type: Date },
  grantedAt: { type: Date },
  createdAt: { type: Date, default: () => new Date() },
});

CheckoutSchema.index({ token: 1 }, { unique: true });
CheckoutSchema.index({ userId: 1, createdAt: -1 });
CheckoutSchema.index({ status: 1, createdAt: -1 });

export const Checkout = model<CheckoutFields>('checkouts', CheckoutSchema);

/**
 * admin_audit — one row for EVERY admin dashboard mutation (STR/09).
 * Actor is the env-credential admin (`env-admin`) in v1.
 */
import { Schema, model } from 'mongoose';

export interface AdminAuditFields {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: unknown; // JSON-safe object; never secrets
  at: Date;
}

const AdminAuditSchema = new Schema<AdminAuditFields>({
  actor: { type: String, default: 'env-admin' },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, default: '' },
  details: { type: Schema.Types.Mixed },
  at: { type: Date, default: () => new Date() },
});

AdminAuditSchema.index({ at: -1 });

export const AdminAudit = model<AdminAuditFields>('admin_audit', AdminAuditSchema);

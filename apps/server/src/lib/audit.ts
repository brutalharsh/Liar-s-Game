/**
 * Admin audit trail — every admin-dashboard mutation lands exactly one row
 * (STR/02 admin block, STR/09). Audit failure is LOUD but does not roll the
 * mutation back (row is appended after the change succeeds).
 */
import { AdminAudit } from '../models/admin-audit.js';

export interface AuditInput {
  action: string;
  targetType: string;
  targetId?: string;
  /** JSON-safe details; NEVER secrets (keys, tokens, raw credentials). */
  details?: Record<string, unknown>;
}

export async function writeAudit(actor: string, input: AuditInput): Promise<void> {
  try {
    await AdminAudit.create({ actor, ...input, at: new Date() });
  } catch (err) {
    console.error(`[audit] FAILED to persist admin audit row (action=${input.action}):`, err);
  }
}

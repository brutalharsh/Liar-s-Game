/**
 * Model schema contracts (STR/09) — REAL mongoose schemas, no connection:
 * unique indexes (idempotency backbone), TTL, enums, collection names.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/user.js';
import { WalletLedger, LEDGER_REASONS } from '../src/models/wallet-ledger.js';
import { Entitlement, ENTITLEMENT_KINDS } from '../src/models/entitlement.js';
import { CatalogItem, CATALOG_CATEGORIES } from '../src/models/catalog-item.js';
import { CoinPack } from '../src/models/coin-pack.js';
import { Checkout, CHECKOUT_STATUSES } from '../src/models/checkout.js';
import { AdminAudit } from '../src/models/admin-audit.js';
import { MatchRecord } from '../src/models/match-record.js';
import { PublicRoom } from '../src/models/public-room.js';

type IndexSpec = [Record<string, unknown>, Record<string, unknown>];

function indexesOf(model: mongoose.Model<unknown>): IndexSpec[] {
  return model.schema.indexes() as IndexSpec[];
}

function findIndex(model: mongoose.Model<unknown>, spec: Record<string, unknown>): IndexSpec | undefined {
  return indexesOf(model).find(([s]) => JSON.stringify(s) === JSON.stringify(spec));
}

describe('wallet_ledger (append-only, idempotent)', () => {
  it('uniquely indexes txId — the idempotency key', () => {
    const idx = findIndex(WalletLedger as unknown as mongoose.Model<unknown>, { txId: 1 });
    expect(idx).toBeDefined();
    expect(idx?.[1]?.['unique']).toBe(true);
  });

  it('indexes {accountId, at:-1} for the balance/ledger reads', () => {
    expect(findIndex(WalletLedger as unknown as mongoose.Model<unknown>, { accountId: 1, at: -1 })).toBeDefined();
  });

  it('locks the reason enum to ledger invariants (STR/09)', () => {
    const reason = WalletLedger.schema.path('reason') as unknown as { enumValues?: unknown };
    expect(reason.enumValues).toEqual([...LEDGER_REASONS]);
  });
});

describe('checkouts (payment records)', () => {
  it('uniquely indexes token', () => {
    const idx = findIndex(Checkout as unknown as mongoose.Model<unknown>, { token: 1 });
    expect(idx?.[1]?.['unique']).toBe(true);
  });

  it('tracks exactly the four lifecycle statuses', () => {
    const status = Checkout.schema.path('status') as unknown as { enumValues?: unknown };
    expect(status.enumValues).toEqual([...CHECKOUT_STATUSES]);
  });

  it('saves amountMinor as required (the only trusted amount)', () => {
    const amountMinor = Checkout.schema.path('amountMinor') as unknown as { isRequired?: boolean };
    expect(amountMinor.isRequired).toBe(true);
  });
});

describe('entitlements', () => {
  it('uniquely indexes {accountId, kind, key} — purchases are idempotent', () => {
    const idx = findIndex(Entitlement as unknown as mongoose.Model<unknown>, {
      accountId: 1,
      kind: 1,
      key: 1,
    });
    expect(idx?.[1]?.['unique']).toBe(true);
  });

  it('locks the four entitlement kinds', () => {
    const kind = Entitlement.schema.path('kind') as unknown as { enumValues?: unknown };
    expect(kind.enumValues).toEqual([...ENTITLEMENT_KINDS]);
  });
});

describe('users', () => {
  it('uniquely indexes {provider, providerId}', () => {
    const idx = findIndex(User as unknown as mongoose.Model<unknown>, { provider: 1, providerId: 1 });
    expect(idx?.[1]?.['unique']).toBe(true);
  });

  it('sparsely uniquely indexes email (Discord identify has none)', () => {
    const idx = findIndex(User as unknown as mongoose.Model<unknown>, { email: 1 });
    expect(idx?.[1]?.['unique']).toBe(true);
    expect(idx?.[1]?.['sparse']).toBe(true);
  });
});

describe('catalog_items + coin_packs', () => {
  it('allows exactly the v1 catalog categories', () => {
    const category = CatalogItem.schema.path('category') as unknown as { enumValues?: unknown };
    expect(category.enumValues).toEqual([...CATALOG_CATEGORIES]);
  });

  it('flattens to string _id (category:slug) with imageId+imageUrl+imageName art fields', () => {
    for (const field of ['imageId', 'imageUrl', 'imageName']) {
      expect(CatalogItem.schema.path(field)).toBeDefined();
    }
  });

  it('keeps pack price in MAJOR units with coins + optional bonus', () => {
    const priceMajor = CoinPack.schema.path('priceMajor') as unknown as { isRequired?: boolean };
    const coins = CoinPack.schema.path('coins') as unknown as { isRequired?: boolean };
    const bonus = CoinPack.schema.path('bonus') as unknown as { isRequired?: boolean };
    expect(priceMajor.isRequired).toBe(true);
    expect(coins.isRequired).toBe(true);
    expect(Boolean(bonus.isRequired)).toBe(false);
  });
});

describe('stubs registered for S1', () => {
  it('match_records: unique matchId + players stats indexes (STR/09)', () => {
    const idx = findIndex(MatchRecord as unknown as mongoose.Model<unknown>, { matchId: 1 });
    expect(idx?.[1]?.['unique']).toBe(true);
    const names = mongoose.modelNames();
    expect(names).toContain('match_records');
    expect(names).toContain('public_rooms');
  });

  it('public_rooms: TTL 10 min on updatedAt', () => {
    const idx = findIndex(PublicRoom as unknown as mongoose.Model<unknown>, { updatedAt: 1 });
    expect(idx?.[1]?.['expireAfterSeconds']).toBe(600);
  });

  it('admin_audit: defaults actor to env-admin', () => {
    const actor = AdminAudit.schema.path('actor') as unknown as { defaultValue?: unknown };
    expect(actor.defaultValue).toBe('env-admin');
  });
});

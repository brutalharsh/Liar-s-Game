/**
 * Billing security tests (STR/08 §14, docs/payments-api.md) — grants ONLY
 * on backend-verified 'paid' AND amountMinor match; price from DB, never
 * the body; idempotent per token; mock NEVER credits; non-paid mapped.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../src/models/user.js', () => ({
  User: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../src/models/checkout.js', () => ({
  Checkout: {
    create: vi.fn(async () => undefined),
    findOne: vi.fn(),
    // Routes chain .exec() on updateOne — return a query-like object.
    updateOne: vi.fn(() => ({ exec: () => Promise.resolve({ matchedCount: 1 }) })),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  CHECKOUT_STATUSES: ['created', 'paid', 'failed', 'expired'] as const,
}));

vi.mock('../src/models/coin-pack.js', () => ({
  CoinPack: {
    findById: vi.fn(),
    find: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../src/lib/wallet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/wallet.js')>();
  return {
    ...actual,
    deriveBalance: vi.fn(async (): Promise<number> => 0),
    deriveBalances: vi.fn(async (): Promise<Map<string, number>> => new Map()),
    appendLedger: vi.fn(async (): Promise<{ ok: true } | { ok: false; duplicate: true }> => ({ ok: true })),
  };
});

import { createApp } from '../src/app.js';
import { Checkout } from '../src/models/checkout.js';
import { CoinPack } from '../src/models/coin-pack.js';
import { appendLedger } from '../src/lib/wallet.js';
import { User } from '../src/models/user.js';
import {
  listen,
  makeCount,
  makeQuery,
  request,
  json,
  tinyLimiter,
  PROXY_TEST_CONFIG,
  TEST_CONFIG,
  type Listening,
} from './helpers/harness.js';
import { createAuthMiddleware } from '../src/middleware/auth.js';

const USER_ID = '507f1f77bcf86cd799439011';
const auth = createAuthMiddleware(TEST_CONFIG.authSecret);
const session = { cookie: `lg_session=${auth.signSessionToken(USER_ID)}` };

const POPULAR_PACK = {
  _id: 'popular',
  name: 'Popular Pack',
  priceMajor: 99,
  coins: 1200,
  bonus: 100,
  active: true,
  sortOrder: 2,
};

interface StagedResponse {
  status: number;
  body: unknown;
}

class FetchRecorder {
  calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  queue: StagedResponse[] = [];
  impl = async (url: string, init?: RequestInit): Promise<Response> => {
    this.calls.push({ url, init });
    const next = this.queue.shift();
    if (!next) throw new Error('test fetch called with no staged response');
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

let server: Listening;
let fetchRecorder: FetchRecorder;
let proxyServer: Listening;

beforeEach(() => {
  vi.mocked(User.findById).mockImplementation(
    () =>
      makeQuery([{ _id: USER_ID, nickname: 'Ron', level: 5, banned: false }], 'findOne') as unknown as ReturnType<
        typeof User.findById
      >,
  );
});

beforeAll(async () => {
  fetchRecorder = new FetchRecorder();
  const unlimited = tinyLimiter(1_000_000);
  // Mock provider app (TEST_CONFIG).
  server = await listen(
    createApp(TEST_CONFIG, {
      limiters: { billing: unlimited, auth: unlimited, admin: unlimited, login: unlimited },
      payments: {
        provider: 'mock',
        async createCheckout() {
          return { mock: true, checkoutUrl: null };
        },
        async getCheckoutStatus() {
          return { status: 'mock', message: 'payments not configured' };
        },
      },
    }),
  );
  // Proxy provider app — REAL client against a stubbed fetch.
  proxyServer = await listen(
    createApp(PROXY_TEST_CONFIG, {
      fetchImpl: fetchRecorder.impl,
      limiters: { billing: unlimited, auth: unlimited, admin: unlimited, login: unlimited },
    }),
  );
});

afterAll(async () => {
  await server.close();
  await proxyServer.close();
});

afterEach(() => {
  vi.clearAllMocks();
  fetchRecorder.calls = [];
  fetchRecorder.queue = [];
});

function stubPack(pack: Record<string, unknown> | null): void {
  vi.mocked(CoinPack.findById).mockImplementation(
    () =>
      makeQuery(pack ? [pack] : [], 'findOne') as unknown as ReturnType<typeof CoinPack.findById>,
  );
}

function stubCheckout(record: Record<string, unknown> | null): void {
  vi.mocked(Checkout.findOne).mockImplementation(
    () =>
      makeQuery(record ? [record] : [], 'findOne') as unknown as ReturnType<typeof Checkout.findOne>,
  );
}

const CHECKOUT_RECORD = {
  _id: '6677f0f0f0f0f0f0f0f0f0f0',
  token: 'tok_123',
  userId: { toString: () => USER_ID },
  packId: 'popular',
  productName: 'Popular Pack',
  amountMinor: 9900,
  currency: 'INR',
  status: 'created',
  grantedAt: null,
  createdAt: new Date('2026-11-23T10:00:00Z'),
};

describe('checkout (price authority + record-before-response)', () => {
  it('requires a session', async () => {
    const res = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      body: json({ packId: 'popular' }),
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'AUTH_REQUIRED' });
  });

  it('mock provider returns {mock:true, checkoutUrl:null} and NEVER records or grants', async () => {
    const res = await request(`${server.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mock: true, checkoutUrl: null });
    expect(vi.mocked(Checkout.create)).not.toHaveBeenCalled();
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });

  it("404s for unknown or inactive packs", async () => {
    stubPack(null);
    const missing = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'nope' }),
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'PACK_NOT_FOUND' });

    stubPack({ ...POPULAR_PACK, active: false });
    const inactive = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular' }),
    });
    expect(inactive.status).toBe(404);
    expect(inactive.body).toEqual({ error: 'PACK_NOT_FOUND' });
  });

  it('prices from the DB pack — amount is MAJOR units, never from the request', async () => {
    stubPack(POPULAR_PACK);

    // A hostile "price" in the body is rejected outright (strict zod): the
    // price can never come from the request, not even as an override.
    fetchRecorder.queue.push({
      status: 201,
      body: {
        token: 'tok_123',
        checkoutUrl: 'http://payments.test/pay/tok_123',
        amountMinor: 9900,
        currency: 'INR',
      },
    });
    const hostile = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular', price: 1, amountMinor: 100 }),
    });
    expect(hostile.status).toBe(400);
    expect(fetchRecorder.calls).toHaveLength(0);
    fetchRecorder.queue.shift(); // drop the staged response the call never consumed

    // Clean request — priced from the coin_packs row.
    fetchRecorder.queue.push({
      status: 201,
      body: {
        token: 'tok_123',
        checkoutUrl: 'http://payments.test/pay/tok_123',
        amountMinor: 9900,
        currency: 'INR',
      },
    });
    const res = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular' }),
    });
    expect(res.status).toBe(200);

    const [createCall] = fetchRecorder.calls;
    expect(createCall?.url).toBe('http://payments.test/api/v1/checkout');
    expect(createCall?.init?.method).toBe('POST');
    const headers = createCall?.init?.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer pay-key');
    const sentBody = JSON.parse(String(createCall?.init?.body)) as Record<string, unknown>;
    expect(sentBody['projectId']).toBe('prj-pay');
    expect(sentBody['projectName']).toBe('liars-game');
    expect(sentBody['amount']).toBe(99); // MAJOR units — the proxy converts
    expect(sentBody['currency']).toBe('INR');
    expect(sentBody['productName']).toBe('Popular Pack');
    expect(sentBody['returnUrl']).toBe('http://localhost:3100/billing/return');
    expect(sentBody['metadata']).toEqual({ packId: 'popular' });

    // Record saved BEFORE responding: token + expected amountMinor + status created.
    expect(vi.mocked(Checkout.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'tok_123',
        userId: USER_ID,
        packId: 'popular',
        amountMinor: 9900,
        status: 'created',
      }),
    );
    expect(res.body).toEqual({
      checkoutUrl: 'http://payments.test/pay/tok_123',
      token: 'tok_123',
    });
  });

  it('rejects a proxy amountMinor that disagrees with the pack at creation (no record saved)', async () => {
    stubPack(POPULAR_PACK);
    fetchRecorder.queue.push({
      status: 201,
      body: {
        token: 'tok_bad',
        checkoutUrl: 'http://payments.test/pay/tok_bad',
        amountMinor: 9999,
        currency: 'INR',
      },
    });
    const res = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular' }),
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'AMOUNT_MISMATCH' });
    expect(vi.mocked(Checkout.create)).not.toHaveBeenCalled();
  });

  it('maps proxy errors to 502 PAYMENT_PROXY_ERROR', async () => {
    stubPack(POPULAR_PACK);
    fetchRecorder.queue.push({ status: 401, body: { ok: false, error: 'PROJECT_KEY_INVALID' } });
    const res = await request(`${proxyServer.url}/api/billing/checkout`, {
      method: 'POST',
      headers: session,
      body: json({ packId: 'popular' }),
    });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'PAYMENT_PROXY_ERROR' });
    expect(vi.mocked(Checkout.create)).not.toHaveBeenCalled();
  });
});

describe('verify (grant authority)', () => {
  it('404s for unknown tokens and 403s for someone else’s record', async () => {
    stubCheckout(null);
    const missing = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'unknown' }),
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'CHECKOUT_NOT_FOUND' });

    stubCheckout({ ...CHECKOUT_RECORD, userId: { toString: () => '507f1f77bcf86cd799439999' } });
    const foreign = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(foreign.status).toBe(403);
  });

  it('grants ONLY on paid + exact amountMinor match (idempotency key checkout:<token>)', async () => {
    stubCheckout(CHECKOUT_RECORD);
    stubPack(POPULAR_PACK);
    fetchRecorder.queue.push({
      status: 200,
      body: {
        token: 'tok_123',
        status: 'paid',
        amountMinor: 9900,
        currency: 'INR',
        providerPaymentId: 'pay_x',
        paidAt: '2026-11-23T10:05:00Z',
      },
    });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'paid', granted: true, coins: 1300 });

    // Idempotent ledger append under the exact contract key.
    expect(vi.mocked(appendLedger)).toHaveBeenCalledWith({
      accountId: USER_ID,
      delta: 1300, // coins 1200 + bonus 100
      reason: 'purchase',
      refId: 'tok_123',
      txId: 'checkout:tok_123',
    });
    // Checkout marked paid/granted with provider payment id.
    expect(vi.mocked(Checkout.updateOne)).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok_123', grantedAt: null }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'paid',
          providerPaymentId: 'pay_x',
          grantedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('re-verify after grant → {status:"paid", alreadyGranted:true} with NO proxy call, NO second grant', async () => {
    stubCheckout({ ...CHECKOUT_RECORD, status: 'paid', grantedAt: new Date('2026-11-23T10:05:00Z') });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'paid', alreadyGranted: true });
    expect(fetchRecorder.calls).toHaveLength(0);
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });

  it('NEVER grants on amount mismatch (paid but wrong price) — 422, record untouched', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubCheckout(CHECKOUT_RECORD);
    fetchRecorder.queue.push({
      status: 200,
      body: { token: 'tok_123', status: 'paid', amountMinor: 5000, currency: 'INR' },
    });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'AMOUNT_MISMATCH' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(vi.mocked(Checkout.updateOne)).not.toHaveBeenCalled();
    // Loud log — token + amounts, never the API key.
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('tok_123');
    expect(logged).toContain('9900');
    expect(logged).toContain('5000');
    expect(logged).not.toContain('pay-key');
    errorSpy.mockRestore();
  });

  it('maps created/failed/expired to messages and never grants', async () => {
    stubCheckout(CHECKOUT_RECORD);
    fetchRecorder.queue.push({
      status: 200,
      body: { token: 'tok_123', status: 'created', amountMinor: 9900 },
    });
    const created = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(created.status).toBe(200);
    expect(created.body).toEqual({ status: 'created', message: 'payment not completed' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();

    for (const status of ['failed', 'expired'] as const) {
      vi.clearAllMocks();
      stubCheckout(CHECKOUT_RECORD);
      fetchRecorder.queue.push({
        status: 200,
        body: { token: 'tok_123', status, amountMinor: 9900 },
      });
      const res = await request(`${proxyServer.url}/api/billing/verify`, {
        method: 'POST',
        headers: session,
        body: json({ token: 'tok_123' }),
      });
      expect(res.status).toBe(200);
      expect((res.body as Record<string, string>)['status']).toBe(status);
      expect((res.body as Record<string, string>)['message']).toContain('fresh checkout');
      expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
      expect(vi.mocked(Checkout.updateOne)).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok_123' }),
        expect.objectContaining({ $set: expect.objectContaining({ status }) }),
      );
    }
  });

  it('mock provider never grants anything on verify', async () => {
    stubCheckout(CHECKOUT_RECORD);
    const res = await request(`${server.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'mock', message: 'payments not configured' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
  });

  it('a concurrent grant race collapses to alreadyGranted (duplicate txId)', async () => {
    stubCheckout(CHECKOUT_RECORD);
    stubPack(POPULAR_PACK);
    vi.mocked(appendLedger).mockResolvedValueOnce({ ok: false, duplicate: true });
    fetchRecorder.queue.push({
      status: 200,
      body: { token: 'tok_123', status: 'paid', amountMinor: 9900 },
    });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'paid', alreadyGranted: true });
    expect(vi.mocked(Checkout.updateOne)).not.toHaveBeenCalled();
  });

  it('proxy status errors → 502 PAYMENT_STATUS_UNAVAILABLE, no grant', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubCheckout(CHECKOUT_RECORD);
    fetchRecorder.queue.push({ status: 500, body: { ok: false, error: 'BOOM' } });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'PAYMENT_STATUS_UNAVAILABLE' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('pay-key');
    errorSpy.mockRestore();
  });

  it('blocks the grant when a paid record references a deleted pack (loud, no credit)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubCheckout(CHECKOUT_RECORD);
    stubPack(null);
    fetchRecorder.queue.push({
      status: 200,
      body: { token: 'tok_123', status: 'paid', amountMinor: 9900 },
    });
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      headers: session,
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'PACK_MISSING' });
    expect(vi.mocked(appendLedger)).not.toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).toContain('popular');
    errorSpy.mockRestore();
  });

  it('verify requires a session', async () => {
    const res = await request(`${proxyServer.url}/api/billing/verify`, {
      method: 'POST',
      body: json({ token: 'tok_123' }),
    });
    expect(res.status).toBe(401);
  });

  it('buffers admin browsing of payment records (paginated + status filter)', async () => {
    vi.mocked(Checkout.find).mockReturnValue(makeQuery([]) as unknown as ReturnType<typeof Checkout.find>);
    vi.mocked(Checkout.countDocuments).mockImplementation(
      () => makeCount(0) as unknown as ReturnType<typeof Checkout.countDocuments>,
    );
    const res = await request(`${proxyServer.url}/api/admin/payments?page=1&status=paid`, {
      headers: { cookie: `lg_admin=${auth.signAdminToken()}` },
    });
    // Not protected by a session — admin surface works. 200 + shape:
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 1, perPage: 20, total: 0, checkouts: [] });
    expect(vi.mocked(Checkout.find)).toHaveBeenCalledWith({ status: 'paid' });
  });
});

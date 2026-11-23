/**
 * Payments client — the hosted payment proxy ONLY (docs/payments-api.md §5,
 * §7). No gateway SDK, no gateway keys: the proxy owns the gateway.
 *
 * Providers:
 *  - 'mock':  informational only. It can NEVER credit anything —
 *             createCheckout returns {mock:true, checkoutUrl:null} and
 *             status reads return {status:'mock'} (STR/08 §14, v1 rule).
 *  - 'proxy': live provider — Bearer PAYMENT_API_KEY, amounts in MAJOR
 *             units (never pre-multiplied to paise), status re-verify is
 *             the ONLY proof of payment.
 */
import type { PaymentsConfig } from '@liars-game/shared/server';
import type { FetchLike } from './oauth.js';

export class PaymentsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PaymentsError';
  }
}

export interface CheckoutRequest {
  /** MAJOR units (49 = ₹49.00) — the proxy converts to paise itself. */
  amount: number;
  productName: string;
  description?: string;
  customer?: { name?: string; email?: string; phone?: string };
  returnUrl: string;
  /** ≤10 string key/value pairs. */
  metadata?: Record<string, string>;
}

export interface ProxyCheckout {
  token: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  expiresAt?: string;
}

export interface MockCheckout {
  mock: true;
  checkoutUrl: null;
}

export interface ProxyStatus {
  token: string;
  status: 'created' | 'paid' | 'failed' | 'expired';
  amountMinor: number;
  currency?: string;
  productName?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paidAt?: string;
  expiresAt?: string;
}

export interface MockStatus {
  status: 'mock';
  message: string;
}

export interface PaymentsClient {
  readonly provider: 'mock' | 'proxy';
  createCheckout(request: CheckoutRequest): Promise<ProxyCheckout | MockCheckout>;
  getCheckoutStatus(token: string): Promise<ProxyStatus | MockStatus>;
}

export function createPaymentsClient(
  config: PaymentsConfig,
  deps: { fetch?: FetchLike } = {},
): PaymentsClient {
  if (config.provider === 'mock') {
    return {
      provider: 'mock',
      async createCheckout() {
        return { mock: true, checkoutUrl: null };
      },
      async getCheckoutStatus() {
        return { status: 'mock', message: 'payments not configured' };
      },
    };
  }

  // provider === 'proxy'
  const base = (config.proxyUrl ?? '').replace(/\/+$/, '');
  const apiKey = config.apiKey ?? '';
  const projectId = config.projectId ?? '';
  const projectName = config.projectName ?? '';
  const doFetch = deps.fetch ?? globalThis.fetch;

  function assertConfigured(): void {
    if (!base || !apiKey || !projectId || !projectName) {
      // Unreachable via shared loadConfig (validated env), kept as a guard.
      throw new PaymentsError('payment proxy configuration is incomplete', 500);
    }
  }

  function authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  }

  async function readJson(res: Response): Promise<Record<string, unknown>> {
    try {
      const data = (await res.json()) as unknown;
      if (data && typeof data === 'object') return data as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }

  return {
    provider: 'proxy',

    async createCheckout(request: CheckoutRequest): Promise<ProxyCheckout | MockCheckout> {
      assertConfigured();
      const body: Record<string, unknown> = {
        projectId,
        projectName,
        amount: request.amount,
        currency: 'INR',
        productName: request.productName,
        returnUrl: request.returnUrl,
      };
      if (request.description !== undefined) body['description'] = request.description;
      if (request.customer !== undefined) body['customer'] = request.customer;
      if (request.metadata !== undefined) body['metadata'] = request.metadata;
      const res = await doFetch(`${base}/api/v1/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await readJson(res);
        const detail = typeof data['error'] === 'string' ? `: ${data['error']}` : '';
        throw new PaymentsError(`payment proxy checkout failed (${res.status})${detail}`, res.status);
      }
      const data = await readJson(res);
      const token = data['token'];
      const checkoutUrl = data['checkoutUrl'];
      const amountMinor = data['amountMinor'];
      if (typeof token !== 'string' || !token || typeof checkoutUrl !== 'string' || !checkoutUrl || typeof amountMinor !== 'number') {
        throw new PaymentsError('payment proxy checkout response missing token/checkoutUrl/amountMinor', 502);
      }
      return {
        token,
        checkoutUrl,
        amountMinor,
        currency: typeof data['currency'] === 'string' ? data['currency'] : 'INR',
        expiresAt: typeof data['expiresAt'] === 'string' ? data['expiresAt'] : undefined,
      };
    },

    async getCheckoutStatus(token: string): Promise<ProxyStatus | MockStatus> {
      assertConfigured();
      const res = await doFetch(
        `${base}/api/v1/checkout/${encodeURIComponent(token)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) {
        const data = await readJson(res);
        const detail = typeof data['error'] === 'string' ? `: ${data['error']}` : '';
        throw new PaymentsError(`payment proxy status failed (${res.status})${detail}`, res.status);
      }
      const data = await readJson(res);
      const status = data['status'];
      if (
        status !== 'created' &&
        status !== 'paid' &&
        status !== 'failed' &&
        status !== 'expired'
      ) {
        throw new PaymentsError('payment proxy returned unknown checkout status', 502);
      }
      const amountMinor = data['amountMinor'];
      if (typeof amountMinor !== 'number') {
        throw new PaymentsError('payment proxy status response missing amountMinor', 502);
      }
      return {
        token: typeof data['token'] === 'string' ? data['token'] : token,
        status,
        amountMinor,
        currency: typeof data['currency'] === 'string' ? data['currency'] : 'INR',
        productName: typeof data['productName'] === 'string' ? data['productName'] : undefined,
        providerOrderId:
          typeof data['providerOrderId'] === 'string' ? data['providerOrderId'] : undefined,
        providerPaymentId:
          typeof data['providerPaymentId'] === 'string' ? data['providerPaymentId'] : undefined,
        paidAt: typeof data['paidAt'] === 'string' ? data['paidAt'] : undefined,
        expiresAt: typeof data['expiresAt'] === 'string' ? data['expiresAt'] : undefined,
      };
    },
  };
}

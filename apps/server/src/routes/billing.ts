/**
 * /api/billing — coin-pack purchases through the hosted payment proxy
 * (docs/payments-api.md; STR/04 §1; STR/08 §14).
 *
 * Checkout: price comes ONLY from the `coin_packs` DB row — never the
 * request. The Checkout record (with OUR amountMinor = priceMajor*100,
 * status 'created') is saved BEFORE the checkoutUrl is returned.
 *
 * Verify: the backend status read is the ONLY proof. Grant happens ONLY
 * when status === 'paid' AND the proxy's amountMinor matches the saved
 * record AND grantedAt is still unset. Idempotent per token
 * (`txId = checkout:<token>` — the unique index is the serialization
 * point). The mock provider can NEVER grant anything.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '@liars-game/shared/server';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { appendLedger } from '../lib/wallet.js';
import { jsonError, parseBody } from '../lib/api.js';
import { createAuthMiddleware, type AuthMiddleware } from '../middleware/auth.js';
import { CoinPack } from '../models/coin-pack.js';
import { Checkout } from '../models/checkout.js';
import {
  createPaymentsClient,
  PaymentsError,
  type PaymentsClient,
} from '../lib/payments.js';

export interface BillingRouterDeps {
  billingLimiter?: RateLimitRequestHandler;
  payments?: PaymentsClient;
}

const CheckoutBody = z.strictObject({ packId: z.string().min(1).max(40) });
const VerifyBody = z.strictObject({ token: z.string().min(1).max(128) });

export function createBillingRouter(config: AppConfig, deps: BillingRouterDeps = {}): Router {
  const router = Router();
  const auth: AuthMiddleware = createAuthMiddleware(config.authSecret);
  const payments = deps.payments ?? createPaymentsClient(config.payments);
  const limiter = deps.billingLimiter ? [deps.billingLimiter] : [];

  router.post('/checkout', ...limiter, auth.requireAuth, async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(CheckoutBody, req.body, res);
    if (!body) return;
    const user = req.user;

    if (payments.provider === 'mock') {
      // Informational only — no records, no coins, ever.
      res.json({ mock: true, checkoutUrl: null });
      return;
    }

    const pack = await CoinPack.findById(body.packId).lean().exec();
    if (!pack || pack.active !== true) {
      jsonError(res, 404, 'PACK_NOT_FOUND');
      return;
    }

    const expectedAmountMinor = pack.priceMajor * 100;
    try {
      const created = await payments.createCheckout({
        amount: pack.priceMajor, // MAJOR units — the proxy converts to paise
        productName: pack.name,
        description: `${pack.coins + (pack.bonus ?? 0)} coins for Liar's Game`,
        customer: {
          ...(user?.nickname ? { name: user.nickname } : {}),
          ...(user?.email ? { email: user.email } : {}),
        },
        returnUrl: `${config.appUrl}/billing/return`,
        metadata: { packId: pack._id },
      });
      if ('mock' in created) {
        res.json({ mock: true, checkoutUrl: null });
        return;
      }
      if (created.amountMinor !== expectedAmountMinor) {
        // Config error or tampering — loud, and NO record is saved.
        console.error(
          `[billing] checkout amount mismatch at creation: token=${created.token} ` +
            `expectedMinor=${expectedAmountMinor} proxyMinor=${created.amountMinor} — record NOT saved`,
        );
        jsonError(res, 500, 'AMOUNT_MISMATCH');
        return;
      }
      await Checkout.create({
        token: created.token,
        userId: user?.id,
        packId: pack._id,
        productName: pack.name,
        amountMinor: expectedAmountMinor,
        currency: created.currency ?? 'INR',
        status: 'created',
      });
      res.json({ checkoutUrl: created.checkoutUrl, token: created.token });
    } catch (err) {
      if (err instanceof PaymentsError) {
        console.error(`[billing] proxy checkout failed (${err.status})`);
        jsonError(res, 502, 'PAYMENT_PROXY_ERROR');
        return;
      }
      throw err;
    }
  });

  router.post('/verify', ...limiter, auth.requireAuth, async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(VerifyBody, req.body, res);
    if (!body) return;
    const user = req.user;

    const record = await Checkout.findOne({ token: body.token }).lean().exec();
    if (!record) {
      jsonError(res, 404, 'CHECKOUT_NOT_FOUND');
      return;
    }
    if (String(record.userId) !== user?.id) {
      jsonError(res, 403, 'FORBIDDEN');
      return;
    }

    // Idempotent re-verify after a grant — no proxy call needed.
    if (record.grantedAt) {
      res.json({ status: 'paid', alreadyGranted: true });
      return;
    }

    let statusRead;
    try {
      statusRead = await payments.getCheckoutStatus(body.token);
    } catch (err) {
      if (err instanceof PaymentsError) {
        console.error(`[billing] proxy status failed (${err.status}) for token=${body.token}`);
        jsonError(res, 502, 'PAYMENT_STATUS_UNAVAILABLE');
        return;
      }
      throw err;
    }

    if (statusRead.status === 'mock') {
      res.json({ status: 'mock', message: statusRead.message });
      return;
    }

    const amountOk = statusRead.amountMinor === record.amountMinor;
    if (statusRead.status === 'paid' && !amountOk) {
      // NEVER grant, never mark paid: loud ops alert, record untouched.
      console.error(
        `[billing] AMOUNT MISMATCH token=${body.token} ` +
          `expectedMinor=${record.amountMinor} proxyMinor=${statusRead.amountMinor} — grant BLOCKED`,
      );
      jsonError(res, 422, 'AMOUNT_MISMATCH');
      return;
    }

    if (statusRead.status === 'created') {
      res.json({ status: 'created', message: 'payment not completed' });
      return;
    }

    if (statusRead.status === 'failed' || statusRead.status === 'expired') {
      await Checkout.updateOne(
        { token: body.token },
        {
          $set: {
            status: statusRead.status,
            ...(statusRead.providerOrderId ? { providerOrderId: statusRead.providerOrderId } : {}),
          },
        },
      ).exec();
      res.json({
        status: statusRead.status,
        message: `payment ${statusRead.status} — start a fresh checkout`,
      });
      return;
    }

    // status === 'paid' + amounts match → grant.
    const pack = await CoinPack.findById(record.packId).lean().exec();
    if (!pack) {
      // They paid but the pack row vanished — grant stays blocked, ops alert.
      console.error(
        `[billing] paid checkout references missing pack "${record.packId}" token=${body.token} — grant BLOCKED`,
      );
      jsonError(res, 500, 'PACK_MISSING');
      return;
    }
    const coins = pack.coins + (pack.bonus ?? 0);
    const grant = await appendLedger({
      accountId: String(record.userId),
      delta: coins,
      reason: 'purchase',
      refId: body.token,
      txId: `checkout:${body.token}`,
    });
    if (!grant.ok) {
      // A concurrent verify won the grant — idempotent by construction.
      res.json({ status: 'paid', alreadyGranted: true });
      return;
    }
    await Checkout.updateOne(
      { token: body.token, grantedAt: null },
      {
        $set: {
          status: 'paid',
          paidAt: statusRead.paidAt ? new Date(statusRead.paidAt) : new Date(),
          ...(statusRead.providerPaymentId
            ? { providerPaymentId: statusRead.providerPaymentId }
            : {}),
          ...(statusRead.providerOrderId ? { providerOrderId: statusRead.providerOrderId } : {}),
          grantedAt: new Date(),
        },
      },
    ).exec();
    console.log(
      `[billing] granted ${coins} coins to user ${user?.id} (token=${body.token})`,
    );
    res.json({ status: 'paid', granted: true, coins });
  });

  return router;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { verifyCheckout, type BillingVerifyResult } from "@/lib/api";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatCoins } from "@/lib/format";

/**
 * /billing/return — where the hosted payment proxy drops you back
 * (…?payment=paid&token=…). The query is a HINT: only the backend verify
 * (POST /api/billing/verify {token}) decides anything — grants happen there
 * (idempotent, paid + amount-match only). This screen only renders the truth.
 */

type Phase =
  | { kind: "reading" }
  | { kind: "verifying"; token: string; hintPaid: boolean }
  | { kind: "granted"; result: Extract<BillingVerifyResult, { status: "paid" }>; token: string }
  | { kind: "alreadyGranted"; result: Extract<BillingVerifyResult, { status: "paid" }> }
  | { kind: "processing"; result: Extract<BillingVerifyResult, { status: "created" }> }
  | { kind: "failed"; result: Extract<BillingVerifyResult, { status: "failed" | "expired" }> }
  | { kind: "noToken" }
  | { kind: "error"; message: string };

function useCountUp(target: number, durationMs = 1400): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    if (reduced) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return display;
}

export function ReturnClient() {
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const tokenRef = useRef<string | null>(null);

  const settle = useCallback((token: string, hintPaid = false) => {
    tokenRef.current = token;
    setPhase({ kind: "verifying", token, hintPaid });
    void (async () => {
      try {
        const result = await verifyCheckout(token);
        if (result.status === "paid") {
          setPhase(result.granted ? { kind: "granted", result, token } : { kind: "alreadyGranted", result });
        } else if (result.status === "created") {
          setPhase({ kind: "processing", result });
        } else {
          setPhase({ kind: "failed", result });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "The till didn't answer.";
        setPhase({ kind: "error", message });
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setPhase({ kind: "noToken" });
      return;
    }
    settle(token, params.get("payment") === "paid"); // hint ONLY — never trusted
  }, [settle]);

  const recheck = () => {
    const token = tokenRef.current;
    if (token) settle(token);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-14">
      {phase.kind === "reading" || phase.kind === "verifying" ? (
        <div role="status" className="w-full">
          <Panel className="w-full p-8 text-center">
            <span className="inline-block animate-pulse text-5xl" aria-hidden>
              🪙
            </span>
            <h1 className="mt-4 font-display text-3xl text-ivory">The house is counting…</h1>
            <p className="mt-2 font-body text-sm text-ink-dim">
              Checking with the payment gateway —{" "}
              {phase.kind === "verifying" && phase.hintPaid
                ? "it waved you through, but only the till's word counts."
                : "one moment while the till is counted."}
            </p>
            <p className="mt-3 font-mono text-[10px] text-ink-dim">token {phase.kind === "verifying" ? phase.token : "…"}</p>
          </Panel>
        </div>
      ) : null}

      {phase.kind === "granted" && <GrantedCard coinsGranted={phase.result.coinsGranted} coinBalance={phase.result.coinBalance} packName={phase.result.packName} />}

      {phase.kind === "alreadyGranted" && (
        <Panel tone="felt" className="w-full p-8 text-center">
          <span className="text-5xl" aria-hidden>
            🪙✅
          </span>
          <h1 className="mt-3 font-display text-3xl text-ivory">Already credited</h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            {phase.result.packName ? `The ${phase.result.packName}` : "This checkout"} was banked
            earlier — wallets are generous exactly once (idempotent grants).
          </p>
          <Balance amount={phase.result.coinBalance} />
          <BackToShop />
        </Panel>
      )}

      {phase.kind === "processing" && (
        <Panel tone="deep" className="w-full p-8 text-center">
          <span className="text-5xl" aria-hidden>
            ⏳
          </span>
          <h1 className="mt-3 font-display text-3xl text-ivory">Payment still processing</h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            {phase.result.packName ? `The ${phase.result.packName}` : "This checkout"} hasn't
            settled yet. Sometimes the gateway takes a minute to find its voice.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="brass" onClick={recheck}>
              CHECK AGAIN
            </Button>
            <BackToShop />
          </div>
        </Panel>
      )}

      {phase.kind === "failed" && (
        <Panel tone="deep" className="w-full p-8 text-center">
          <span className="text-5xl" aria-hidden>
            🪙💧
          </span>
          <h1 className="mt-3 font-display text-3xl text-ivory">
            {phase.result.status === "expired" ? "The checkout window closed" : "Payment didn't go through"}
          </h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            {phase.result.status === "expired"
              ? "Thirty minutes is all a checkout lives. Start fresh — the coins never moved."
              : "Nothing was charged. Failed windows can even flip to paid on retry, so start a fresh checkout from the shop."}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/shop"
              className="inline-flex min-h-12 items-center justify-center rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-lamp font-display tracking-wide text-wood-deep hover:brightness-110"
            >
              BACK TO THE SHOP
            </Link>
            <Button variant="ghost" onClick={recheck}>
              RECHECK ANYWAY
            </Button>
          </div>
        </Panel>
      )}

      {phase.kind === "error" && (
        <Panel tone="deep" className="w-full p-8 text-center">
          <span className="text-5xl" aria-hidden>
            🃏💦
          </span>
          <h1 className="mt-3 font-display text-3xl text-ivory">The till didn't answer</h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            Couldn't verify this payment. Nothing was granted — a retry is always safe (grants idempotent).
          </p>
          <p className="mt-1 font-body text-[11px] text-ink-dim">{phase.message}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="brass" onClick={recheck}>
              TRY VERIFYING AGAIN
            </Button>
            <BackToShop />
          </div>
        </Panel>
      )}

      {phase.kind === "noToken" && (
        <Panel tone="deep" className="w-full p-8 text-center">
          <span className="text-5xl" aria-hidden>
            🧾🤷
          </span>
          <h1 className="mt-3 font-display text-3xl text-ivory">No payment reference</h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            This link has no checkout token in it. If you just bought coins, use the link the
            gateway gave you — or check the shop.
          </p>
          <BackToShop />
        </Panel>
      )}
    </div>
  );
}

function GrantedCard({ coinsGranted, coinBalance, packName }: { coinsGranted: number; coinBalance: number; packName: string | null }) {
  return (
    <>
      <Panel className="w-full p-8 text-center" tone="wood">
        <span className="text-6xl" aria-hidden>
          🪙🎉
        </span>
        <h1 className="mt-3 font-display text-4xl text-brass">
          +{formatCoins(coinsGranted)} coins
        </h1>
        <p className="mt-2 font-body text-sm text-ivory">
          {packName ? `The ${packName} hit your wallet` : "Your wallet just got heavier"} — the
          house verified the payment and the credit is locked in.
        </p>
      </Panel>
      <Balance amount={coinBalance} />
      <BackToShop />
    </>
  );
}

function Balance({ amount }: { amount: number }) {
  return (
    <p className="font-body text-sm text-ink-dim">
      Wallet balance: <span className="text-brass">🪙 {formatCoins(amount)}</span>
    </p>
  );
}

function BackToShop() {
  return (
    <Link
      href="/shop"
      className="inline-flex min-h-12 items-center justify-center rounded-btn border-2 border-ink-dim/70 px-4 font-display text-sm text-ink-dim hover:border-brass hover:text-brass"
    >
      BACK TO THE SHOP
    </Link>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/AsyncSection";
import { getApiMode } from "@/lib/api";
import { signInDemoViewer } from "@/lib/mock/admin-fixtures";
import { useAuthStore } from "@/store/auth-store";

/**
 * /auth/callback — where OUR backend's OAuth callbacks land you after the
 * provider hop (…/auth/callback?status=ok[&next=…] | ?status=error&reason=…).
 * The session cookie was set server-side before this redirect; all this page
 * does is verify it (GET /api/auth/me via the auth store) and route onward.
 * `?next=` is trusted only when it's a same-origin path ("/…", never "//…").
 */

type Phase =
  | { kind: "reading" }
  | { kind: "ok"; next: string }
  | { kind: "error"; title: string; detail: string; reason: string | null; next: string };

/**
 * Reasons OUR backend actually sends (apps/server auth routes) — every one
 * gets human words; aliases kept for the wire doc's older spellings.
 */
function mapErrorReason(reason: string | null): { title: string; detail: string } {
  switch (reason) {
    case "OAUTH_NOT_CONFIGURED":
    case "not_configured":
      return {
        title: "Login isn't set up yet",
        detail: "The provider keys aren't configured on the server. The door opens the moment they are — nothing you did wrong.",
      };
    case "provider_error":
      return {
        title: "Couldn't sign you in",
        detail: "The provider turned us away. Nothing was charged, no session was made — start fresh from the sign-in door.",
      };
    case "denied":
      return {
        title: "You turned back at the window",
        detail: "The sign-in was cancelled before the handshake finished. Nothing was kept — come back whenever you're ready.",
      };
    case "state":
    case "code":
    case "exchange":
      return {
        title: "The handshake went stale",
        detail: "The sign-in ticket expired on the counter. No session was made — a fresh start from the sign-in door usually fixes it.",
      };
    case "banned":
      return {
        title: "You're barred from this saloon",
        detail: "The house has banned this account from the tables. If you believe that's a mistake, contact us and quote the reference below.",
      };
    default:
      return {
        title: "Couldn't sign you in",
        detail: "The handshake fell through. No session was made — try again from the sign-in door.",
      };
  }
}

/** Reasons where re-verifying the existing cookie can plausibly help; every
 *  other failure needs a fresh handshake, so the door link is the only honest retry. */
const RETRYABLE_REASONS: readonly string[] = ["session_missing", "verify_failed"];

function safeNext(raw: string | null | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export function CallbackClient() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const ranRef = useRef(false);

  const complete = useCallback(
    (next: string) => {
      setPhase({ kind: "ok", next });
      void (async () => {
        if (getApiMode() === "mock") signInDemoViewer(); // demo session (in-memory, never a real credential)
        await fetchMe(true);
        const { status } = useAuthStore.getState();
        if (status === "authed") {
          router.replace(next);
          return;
        }
        const mapped =
          status === "guest"
            ? { title: "The stamp didn't stick", detail: "The session cookie never landed. Check the provider's redirect settings, then try signing in again." }
            : { title: "Couldn't verify the session", detail: "The back office didn't answer when we checked your seat. A retry never hurts — sessions are only ever verified, never assumed." };
        setPhase({ kind: "error", reason: status === "guest" ? "session_missing" : "verify_failed", ...mapped, next });
      })();
    },
    [fetchMe, router],
  );

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const next = safeNext(params.get("next"));
    const status = params.get("status");
    const reason = params.get("reason");
    if (status === "error") {
      const mapped = mapErrorReason(reason);
      setPhase({ kind: "error", reason, ...mapped, next });
      return;
    }
    if (status !== "ok") {
      // bare visit / unknown handshake state — don't invent a session
      setPhase({
        kind: "error",
        reason: null,
        title: "That link didn't finish",
        detail: "The sign-in link is missing its handshake. Start fresh from the sign-in door.",
        next,
      });
      return;
    }
    complete(next);
  }, [complete]);

  const retry = () => complete(phase.kind === "error" ? phase.next : "/");

  const backToLogin = phase.kind === "error" && phase.next !== "/"
    ? `/login?next=${encodeURIComponent(phase.next)}`
    : "/login";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-14">
      {phase.kind !== "error" ? (
        <div role="status" className="w-full">
          <Panel className="w-full p-8 text-center">
            <span className="inline-block animate-pulse text-5xl" aria-hidden>
              🎩
            </span>
            <h1 className="mt-4 font-display text-3xl text-ivory">Stamping your ticket…</h1>
            <p className="mt-2 font-body text-sm text-ink-dim">
              The provider let you in — the house is checking your seat now. One moment.
            </p>
            <div className="mx-auto mt-5 flex max-w-56 flex-col items-center gap-2" aria-hidden>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </Panel>
        </div>
      ) : (
        <div role="alert" className="w-full">
          <Panel tone="deep" className="w-full p-8 text-center">
            <span className="text-5xl" aria-hidden>
              🃏🤝
            </span>
            <h1 className="mt-3 font-display text-3xl text-ivory">{phase.title}</h1>
            <p className="mt-2 font-body text-sm text-ink-dim">{phase.detail}</p>
            {phase.reason && (
              <p className="mt-1 font-body text-xs text-ink-dim">
                quote this if you ask for help:{" "}
                <span className="font-mono text-red-text">{phase.reason}</span>
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={backToLogin}
                className="inline-flex min-h-12 items-center justify-center rounded-btn border-2 border-brass-deep bg-gradient-to-b from-brass to-brass-soft font-display text-sm tracking-wide text-wood-deep hover:brightness-110"
              >
                BACK TO THE SIGN-IN DOOR
              </Link>
              {phase.reason !== null && RETRYABLE_REASONS.includes(phase.reason) && (
                <Button variant="outline" onClick={retry}>
                  TRY VERIFYING AGAIN
                </Button>
              )}
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center font-body text-xs text-ink-dim underline hover:text-red-text"
              >
                back to the saloon
              </Link>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

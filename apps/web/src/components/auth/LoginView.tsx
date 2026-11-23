"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { getApiMode, probeAuthProvider, type ApiMode } from "@/lib/api";
import { signInDemoViewer } from "@/lib/mock/admin-fixtures";
import { useAuthStore } from "@/store/auth-store";
import { useToasts } from "@/store/ui";

type Availability = "checking" | "ready" | "mock" | "not_configured" | "offline";

/**
 * /login — OAuth front door (STR/02 v1 auth). The provider buttons are plain
 * anchors: GET /api/auth/discord | /api/auth/google — the backend redirects
 * onward and drops the session cookie on callback; the client never runs an
 * OAuth flow. `?next=` rides along so the backend can route back here.
 */
export function LoginView() {
  const router = useRouter();
  const push = useToasts();
  const [next, setNext] = useState("/");
  const [availability, setAvailability] = useState<Availability>("checking");
  /** api mode after mount — rendering it during SSR would mismatch hydration
      when `?apimode=` differs from the compiled default. */
  const [apiMode, setApiMode] = useState<ApiMode>("mock");
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next") ?? "/";
    setNext(raw.startsWith("/") && !raw.startsWith("//") ? raw : "/");
    setApiMode(getApiMode());
  }, []);

  useEffect(() => {
    let alive = true;
    void probeAuthProvider().then((probe) => {
      if (!alive) return;
      setAvailability(
        probe.available ? "ready" : probe.reason === "mock" ? "mock" : probe.reason === "not_configured" ? "not_configured" : "offline",
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const query = useMemo(() => (next === "/" ? "" : `?next=${encodeURIComponent(next)}`), [next]);

  const guardClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (availability === "ready") return; // plain anchor — let the backend redirect onward
    event.preventDefault();
  };

  const demoSignIn = async () => {
    signInDemoViewer(); // mock sessions are in-memory only — never a real credential
    await fetchMe(true);
    push({ title: "Demo session opened", sub: "Mock mode — any real sign-in happens server-side.", tone: "good" });
    router.push(next);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <section className="text-center">
        <span className="text-5xl" aria-hidden>
          🎩
        </span>
        <h1 className="mt-3 font-display text-4xl text-ivory">Sign in at the bar</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Sign in with Discord or Google before you create, join or play. Rooms, ranks and the
          shop window stay open for browsing.
        </p>
      </section>

      {status === "authed" && user && (
        <Panel tone="felt" className="p-4">
          <p className="text-center font-body text-sm text-ivory">
            You're already at the table as <span className="text-brass">{user.nickname}</span>.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="brass" onClick={() => router.push(next)}>
              CONTINUE
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              SIGN OUT
            </Button>
          </div>
        </Panel>
      )}

      {(availability === "mock" || availability === "not_configured") && (
        <Panel tone="deep" className="p-4">
          <p className="text-center font-display text-base text-lamp" role="status">
            Login unavailable yet — provider keys not configured
          </p>
          <p className="mt-1 text-center font-body text-xs text-ink-dim">
            The moment the OAuth apps are registered, these doors open with no screen changes.
          </p>
        </Panel>
      )}

      {availability === "offline" && (
        <Panel tone="deep" className="p-4">
          <p className="text-center font-display text-base text-blood-bright" role="alert">
            Can't reach the sign-in service right now
          </p>
          <p className="mt-1 text-center font-body text-xs text-ink-dim">
            The back office isn't answering. Try again in a moment.
          </p>
        </Panel>
      )}

      <div className="flex flex-col gap-3" aria-label="Ways to sign in">
        <a
          href={`/api/auth/discord${query}`}
          onClick={guardClick}
          aria-disabled={availability !== "ready"}
          className="flex min-h-14 items-center justify-center gap-3 rounded-btn border-2 border-brass-deep bg-wood/80 px-4 font-display text-lg text-ivory shadow-panel hover:border-brass hover:brightness-110 aria-disabled:opacity-50"
        >
          <span aria-hidden className="text-2xl">
            💬
          </span>
          Continue with Discord
        </a>
        <a
          href={`/api/auth/google${query}`}
          onClick={guardClick}
          aria-disabled={availability !== "ready"}
          className="flex min-h-14 items-center justify-center gap-3 rounded-btn border-2 border-brass-deep bg-wood/80 px-4 font-display text-lg text-ivory shadow-panel hover:border-brass hover:brightness-110 aria-disabled:opacity-50"
        >
          <span aria-hidden className="text-2xl">
            🔎
          </span>
          Continue with Google
        </a>
        {availability === "mock" && (
          <Button variant="outline" onClick={() => void demoSignIn()}>
            DEMO: OPEN A SAMPLE SESSION
          </Button>
        )}
      </div>

      <Panel tone="wood" className="p-5">
        <h2 className="font-display text-lg text-ivory">Why the house asks for a name</h2>
        <ul className="mt-2 space-y-1.5 font-body text-xs text-ink-dim">
          <li>· Login is required to play — every seat is traceable to one identity.</li>
          <li>· Your wallet, XP, level, titles and avatar persist on any device.</li>
          <li>· Coin packs and the ledger need an account to land on.</li>
          <li>· Fewer throwaway alts = fewer liars who cheat and vanish.</li>
        </ul>
        <p className="mt-3 font-body text-[10px] text-ink-dim">
          Sessions are 7-day httpOnly cookies; we never store tokens in your browser. Only{" "}
          {apiMode === "mock" ? "mock mode is currently active" : "live mode is active"}.
        </p>
      </Panel>
    </div>
  );
}

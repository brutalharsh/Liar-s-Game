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
 * Provider marks (official silhouettes, viewed at 0 0 24 24) on an ivory chip —
 * the institutional white-badge OAuth pattern. Mono ink from tokens on
 * purpose: palette law (STR/05 §2) lives above brand colors on this screen.
 */
function ProviderMarkChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-ivory text-wood-deep"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        {children}
      </svg>
    </span>
  );
}

function DiscordMark() {
  return (
    <ProviderMarkChip>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </ProviderMarkChip>
  );
}

function GoogleMark() {
  return (
    <ProviderMarkChip>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </ProviderMarkChip>
  );
}

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
            You're already at the table as <span className="text-red-text">{user.nickname}</span>.
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

      <div role="group" className="flex flex-col gap-3" aria-label="Ways to sign in">
        <a
          href={`/api/auth/discord${query}`}
          onClick={guardClick}
          aria-disabled={availability !== "ready"}
          className="flex min-h-14 items-center justify-center gap-3 rounded-btn border-2 border-brass-deep bg-wood/80 px-4 font-display text-lg text-ivory shadow-panel hover:border-brass hover:brightness-110 aria-disabled:opacity-50"
        >
          <DiscordMark />
          Continue with Discord
        </a>
        <a
          href={`/api/auth/google${query}`}
          onClick={guardClick}
          aria-disabled={availability !== "ready"}
          className="flex min-h-14 items-center justify-center gap-3 rounded-btn border-2 border-brass-deep bg-wood/80 px-4 font-display text-lg text-ivory shadow-panel hover:border-brass hover:brightness-110 aria-disabled:opacity-50"
        >
          <GoogleMark />
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
        <p className="mt-3 font-body text-xs text-ink-dim">
          Sessions are 7-day httpOnly cookies; we never store tokens in your browser. Only{" "}
          {apiMode === "mock" ? "mock mode is currently active" : "live mode is active"}.
        </p>
      </Panel>
    </div>
  );
}

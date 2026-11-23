"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LockIcon, WarningIcon } from "@/components/ui/icons";
import { Field } from "@/components/admin/bits";
import { adminLogin, apiErrorMessage, isApiError } from "@/lib/api";

/**
 * Admin gate: env-credential login (STR/08 §13: timing-safe compare server-
 * side, lg_admin cookie 8h). Wrong creds get ONE generic message — no hints
 * about which field was wrong. Rate limits surface politely.
 */
export function AdminLogin({
  mockMode,
  onAuthed,
}: {
  mockMode: boolean;
  /** Receives the username the house signed in under (session identity). */
  onAuthed: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminLogin(username, password);
      onAuthed(username.trim() === "" ? "admin" : username.trim());
    } catch (err) {
      if (isApiError(err) && (err.status === 429 || err.error === "RATE_LIMITED")) {
        setError("Too many attempts — the lock cools off for a minute. Try again shortly.");
      } else if (isApiError(err) && (err.status === 401 || err.error === "UNAUTHORIZED" || err.error === "AUTH_REQUIRED")) {
        setError("Wrong username or password.");
      } else {
        setError(apiErrorMessage(err, "The back office won't open right now — try again."));
      }
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Panel tone="deep" className="w-full border-brass-deep/60 p-8">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass-deep bg-brass/10 text-brass" aria-hidden>
            <LockIcon size={28} />
          </span>
          <h1 className="mt-4 font-display text-3xl text-ivory">Back office</h1>
          <p className="mt-1 font-body text-xs text-ink-dim">
            House credentials only — they're configured at runtime via env, never in code.
          </p>
        </div>
        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <Field id="admin-user" label="Username" value={username} onChange={setUsername} autoComplete="username" />
          <Field
            id="admin-pass"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-btn border-2 border-blood/60 bg-wood-deep px-3 py-2 font-body text-xs text-blood-bright">
              <WarningIcon size={16} />
              {error}
            </p>
          )}
          <Button type="submit" variant="brass" disabled={busy}>
            {busy ? "CHECKING…" : "ENTER THE LEDGER"}
          </Button>
        </form>
        {mockMode && (
          <p className="mt-4 text-center font-body text-[10px] text-ink-dim">
            Mock mode: any username + password opens the demo. Live credentials live in env files only.
          </p>
        )}
      </Panel>
    </div>
  );
}

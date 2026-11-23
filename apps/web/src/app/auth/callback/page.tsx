import type { Metadata } from "next";
import { CallbackClient } from "./CallbackClient";

export const metadata: Metadata = {
  title: "Signing in",
  robots: { index: false, follow: false },
};

/**
 * /auth/callback — OAuth completion dock (full-screen, no site chrome):
 * `?status=ok` → verify the session, route to the safe `?next=` (or home);
 * `?status=error&reason=…` → friendly error state back to /login.
 */
export default function AuthCallbackPage() {
  return (
    <div className="min-h-dvh px-safe pb-safe pt-safe">
      <CallbackClient />
    </div>
  );
}

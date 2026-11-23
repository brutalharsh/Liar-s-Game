import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Your Liar's Game drawer: avatar try-on, owned inventory, appearance, sound, account and about — every control under one roof.",
};

/**
 * Signed-in dashboard (the route gate handles auth). SettingsView reads
 * ?section= via useSearchParams, which client-side-renders up to the nearest
 * Suspense boundary (Next 16 prerendering contract) — the fallback keeps the
 * shell in the initial HTML.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsView />
    </Suspense>
  );
}

/** Static shell served while the URL-state leaf streams in. */
function SettingsFallback() {
  return (
    <div className="flex flex-col gap-6 py-8" role="status" aria-label="Loading settings">
      <section className="text-center">
        <h1 className="font-display text-4xl text-ivory md:text-5xl">Settings</h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Your look, your racks, your noise floor — everything in one drawer.
        </p>
      </section>
      <div className="flex justify-center gap-2 overflow-hidden" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 w-28 animate-pulse rounded-btn bg-wood-mid/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-wood-mid/60" aria-hidden />
    </div>
  );
}

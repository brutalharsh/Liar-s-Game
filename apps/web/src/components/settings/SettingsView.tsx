"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  CatalogIcon,
  InfoIcon,
  JoinIcon,
  SoundIcon,
  ThemeIcon,
  UserIcon,
} from "@/components/ui/icons";
import { SettingsDataProvider } from "./settings-data";
import { AvatarSection } from "./sections/AvatarSection";
import { InventorySection } from "./sections/InventorySection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { SoundSection } from "./sections/SoundSection";
import { AccountSection } from "./sections/AccountSection";
import { AboutSection } from "./sections/AboutSection";

/**
 * ============================================================================
 * SETTINGS DASHBOARD (T4) — sidebar shell + URL-synced sections
 * ============================================================================
 * Desktop: a sticky sidebar of sections beside a single content pane; mobile:
 * the same nav as a horizontal segmented rail under the page header. The
 * active section rides the URL (?section=inventory) so deep links and the
 * back button work; section switches move focus to the pane (never on first
 * mount). One h1 for the page, one h2 per section — the pane is a labelled
 * landmark. Every functional control from the W1 settings page survives,
 * reorganized into Avatar · Inventory · Appearance · Sound · Account · About.
 * ============================================================================
 */

const SECTIONS = [
  { id: "avatar", label: "Avatar", icon: UserIcon },
  { id: "inventory", label: "Inventory", icon: CatalogIcon },
  { id: "appearance", label: "Appearance", icon: ThemeIcon },
  { id: "sound", label: "Sound", icon: SoundIcon },
  { id: "account", label: "Account", icon: JoinIcon },
  { id: "about", label: "About", icon: InfoIcon },
] as const;

export type SettingsSectionId = (typeof SECTIONS)[number]["id"];

const SECTION_IDS: readonly string[] = SECTIONS.map((s) => s.id);
const DEFAULT_SECTION: SettingsSectionId = "avatar";

function parseSection(raw: string | null): SettingsSectionId {
  return SECTION_IDS.includes(raw ?? "") ? (raw as SettingsSectionId) : DEFAULT_SECTION;
}

function renderSection(id: SettingsSectionId): ReactNode {
  switch (id) {
    case "avatar":
      return <AvatarSection />;
    case "inventory":
      return <InventorySection />;
    case "appearance":
      return <AppearanceSection />;
    case "sound":
      return <SoundSection />;
    case "account":
      return <AccountSection />;
    case "about":
      return <AboutSection />;
  }
}

export function SettingsView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseSection(searchParams.get("section"));

  /** Deep-link hrefs: existing params (?apimode=, ?mock=) ride along; the
   *  default section stays out of the URL so /settings alone is canonical. */
  const sectionHref = (id: SettingsSectionId): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === DEFAULT_SECTION) params.delete("section");
    else params.set("section", id);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  };

  // Focus lands on the pane when the section CHANGES (never on first mount,
  // never on a reload with a deep link) — keyboard users follow the switch.
  const paneRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    paneRef.current?.focus();
  }, [active]);

  const activeLabel = SECTIONS.find((s) => s.id === active)?.label ?? "Avatar";

  return (
    <SettingsDataProvider>
      <div className="flex flex-col gap-6 py-8">
        <section className="text-center">
          <h1 className="font-display text-4xl text-ivory md:text-5xl">Settings</h1>
          <p className="mt-2 font-body text-sm text-ink-dim">
            Your look, your racks, your noise floor — everything in one drawer.
          </p>
          <p className="mt-3">
            <Link
              href="/profile"
              className="inline-flex min-h-12 items-center gap-2 rounded-btn border-2 border-ink-dim/70 px-4 font-body text-xs tracking-wide text-ink-dim hover:border-brass hover:text-brass"
            >
              ← BACK TO PROFILE
            </Link>
          </p>
        </section>

        {/* mobile: segmented rail under the header (48px targets, scroll-x) */}
        <nav aria-label="Settings sections" className="lg:hidden">
          <ul className="flex snap-x gap-2 overflow-x-auto pb-1">
            {SECTIONS.map((s) => {
              const selected = s.id === active;
              return (
                <li key={s.id} className="shrink-0 snap-start">
                  <Link
                    href={sectionHref(s.id)}
                    aria-current={selected ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-2 rounded-btn border-2 px-3 font-display text-sm tracking-wide ${
                      selected
                        ? "border-brass bg-brass/15 text-brass"
                        : "border-wood-mid/70 bg-wood/50 text-ink-dim hover:text-ivory"
                    }`}
                  >
                    <span aria-hidden className="inline-flex items-center">
                      <s.icon />
                    </span>
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* desktop: sticky sidebar */}
          <nav aria-label="Settings sections" className="hidden lg:block lg:w-56 lg:shrink-0">
            <ul className="sticky top-24 flex flex-col gap-1">
              {SECTIONS.map((s) => {
                const selected = s.id === active;
                return (
                  <li key={s.id}>
                    <Link
                      href={sectionHref(s.id)}
                      aria-current={selected ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-btn border-2 px-3 font-display text-sm tracking-wide ${
                        selected
                          ? "border-brass bg-brass/15 text-brass"
                          : "border-transparent text-ink-dim hover:border-wood-mid hover:text-ivory"
                      }`}
                    >
                      <span aria-hidden className="inline-flex items-center">
                        <s.icon />
                      </span>
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* content pane — one labelled landmark per active section */}
          <div
            ref={paneRef as React.RefObject<HTMLDivElement>}
            id="settings-pane"
            tabIndex={-1}
            role="region"
            aria-label={`${activeLabel} settings`}
            className="min-w-0 flex-1 outline-none"
          >
            {renderSection(active)}
          </div>
        </div>
      </div>
    </SettingsDataProvider>
  );
}

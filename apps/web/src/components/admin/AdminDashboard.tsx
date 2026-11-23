"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/AsyncSection";
import {
  AdminIcon,
  AuditIcon,
  CatalogIcon,
  CheckIcon,
  LogoutIcon,
  PacksIcon,
  PaymentsIcon,
  SettingsIcon,
  UsersIcon,
  type IconComponent,
} from "@/components/ui/icons";
import { adminListAudit, adminLogout, getApiMode } from "@/lib/api";
import { useToasts } from "@/store/ui";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { UsersTab } from "@/components/admin/UsersTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { CatalogTab } from "@/components/admin/CatalogTab";
import { PacksTab } from "@/components/admin/PacksTab";
import { AuditTab } from "@/components/admin/AuditTab";

type AdminTab = "users" | "payments" | "catalog" | "packs" | "audit";

const NAV_ITEMS: readonly { id: AdminTab; label: string; Icon: IconComponent }[] = [
  { id: "users", label: "Users", Icon: UsersIcon },
  { id: "payments", label: "Payments", Icon: PaymentsIcon },
  { id: "catalog", label: "Catalog", Icon: CatalogIcon },
  { id: "packs", label: "Packs", Icon: PacksIcon },
  { id: "audit", label: "Audit", Icon: AuditIcon },
];

const TAB_IDS: readonly string[] = NAV_ITEMS.map((n) => n.id);

function isTab(value: string | null): value is AdminTab {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

/**
 * /admindashboard — back office (STR/02 v1 admin). NOT behind the player
 * AuthGate: it runs its own env-credential login (POST /api/admin/login →
 * server-side lg_admin cookie). The client probes GET /api/admin/audit as
 * the session check and falls back to the login screen on 401.
 *
 * Dashboard shell: fixed sidebar on ≥md (brand + session + nav, active
 * section = red accent rail), the same nav as a top icon rail on phones
 * with a Sheet drawer for full labels. The current section is mirrored to
 * ?tab=… via history.replaceState (route untouched), so deep links and the
 * browser address bar stay honest without any navigation.
 */
export function AdminDashboard() {
  const push = useToasts();
  const [phase, setPhase] = useState<"checking" | "login" | "ready">("checking");
  const [tab, setTab] = useState<AdminTab>("users");
  const [identity, setIdentity] = useState<string>("admin");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await adminListAudit(1, 1); // session probe: 401 → login screen
        const fromUrl = new URLSearchParams(window.location.search).get("tab");
        if (alive) {
          if (isTab(fromUrl)) setTab(fromUrl);
          setPhase("ready");
        }
      } catch {
        if (alive) setPhase("login");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Section switch + URL mirroring (replaceState: no history spam). */
  const changeTab = (next: AdminTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch {
      // non-browser contexts (tests) — the UI keeps working without the URL
    }
  };

  const signOutOfAdmin = async () => {
    await adminLogout(); // best-effort: server drops the admin cookie
    push({ title: "Left the back office", tone: "info" });
    setIdentity("admin");
    setDrawerOpen(false);
    setPhase("login");
  };

  const mockMode = useMemo(() => getApiMode() === "mock", []);

  if (phase === "checking") {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-16" role="status" aria-label="Checking admin session">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (phase === "login") {
    return (
      <AdminLogin
        mockMode={mockMode}
        onAuthed={(username) => {
          setIdentity(username);
          setPhase("ready");
          setTab("users");
        }}
      />
    );
  }

  const current = NAV_ITEMS.find((n) => n.id === tab) ?? NAV_ITEMS[0]!;

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar — brand, session, sections (red accent rail) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r-2 border-wood-mid/70 bg-wood md:flex" aria-label="Admin sections">
        <div className="border-b-2 border-wood-mid/60 px-5 py-5">
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-lamp">Back office</p>
          <p className="mt-1 font-display text-2xl leading-tight text-ivory">
            Liar's Game <span className="text-brass">— Admin</span>
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="flex flex-col">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => changeTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 border-l-4 px-4 text-left font-display text-sm tracking-wide ${
                    tab === id
                      ? "border-brass bg-brass/10 text-brass"
                      : "border-transparent text-ink-dim hover:bg-wood-mid/40 hover:text-ivory"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t-2 border-wood-mid/60 px-5 py-4">
          <p className="font-body text-[10px] uppercase tracking-widest text-ink-dim">Session</p>
          <p className="mt-0.5 flex items-center gap-2 font-body text-sm text-ivory">
            <AdminIcon size={16} className="shrink-0 text-brass" />
            <span className="truncate">{identity}</span>
          </p>
          <p className="mt-1 font-body text-[10px] text-ink-dim">
            {mockMode ? "Mock mode — data resets on reload" : "Live mode — every write is real"}
          </p>
        </div>
      </aside>

      {/* workspace */}
      <div className="flex min-h-dvh flex-col md:pl-64">
        {/* phone chrome: brand + menu, then the section icon rail */}
        <header className="border-b-2 border-wood-mid/70 bg-wood-deep md:hidden">
          <div className="flex items-center justify-between gap-2 px-3">
            <p className="flex min-h-12 items-center gap-2 truncate font-display text-base text-ivory">
              <AdminIcon size={18} className="shrink-0 text-brass" />
              <span className="truncate">
                Liar's Game <span className="text-brass">— Admin</span>
              </span>
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-btn border-2 border-ink-dim/70 px-3 font-display text-xs text-ink-dim hover:border-brass hover:text-brass"
            >
              <SettingsIcon size={16} />
              MENU
            </button>
          </div>
          <nav className="flex items-stretch gap-1 border-t-2 border-wood-mid/50 px-2 pb-2" aria-label="Admin sections">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => changeTab(id)}
                aria-label={label}
                aria-current={tab === id ? "page" : undefined}
                className={`flex min-h-12 min-w-12 flex-1 items-center justify-center rounded-btn border-2 ${
                  tab === id
                    ? "border-brass bg-brass/15 text-brass"
                    : "border-transparent text-ink-dim hover:text-ivory"
                }`}
              >
                <Icon size={20} />
              </button>
            ))}
          </nav>
        </header>

        {/* top bar — the route's h1 carries the current section */}
        <div className="border-b-2 border-wood-mid/60 bg-wood-deep/80">
          <div className="mx-auto flex w-full max-w-5xl items-end justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-body text-[10px] uppercase tracking-[0.3em] text-lamp">Back office</p>
              <h1 className="truncate font-display text-2xl text-ivory md:text-3xl">{current.label}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => void signOutOfAdmin()} className="shrink-0">
              <LogoutIcon size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
          <Panel tone="deep" className="p-4 md:p-5">
            {tab === "users" && <UsersTab />}
            {tab === "payments" && <PaymentsTab />}
            {tab === "catalog" && <CatalogTab />}
            {tab === "packs" && <PacksTab />}
            {tab === "audit" && <AuditTab />}
          </Panel>

          <p className="text-center font-body text-[10px] text-ink-dim">
            Every mutation writes an audit entry server-side ·{" "}
            {mockMode ? "mock mode — data resets on reload" : "live mode"}
          </p>
        </main>
      </div>

      {/* phone drawer — full section labels (Sheet owns the focus trap) */}
      <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Sections">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  changeTab(id);
                  setDrawerOpen(false);
                }}
                aria-current={tab === id ? "page" : undefined}
                className={`flex min-h-12 w-full items-center gap-3 rounded-btn border-2 px-3 text-left font-display text-sm ${
                  tab === id
                    ? "border-brass bg-brass/10 text-brass"
                    : "border-transparent text-ivory hover:bg-wood-mid/40"
                }`}
              >
                <Icon size={20} />
                {label}
                {tab === id ? <CheckIcon size={16} className="ml-auto" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t-2 border-wood-mid/50 pt-3 font-body text-[10px] text-ink-dim">
          session — {identity} · {mockMode ? "mock data resets on reload" : "live mode"}
        </p>
      </Sheet>
    </div>
  );
}

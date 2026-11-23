"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/AsyncSection";
import { adminListAudit, adminLogout, getApiMode } from "@/lib/api";
import { useToasts } from "@/store/ui";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { UsersTab } from "@/components/admin/UsersTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { CatalogTab } from "@/components/admin/CatalogTab";
import { PacksTab } from "@/components/admin/PacksTab";
import { AuditTab } from "@/components/admin/AuditTab";

type AdminTab = "users" | "payments" | "catalog" | "packs" | "audit";

const TAB_ITEMS: readonly { id: AdminTab; label: string; emoji: string }[] = [
  { id: "users", label: "Users", emoji: "🤠" },
  { id: "payments", label: "Payments", emoji: "🧾" },
  { id: "catalog", label: "Catalog", emoji: "🏪" },
  { id: "packs", label: "Packs", emoji: "🪙" },
  { id: "audit", label: "Audit", emoji: "📜" },
];

/**
 * /admindashboard — back office (STR/02 v1 admin). NOT behind the player
 * AuthGate: it runs its own env-credential login (POST /api/admin/login →
 * server-side lg_admin cookie). The client probes GET /api/admin/audit as
 * the session check and falls back to the login screen on 401.
 */
export function AdminDashboard() {
  const push = useToasts();
  const [phase, setPhase] = useState<"checking" | "login" | "ready">("checking");
  const [tab, setTab] = useState<AdminTab>("users");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await adminListAudit(1, 1); // session probe: 401 → login screen
        if (alive) setPhase("ready");
      } catch {
        if (alive) setPhase("login");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signOutOfAdmin = async () => {
    await adminLogout(); // best-effort: server drops the admin cookie
    push({ title: "Left the back office", tone: "info" });
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
        onAuthed={() => {
          setPhase("ready");
          setTab("users");
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="flex items-center justify-between gap-3">
        <div>
          <SectionTitle kicker="the house ledger">Admin dashboard</SectionTitle>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOutOfAdmin()}>
          EXIT
        </Button>
      </section>

      <Tabs tabs={TAB_ITEMS} active={tab} onChange={setTab} />

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
    </div>
  );
}

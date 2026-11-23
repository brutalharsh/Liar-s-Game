import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

/**
 * /admindashboard — the back office (STR/02). Own env-credential login: NOT
 * behind the player AuthGate. Full-screen shell without the site chrome.
 */
export default function AdminDashboardPage() {
  return (
    <div className="min-h-dvh px-safe pb-safe pt-safe">
      <AdminDashboard />
    </div>
  );
}

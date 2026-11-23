import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteRouteGate } from "@/components/auth/SiteRouteGate";

/** All non-game pages get the site frame: header, content, footer, tab bar. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-safe pb-16 lg:pb-0">
        <SiteRouteGate>{children}</SiteRouteGate>
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}

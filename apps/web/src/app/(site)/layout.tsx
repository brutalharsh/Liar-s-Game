import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** All non-game pages get the site frame: header, content, footer, tab bar. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-safe">{children}</main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}

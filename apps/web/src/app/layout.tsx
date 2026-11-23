import type { Metadata, Viewport } from "next";
import { Smokum, Special_Elite } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/ui/Toaster";

const smokum = Smokum({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-smokum",
  display: "swap",
});

const elite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-special-elite",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Liar's Game — bluff, call the bluff, mind the revolver",
    template: "%s · Liar's Game",
  },
  description:
    "A free 2–7 player party card game of Liar's Deck: throw cards, call liars, and pray the revolver clicks empty. Mobile + desktop web, instant invite links.",
  applicationName: "Liar's Game",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Liar's Game",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe-area insets (research/09 §7)
  themeColor: "#1d3a2a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="saloon"
      data-reduced-motion="off"
      suppressHydrationWarning
      className={`${smokum.variable} ${elite.variable}`}
    >
      <body className="min-h-dvh bg-wood-deep font-body text-ink antialiased">
        <Providers>
          {children}
          <div className="noise-overlay" aria-hidden />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

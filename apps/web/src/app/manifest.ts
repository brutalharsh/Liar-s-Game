import type { MetadataRoute } from "next";

/**
 * PWA manifest (Next.js file convention — no plugin, per research/11 §3).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liar's Game",
    short_name: "Liar's Game",
    description:
      "Bluff, call the bluff, and mind the revolver — a free 2–7 player party card game.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

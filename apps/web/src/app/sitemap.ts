import type { MetadataRoute } from "next";

/**
 * Canonical origin — mirrors robots.ts (APP_URL env; localhost keeps dev/CI
 * deterministic). Kept local so neither metadata file imports the other.
 */
const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * sitemap.xml (Next metadata file convention) — the nine public, indexable
 * routes only: marketing, how-to-play, the room browser + create/join, the
 * store, the shared boards and the profile. Game tables/lobbies, the admin
 * dashboard and the auth/billing docks are robots-disallowed and stay off
 * this list.
 */
const PUBLIC_ROUTES = [
  "/",
  "/how-to-play",
  "/rooms",
  "/join",
  "/create",
  "/login",
  "/shop",
  "/leaderboard",
  "/profile",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}

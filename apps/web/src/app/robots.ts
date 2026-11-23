import type { MetadataRoute } from "next";

/**
 * Canonical origin for absolute URLs in metadata route files. Set APP_URL in
 * the deployment/build env (root `.env` convention — same key the auth
 * callback URIs use); the localhost fallback keeps dev + CI deterministic.
 */
const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * robots.txt (Next metadata file convention). Everything player-facing is
 * indexable; the back office, per-room game surfaces (login-gated, room-code
 * scoped) and the auth/billing docks stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admindashboard", "/table", "/lobby", "/auth", "/billing"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

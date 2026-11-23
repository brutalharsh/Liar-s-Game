import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev only: proxy the REST surface to the Express server (S-A1) on :3001 so
  // cookies + OAuth redirects work same-origin. Production is same-origin
  // behind the reverse proxy — no rewrite needed there.
  ...(process.env.NODE_ENV !== "production"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:3001/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;

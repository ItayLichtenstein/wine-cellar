import type { NextConfig } from "next";

// Security headers sent with every page. See docs/security.md.
// A Content-Security-Policy is added later (stage 6), once we know every
// origin the app talks to (Supabase, fonts, images).
const securityHeaders = [
  // Don't let the browser guess file types (blocks some upload attacks).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The site may not be shown inside another site's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites only see our domain, never the full URL (share-link tokens
  // live in URLs and must not leak through the Referer header).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // We never need these device features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

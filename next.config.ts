import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// The only other origin the browser talks to: Supabase (API, realtime
// websocket, signed label-photo URLs). Fonts are self-hosted by next/font.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");

// Content-Security-Policy: what the page may load and where it may connect.
// If an attacker ever slipped a <script src> into a page, the browser would
// refuse to load it from any other site. Without nonces (Next.js guide):
// nonces would force every page to render per request, and the inline
// scripts Next.js needs are allowed with 'unsafe-inline'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Local Supabase runs on plain http, so only in production.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Security headers sent with every page. See docs/security.md.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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

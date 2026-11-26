import type { MetadataRoute } from "next";

/**
 * Lets the site be installed as an app (spec: PWA only, no app stores):
 * its own icon on the home screen, full screen, the burgundy theme.
 * No service worker yet, so nothing (and certainly no user data) is cached.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מרתף יין",
    short_name: "מרתף יין",
    description: "עוזר לך להחליט איזה בקבוק פותחים הערב",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#2a0b12",
    theme_color: "#2a0b12",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

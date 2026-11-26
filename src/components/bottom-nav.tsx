"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { MoreSheet, SavedTheme } from "./more-sheet";
import { RealtimeRefresh } from "./realtime-refresh";

// Simple line icons (24×24, stroke = text color). Emoji were used before,
// but every emoji has a different height, so the labels did not line up.
const ICONS = {
  fridge: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 7h12M9 6v2m0 5v3" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  stats: <path d="M4 20h16M7 16v-5m5 5V6m5 10v-8" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  wish: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
} as const;

// Sections of the app (spec: fridge · list · wishlist · stats · more).
// "More" is not a page link: it opens a sheet with everything else.
const ITEMS = [
  { href: "/", label: "fridge", icon: ICONS.fridge },
  { href: "/bottles", label: "list", icon: ICONS.list },
  { href: "/wishlist", label: "wishlist", icon: ICONS.wish },
  { href: "/stats", label: "stats", icon: ICONS.stats },
] as const;

/** Pages reached through "More": while on one, "More" is the active tab. */
const UNDER_MORE = ["/more", "/history", "/ai", "/guide", "/friends", "/sharing", "/settings"];

/** Setting up or editing a fridge belongs to the fridge tab, wherever it was opened from. */
const isFridgePage = (pathname: string) => pathname === "/" || pathname.startsWith("/fridges");

// Pages for signed-out visitors have no navigation.
const HIDDEN_ON = ["/login", "/privacy", "/auth", "/dev-login", "/join", "/friend-invite", "/shared", "/oauth"];

/** Bottom tab bar: within thumb reach on a phone, the usual place in mobile apps. */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useT();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) => (href === "/" ? isFridgePage(pathname) : pathname.startsWith(href));

  return (
    <>
      {/* Signed-in pages only (same rule as the navigation itself). */}
      <RealtimeRefresh />
      <SavedTheme />
      <nav
        aria-label={t.nav.main}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-muted/20 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-xl">
          {ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2 text-xs leading-none ${active ? "font-semibold text-foreground" : "text-muted"}`}
                >
                  {/* Same-size box for every icon, so all labels sit on one line. */}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 2.2 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {item.icon}
                  </svg>
                  {t.nav[item.label]}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`flex w-full flex-col items-center gap-1 py-2 text-xs leading-none ${
                UNDER_MORE.some((p) => pathname.startsWith(p)) ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                {ICONS.more}
              </svg>
              {t.nav.more}
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

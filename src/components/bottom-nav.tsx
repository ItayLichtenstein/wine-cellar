"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { LineIcon } from "./line-icon";
import { MoreSheet, SavedTheme } from "./more-sheet";
import { RealtimeRefresh } from "./realtime-refresh";

// Line icons (shared with "More"). Emoji were used before, but every emoji
// has a different height, so the labels did not line up.

// Sections of the app (spec: fridge · list · wishlist · stats · more).
// "More" is not a page link: it opens a sheet with everything else.
const ITEMS = [
  { href: "/", label: "fridge", icon: "fridge" },
  { href: "/bottles", label: "list", icon: "list" },
  { href: "/wishlist", label: "wishlist", icon: "wish" },
  { href: "/stats", label: "stats", icon: "stats" },
] as const;

/** Pages reached through "More": while on one, "More" is the active tab. */
const UNDER_MORE = ["/more", "/history", "/ai", "/guide", "/sharing", "/settings"];

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
                  <LineIcon name={item.icon} strokeWidth={active ? 2.2 : 1.7} />
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
              <LineIcon name="more" />
              {t.nav.more}
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

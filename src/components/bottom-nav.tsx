"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RealtimeRefresh } from "./realtime-refresh";

// Simple line icons (24×24, stroke = text color). Emoji were used before,
// but every emoji has a different height, so the labels did not line up.
const ICONS = {
  fridge: <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 7h12M9 6v2m0 5v3" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4m5-1v5l3 2" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  wish: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
} as const;

// Sections of the app. Stats joins this list when it is built
// (spec: fridge · list · wishlist · stats · more).
const ITEMS = [
  { href: "/", label: "מקרר", icon: ICONS.fridge },
  { href: "/bottles", label: "רשימה", icon: ICONS.list },
  { href: "/wishlist", label: "משאלות", icon: ICONS.wish },
  { href: "/history", label: "היסטוריה", icon: ICONS.history },
  { href: "/more", label: "עוד", icon: ICONS.more },
] as const;

// Pages for signed-out visitors have no navigation.
const HIDDEN_ON = ["/login", "/privacy", "/auth", "/dev-login", "/join", "/friend-invite"];

/** Bottom tab bar: within thumb reach on a phone, the usual place in mobile apps. */
export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Signed-in pages only (same rule as the navigation itself). */}
      <RealtimeRefresh />
      <nav
        aria-label="ניווט ראשי"
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
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

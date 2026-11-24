"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sections of the app. Wishlist and stats join this list when they are built
// (spec: fridge · list · wishlist · stats · more).
const ITEMS = [
  { href: "/", label: "מקרר", icon: "🍷" },
  { href: "/bottles", label: "רשימה", icon: "☰" },
  { href: "/history", label: "היסטוריה", icon: "🕘" },
  { href: "/more", label: "עוד", icon: "⋯" },
] as const;

// Pages for signed-out visitors have no navigation.
const HIDDEN_ON = ["/login", "/privacy", "/auth", "/dev-login", "/join"];

/** Bottom tab bar: within thumb reach on a phone, the usual place in mobile apps. */
export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
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
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-foreground" : "text-muted"}`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";

/** Applies the look saved on this device. Mounted on every signed-in page (with the nav). */
export function SavedTheme() {
  useEffect(() => {
    const saved = readTheme();
    if (saved !== "system") document.documentElement.dataset.theme = saved;
  }, []);
  return null;
}

type Theme = "system" | "light" | "dark";

// What "More" holds, grouped. History comes first: it is the most used.
const GROUPS: { title: string; links: { href: string; label: string; hint: string; icon: string }[] }[] = [
  {
    title: "שלנו",
    links: [
      { href: "/history", label: "היסטוריה ודירוגים", hint: "מה שתינו, מתי, ואיך היה", icon: "🍷" },
      { href: "/ai", label: "ה־AI שלכם", hint: "חיבור, טיוטות מחכות, העתקה ידנית", icon: "✨" },
      { href: "/more#fridges", label: "המקררים", hint: "הוספה, עריכה וסדר", icon: "🧊" },
    ],
  },
  {
    title: "אנשים",
    links: [
      { href: "/more#household", label: "בני הבית", hint: "מי מנהל איתכם את המרתף", icon: "🏠" },
      { href: "/more#friends", label: "חברים", hint: "מי רואה את המרתף, וקישור צפייה", icon: "🤝" },
    ],
  },
  {
    title: "עזרה וחשבון",
    links: [
      { href: "/guide", label: "מדריך למתחילים", hint: "כל מה שצריך לדעת, בחמש דקות", icon: "📖" },
      { href: "/more#account", label: "חשבון", hint: "ייצוא לאקסל, התנתקות, פרטיות", icon: "👤" },
    ],
  },
];

/**
 * "More" as a sheet that slides up from the bottom, instead of a page:
 * one tap shows every less-used place, grouped, plus the look of the app.
 * A native <dialog> gives focus handling, Esc and the backdrop for free.
 */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A tap on the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="עוד"
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex sm:mx-auto sm:max-w-xl"
    >
      <div className="flex max-h-[85dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">עוד</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="size-9 rounded-full text-xl text-muted hover:bg-surface">
            ×
          </button>
        </div>
        {GROUPS.map((group) => (
          <section key={group.title} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted">{group.title}</h3>
            <ul className="flex flex-col divide-y divide-muted/15 rounded-xl bg-surface shadow-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="text-xl" aria-hidden="true">
                      {link.icon}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{link.label}</span>
                      <span className="text-xs text-muted">{link.hint}</span>
                    </span>
                    <span className="text-muted" aria-hidden="true">
                      ←
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <ThemePicker />
      </div>
    </dialog>
  );
}

// The chosen look lives in localStorage (this device only) and in
// data-theme on <html>, which the CSS reads. A tiny store lets React read it
// without a hydration mismatch: the server always renders "system".
const THEME_EVENT = "theme-change";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function applyTheme(next: Theme) {
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  try {
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
  } catch {
    // Private mode: the choice still applies until the page is closed.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Automatic (follows the phone, the default), light, or dark (burgundy). */
function ThemePicker() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const choose = applyTheme;

  const options: { value: Theme; label: string }[] = [
    { value: "system", label: "אוטומטי" },
    { value: "light", label: "בהיר" },
    { value: "dark", label: "כהה" },
  ];
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted">מראה</h3>
      <div role="radiogroup" aria-label="מראה" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 shadow-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => choose(o.value)}
            className={`rounded-lg py-2 text-sm ${theme === o.value ? "bg-accent font-medium text-white dark:text-black" : "text-muted"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

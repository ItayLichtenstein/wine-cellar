"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { LineIcon } from "./line-icon";

type Theme = "system" | "light" | "dark";

// What "More" holds, grouped. Each row opens its own page (spec: "More" and its pages).
// Texts come from the dictionary: [label, hint] under more.links.
const GROUPS = [
  {
    title: "cellar",
    links: [
      { href: "/history", text: "history", icon: "glass" },
      { href: "/fridges", text: "fridges", icon: "fridge" },
      { href: "/labels", text: "labels", icon: "camera" },
      { href: "/ai", text: "ai", icon: "sparkle" },
    ],
  },
  { title: "people", links: [{ href: "/sharing", text: "sharing", icon: "people" }] },
  {
    title: "help",
    links: [
      { href: "/settings", text: "settings", icon: "sliders" },
      { href: "/guide", text: "guide", icon: "book" },
      { href: "/install", text: "install", icon: "phone" },
    ],
  },
] as const;

/**
 * "More" as a sheet that slides up from the bottom, instead of a page:
 * one tap shows every less-used place, grouped, plus the look of the app.
 * A native <dialog> gives focus handling, Esc and the backdrop for free.
 */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

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
      aria-label={t.more.title}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex sm:mx-auto sm:max-w-xl"
    >
      <div className="flex max-h-[85dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t.more.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="size-9 rounded-full text-xl text-muted hover:bg-surface">
            ×
          </button>
        </div>
        {GROUPS.map((group) => (
          <section key={group.title} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted">{t.more.groups[group.title]}</h3>
            <ul className="flex flex-col divide-y divide-muted/15 rounded-xl bg-surface shadow-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={onClose} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="text-accent">
                      <LineIcon name={link.icon} />
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{t.more.links[link.text][0]}</span>
                      <span className="text-xs text-muted">{t.more.links[link.text][1]}</span>
                    </span>
                    <span className="text-muted" aria-hidden="true">
                      {t.common.forward}
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
// data-theme on <html>, which the CSS reads. Dark is the default, so it is
// the absence of both. A tiny store lets React read it without a hydration
// mismatch: the server always renders "dark".
const THEME_EVENT = "theme-change";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "system" ? saved : "dark";
  } catch {
    return "dark";
  }
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function applyTheme(next: Theme) {
  const root = document.documentElement;
  if (next === "dark") delete root.dataset.theme;
  else root.dataset.theme = next;
  try {
    if (next === "dark") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
  } catch {
    // Private mode: the choice still applies until the page is closed.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Dark (burgundy, the default), light, or automatic (follows the phone). In the sheet and in settings. */
export function ThemePicker({ heading = true }: { heading?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const choose = applyTheme;

  const t = useT();
  const options: { value: Theme; label: string }[] = [
    { value: "dark", label: t.theme.dark },
    { value: "light", label: t.theme.light },
    { value: "system", label: t.theme.system },
  ];
  return (
    <section className="flex flex-col gap-1.5">
      {heading && <h3 className="text-xs font-medium text-muted">{t.settings.look}</h3>}
      <div role="radiogroup" aria-label={t.settings.look} className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 shadow-sm">
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

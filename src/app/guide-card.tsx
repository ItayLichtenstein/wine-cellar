"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LineIcon } from "@/components/line-icon";
import { useT } from "@/i18n/provider";

const KEY = "guide-card-dismissed";
const EVENT = "guide-card-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function dismiss() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Private mode: hidden until the page is reloaded.
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * "New here?" on the main screen, leading to the guide. Closing it hides it
 * on this device for good; the guide stays one tap away under "More".
 * The server renders it hidden, so a closed card never flashes in.
 */
export function GuideCard() {
  const t = useT();
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-accent/15 p-3">
      <span className="text-accent">
        <LineIcon name="book" className="size-7" />
      </span>
      <Link href="/guide" className="flex flex-1 flex-col">
        <span className="font-medium">{t.home.guideCard.title}</span>
        <span className="text-sm text-muted">
          {t.home.guideCard.text} {t.common.forward}
        </span>
      </Link>
      <button type="button" onClick={dismiss} aria-label={t.home.guideCard.dismiss} className="size-8 shrink-0 rounded-full text-lg text-muted hover:bg-surface">
        ×
      </button>
    </div>
  );
}

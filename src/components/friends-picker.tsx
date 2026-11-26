"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useT } from "@/i18n/provider";
import type { FriendEntry } from "@/lib/friend-list";

/**
 * "My friends": one button that opens a short list of friends' fridges.
 * A list rather than a tab per friend, so 20 friends don't crowd the home
 * screen. Native <details>: keyboard and screen readers work out of the box.
 */
export function FriendsPicker({ friends, currentId }: { friends: FriendEntry[]; currentId?: string }) {
  const t = useT();
  const ref = useRef<HTMLDetailsElement>(null);

  // Close on a tap outside, like a menu.
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const others = friends.filter((f) => f.id !== currentId);

  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-muted/40 px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">👥</span>
        {t.friends.mine}
        <span aria-hidden="true" className="text-xs text-muted">▾</span>
      </summary>
      <ul className="absolute end-0 z-30 mt-2 flex max-h-80 w-64 flex-col overflow-y-auto rounded-2xl bg-surface p-2 shadow-lg ring-1 ring-muted/20">
        {others.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t.friends.none}</li>}
        {others.map((f) => (
          <li key={f.id}>
            <Link
              href={`/friends/${f.id}`}
              onClick={() => ref.current && (ref.current.open = false)}
              className="block rounded-xl px-3 py-2.5 hover:bg-muted/10"
              dir="auto"
            >
              {f.title}
            </Link>
          </li>
        ))}
        <li className="mt-1 border-t border-muted/20 pt-1">
          <Link href="/sharing" className="block rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-muted/10">
            {t.friends.invite}
          </Link>
        </li>
      </ul>
    </details>
  );
}

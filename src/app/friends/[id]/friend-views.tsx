"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";

/**
 * A friend's cellar as a fridge drawing or as a searchable list – the same
 * two views as in my own cellar. Both are rendered by the server; this only
 * switches which one shows, so switching is instant.
 */
export function FriendViews({ fridge, list }: { fridge: React.ReactNode; list: React.ReactNode }) {
  const t = useT();
  const [view, setView] = useState<"fridge" | "list">("fridge");
  const options = [
    ["fridge", t.friends.viewFridge],
    ["list", t.friends.viewList],
  ] as const;
  return (
    <>
      <div role="radiogroup" aria-label={t.friends.viewLabel} className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 text-sm shadow-sm">
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={view === key}
            onClick={() => setView(key)}
            className={`rounded-lg py-2 ${view === key ? "bg-accent font-medium text-white dark:text-black" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "fridge" ? fridge : list}
    </>
  );
}

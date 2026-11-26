"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/client";

/**
 * The cellar's name. By default it is built from the household's names
 * ("המרתף של נועה ויונתן"); an editor can give it its own. Clearing the
 * field brings the automatic name back.
 */
export function CellarName({ cellarId, names, customName, canEdit }: { cellarId: string; names: string[]; customName: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(customName ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const auto = cellarTitle(names);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    const { error } = await createClient()
      .from("cellars")
      .update({ custom_name: value.trim() || null })
      .eq("id", cellarId);
    setState(error ? "failed" : "saved");
    if (!error) router.refresh();
  }

  if (!canEdit) return null;
  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">שם המרתף</span>
        <span className="flex gap-2">
          <input
            value={value}
            onChange={(e) => (setValue(e.target.value), setState("idle"))}
            placeholder={auto}
            maxLength={60}
            dir="auto"
            className="min-w-0 flex-1 rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base"
          />
          <button type="submit" disabled={state === "saving"} className="shrink-0 rounded-full border border-muted/40 px-4 py-2">
            {state === "saved" ? "נשמר ✓" : "שמירה"}
          </button>
        </span>
      </label>
      <p className="text-xs text-muted">ריק = השם האוטומטי, לפי השמות של השותפים.</p>
      {state === "failed" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          השמירה לא הצליחה. נסו שוב.
        </p>
      )}
    </form>
  );
}

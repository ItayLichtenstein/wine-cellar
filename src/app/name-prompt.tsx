"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/app/bottle/details";
import { createClient } from "@/lib/supabase/client";

/**
 * First sign-in: confirm (or type) the name household members and friends
 * will see. Google usually gives a name; if not, the placeholder "משתמש חדש"
 * is replaced here. Shown until the profile has onboarded_at.
 */
export function NamePrompt({ userId, initial }: { userId: string; initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await createClient()
      .from("profiles")
      .update({ display_name: name.trim(), onboarded_at: new Date().toISOString() })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
      <label htmlFor="display-name" className="font-medium">
        איך לקרוא לך?
      </label>
      <p className="text-sm text-muted">
        <span className="inline-block">כך יראו אותך השותפים במרתף והחברים.</span>{" "}
        <span className="inline-block">המייל שלך לא מוצג לאף אחד.</span>
      </p>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          dir="auto"
          maxLength={50}
          required
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-accent px-4 font-medium text-white disabled:opacity-60 dark:text-black">
          שמירה
        </button>
      </div>
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">השמירה לא הצליחה. נסו שוב.</p>}
    </form>
  );
}

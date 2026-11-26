"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/app/bottle/details";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/** The name partners and friends see; first set on the first sign-in, changeable here. */
export function MyName({ userId, initial }: { userId: string; initial: string }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "failed">("idle");
  const changed = name.trim() !== initial && name.trim() !== "";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!changed) return;
    setState("busy");
    const { error } = await createClient().from("profiles").update({ display_name: name.trim() }).eq("id", userId);
    setState(error ? "failed" : "saved");
    if (!error) router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label={t.settings.myName}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setState("idle");
          }}
          dir="auto"
          maxLength={50}
          required
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={!changed || state === "busy"}
          className="rounded-full border border-muted/40 px-4 text-sm disabled:opacity-50"
        >
          {t.common.save}
        </button>
      </div>
      <p className="text-xs text-muted" role="status">
        {state === "saved" ? t.account.saved : state === "failed" ? t.common.saveFailed : t.account.nameHint}
      </p>
    </form>
  );
}

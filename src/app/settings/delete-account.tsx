"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Plan = "delete_cellar" | "leave" | "last_member";

const WORD = "מחיקה";

/**
 * Deleting the account: deep in "Account", folded, and confirmed by typing
 * a word. First it says exactly what will happen (from the database, which
 * also enforces it): alone, the whole cellar goes; with others, it stays.
 */
export function DeleteAccount({ cellarId }: { cellarId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    const { data, error: e } = await createClient().rpc("account_deletion_plan");
    if (e || !data) setError("לא הצלחנו לבדוק, נסו שוב");
    else setPlan(data as Plan);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // The whole cellar goes: remove its label photos first (the storage API
    // deletes the files themselves; the database only knows their names).
    if (plan === "delete_cellar") {
      const { data: files } = await supabase.storage.from("labels").list(cellarId, { limit: 1000 });
      if (files?.length) await supabase.storage.from("labels").remove(files.map((f) => `${cellarId}/${f.name}`));
    }
    const { error: e } = await supabase.rpc("delete_my_account");
    if (e) {
      setBusy(false);
      setError(e.hint === "last_member" ? "אתם השותפים היחידים ויש צופים במרתף. הפכו מישהו לשותף או הסירו את הצופים, ונסו שוב" : "המחיקה לא הצליחה, נסו שוב");
      return;
    }
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <details className="rounded-xl border border-red-300/40 p-3 text-sm">
      <summary onClick={() => !plan && open()} className="cursor-pointer font-medium text-red-700 dark:text-red-400">
        מחיקת החשבון
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {plan === "delete_cellar" && (
          <p>
            <span className="inline-block">אתם היחידים במרתף, ולכן הוא יימחק יחד עם החשבון,</span>{" "}
            <span className="inline-block">כולל המקררים, הבקבוקים, ההיסטוריה, ה־Wishlist, החברים והתמונות.</span>{" "}
            <span className="inline-block font-medium">אי אפשר לשחזר, אז כדאי לייצא קודם לקובץ</span>
          </p>
        )}
        {plan === "leave" && (
          <p>
            <span className="inline-block">המרתף נשאר אצל שאר השותפים, עם כל הבקבוקים וההיסטוריה.</span>{" "}
            <span className="inline-block">יימחקו השם שלכם, החברות שלכם במרתף והציונים האישיים שלכם, ואי אפשר לשחזר אותם</span>
          </p>
        )}
        {plan === "last_member" && (
          <p>
            <span className="inline-block">אתם השותפים היחידים, ויש צופים במרתף.</span>{" "}
            <span className="inline-block">קודם הפכו מישהו לשותף או הסירו את הצופים (ב״שיתוף״)</span>
          </p>
        )}
        {(plan === "delete_cellar" || plan === "leave") && (
          <>
            <label className="flex flex-col gap-1">
              <span>
                כדי לאשר, כתבו <b>{WORD}</b>:
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={remove}
              disabled={typed.trim() !== WORD || busy}
              className="self-start rounded-full bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-red-500"
            >
              {busy ? "מוחק…" : "למחוק את החשבון לצמיתות"}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}

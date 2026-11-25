"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/app/bottle/details";
import { createClient } from "@/lib/supabase/client";
import { linkLabel } from "@/lib/wine-extra";

export type Wish = { id: string; winery: string; name: string; year: number | null; note: string; link: string; source: string };

export function Wishlist({ wishes, canEdit }: { wishes: Wish[]; canEdit: boolean }) {
  const router = useRouter();
  const [winery, setWinery] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const y = year.trim() ? Number(year) : null;
    if (y !== null && !(Number.isInteger(y) && y >= 1900 && y <= 2100)) return setError("שנת בציר לא תקינה.");
    if (link.trim() && !linkLabel(link.trim())) return setError("הקישור צריך להתחיל ב־https://");
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("add_to_wishlist", {
      p_winery: winery,
      p_name: name,
      p_year: y ?? undefined,
      p_note: note,
      p_link: link,
    });
    setBusy(false);
    if (e) return setError("לא הצלחנו להוסיף. נסו שוב.");
    setWinery("");
    setName("");
    setYear("");
    setNote("");
    setLink("");
    router.refresh();
  }

  async function remove(id: string) {
    const { error: e } = await createClient().from("wishlist_items").delete().eq("id", id);
    if (e) return setError("המחיקה לא הצליחה.");
    router.refresh();
  }

  return (
    <>
      {wishes.length === 0 ? (
        <p className="text-muted">
          <span className="inline-block">יינות שרוצים לקנות או לטעום.</span>{" "}
          <span className="inline-block">אפשר להוסיף כאן, או לסמן ״לקנות שוב״ כשמסמנים ששתיתם בקבוק.</span>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
          {wishes.map((w) => (
            <li key={w.id} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-baseline justify-between gap-2">
                <span dir="auto" className="min-w-0">
                  {w.winery} – {w.name}
                </span>
                <span className="shrink-0 text-sm text-muted tabular-nums">{w.year ?? "כל בציר"}</span>
              </span>
              {w.note && <span className="text-sm" dir="auto">{w.note}</span>}
              {w.source && <span className="text-xs text-muted" dir="auto">{w.source}</span>}
              <span className="flex flex-wrap gap-4 text-sm">
                {canEdit && (
                  <Link href={`/bottles/new?wish=${w.id}`} className="font-medium underline underline-offset-2">
                    קניתי
                  </Link>
                )}
                {w.link && linkLabel(w.link) && (
                  <a href={w.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {linkLabel(w.link)}
                  </a>
                )}
                {canEdit && (
                  <button type="button" onClick={() => remove(w.id)} className="text-muted underline underline-offset-2">
                    הסרה
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Viewers read only (spec); RLS would refuse anyway. */}
      {canEdit && (
        <form onSubmit={add} className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-sm">
          <h2 className="font-semibold">הוספה לרשימה</h2>
          <div className="grid grid-cols-2 gap-2">
            <input value={winery} onChange={(e) => setWinery(e.target.value)} placeholder="יקב" dir="auto" maxLength={120} required aria-label="יקב" className={inputClass} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם היין" dir="auto" maxLength={120} required aria-label="שם היין" className={inputClass} />
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="בציר (ריק = כל בציר)" inputMode="numeric" maxLength={4} aria-label="בציר" className={inputClass} />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="קישור (לא חובה)" type="url" dir="ltr" maxLength={500} aria-label="קישור" className={inputClass} />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה (לא חובה)" dir="auto" maxLength={500} aria-label="הערה" className={inputClass} />
          <button type="submit" disabled={busy} className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:text-black">
            {busy ? "מוסיף…" : "הוספה"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { toCsv } from "@/lib/csv";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/**
 * Downloads the whole cellar as a CSV file, built in the browser from the
 * user's own cellar. Nothing is sent anywhere.
 */
export function ExportButton({ cellarId }: { cellarId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function exportCsv() {
    setBusy(true);
    setFailed(false);
    const { data, error } = await createClient()
      .from("bottles")
      .select(
        "status, added_on, consumed_on, note, link_url, bottle_prices(paid, regular, is_gift), wine_vintages(year, drink_from, drink_to, peak_from, peak_to, alcohol, wines(winery, name, type, grape, country, region, kosher))",
      )
      .eq("cellar_id", cellarId)
      .order("added_on");
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }

    const rows = data.map((b) => {
      const v = b.wine_vintages;
      const w = v?.wines;
      const p = (Array.isArray(b.bottle_prices) ? b.bottle_prices[0] : b.bottle_prices) as
        | { paid: number | null; regular: number | null; is_gift: boolean }
        | null
        | undefined;
      return [
        w?.winery ?? "", w?.name ?? "", w?.type ?? "", v?.year ?? "NV", t.account.csvStatus[b.status] ?? b.status,
        w?.grape ?? "", w?.country ?? "", w?.region ?? "", v?.alcohol ?? null,
        v?.drink_from ?? null, v?.drink_to ?? null, v?.peak_from ?? null, v?.peak_to ?? null,
        p?.paid ?? null, p?.regular ?? null, p?.is_gift ? t.account.yes : "",
        w?.kosher === "yes" ? t.account.yes : w?.kosher === "no" ? t.account.no : "",
        b.added_on, b.consumed_on ?? "", b.note ?? "", b.link_url ?? "",
      ];
    });
    const csv = toCsv(
      t.account.csvHeaders,
      rows,
    );

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wine-cellar-${new Date().toLocaleDateString("en-CA")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={exportCsv} disabled={busy} className="self-start rounded-full border border-muted/40 px-4 py-2 text-sm disabled:opacity-60">
        {busy ? t.account.preparing : t.account.exportCsv}
      </button>
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t.account.exportFailed}</p>}
    </div>
  );
}

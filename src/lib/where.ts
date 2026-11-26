import { dictionaries } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";

/** Where a bottle is, in words: "מדף 3", "מחוץ למקרר". Shared by the app's list and the guest page. */
export function whereLabel(status: "stored" | "unplaced" | "in_transit", shelf: number | null | undefined, locale: Locale): string {
  const w = dictionaries[locale].where;
  if (status === "stored") return shelf ? w.shelf(shelf) : w.inFridge;
  return w[status];
}

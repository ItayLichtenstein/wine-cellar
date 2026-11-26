/** The languages the interface speaks. Hebrew is the default (spec). */
export const LOCALES = ["he", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "he";

/** The cookie that remembers the choice (per browser, no account needed). */
export const LOCALE_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** A cookie value we did not write (or none) falls back to Hebrew. */
export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Writing direction: Hebrew right to left, English left to right. */
export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

/** For Intl date/number formatting (day-month order in both). */
export function intlTag(locale: Locale): string {
  return locale === "he" ? "he-IL" : "en-GB";
}

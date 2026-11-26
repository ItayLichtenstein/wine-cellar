"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./locales";

/**
 * Remembers the chosen language in a cookie for a year. A public endpoint
 * like every Server Action, but it only writes the caller's own cookie, and
 * only one of the known values.
 */
export async function setLanguage(locale: unknown): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

import { cookies } from "next/headers";
import { cache } from "react";
import { dictionaries } from "./dictionaries";
import { LOCALE_COOKIE, toLocale, type Locale } from "./locales";

/**
 * The visitor's language, from the `lang` cookie. Reading a cookie makes the
 * caller dynamic, so it must run inside <Suspense> (Cache Components).
 * cache(): read once per request, however many components ask.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  return toLocale(jar.get(LOCALE_COOKIE)?.value);
});

/** The texts for a Server Component: `const t = await getT(); t.nav.fridge`. */
export async function getT() {
  return dictionaries[await getLocale()];
}

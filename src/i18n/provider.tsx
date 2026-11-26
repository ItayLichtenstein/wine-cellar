"use client";

import { createContext, useContext, useEffect } from "react";
import { dictionaries, type Dictionary } from "./dictionaries";
import { dirOf, type Locale } from "./locales";

const LocaleContext = createContext<Locale>("he");

/**
 * Gives Client Components the language (like a value every component can
 * read without passing it down). It also sets the writing direction: on a
 * wrapper right away, and on <html> once the page is running.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  // <html> is drawn before the cookie is read (it is part of the static
  // shell), so it starts as Hebrew; this corrects it for English. The
  // wrapper below already has the right direction, so nothing jumps.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);
  return (
    <LocaleContext value={locale}>
      {/* display: contents – no box of its own, the page layout is unchanged. */}
      <div lang={locale} dir={dirOf(locale)} className="contents">
        {children}
      </div>
    </LocaleContext>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The texts for a Client Component: `const t = useT(); t.nav.fridge`. */
export function useT(): Dictionary {
  return dictionaries[useLocale()];
}

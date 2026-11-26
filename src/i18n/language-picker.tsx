"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "./actions";
import { LOCALES } from "./locales";
import { useLocale, useT } from "./provider";

/** Hebrew / English, like the look picker. The page redraws in the new language. */
export function LanguagePicker() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="radiogroup" aria-label={t.settings.language} className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 shadow-sm">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={l}
          aria-checked={locale === l}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLanguage(l);
              router.refresh();
            })
          }
          className={`rounded-lg py-2 text-sm ${locale === l ? "bg-accent font-medium text-white dark:text-black" : "text-muted"}`}
        >
          {t.language[l]}
        </button>
      ))}
    </div>
  );
}

import type { Locale } from "@/i18n/locales";

// Zone names are stored with the fridge, in Hebrew (they were written when
// the fridge was set up). In English the known ones are shown translated;
// a name someone typed themselves is shown as it is.
const EN: Record<string, string> = {
  "אחורי": "Back",
  "קדמי": "Front",
  "שורה": "Row",
  "בחזית": "Across the front",
  "שכבה עליונה": "Top layer",
  "שכבה תחתונה": "Bottom layer",
  "בקבוקים עומדים": "Standing bottles",
  "ערימה ימנית": "Right pile",
  "ערימה שמאלית": "Left pile",
  "ערימה אחורית": "Back pile",
  "ערימה קדמית": "Front pile",
};

export function zoneLabel(label: string, locale: Locale): string {
  return locale === "en" ? (EN[label] ?? label) : label;
}

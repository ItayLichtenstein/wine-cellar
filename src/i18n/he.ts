/**
 * Hebrew texts: the source dictionary. Every other language has the same
 * shape (TypeScript checks it), so a key missing in English fails the build.
 * Grouped by screen. A text with a number in it is a small function.
 */
export const he = {
  nav: {
    main: "ניווט ראשי",
    fridge: "מקרר",
    list: "רשימה",
    wishlist: "Wishlist",
    stats: "סטטיסטיקות",
    more: "עוד",
  },
  settings: {
    title: "הגדרות",
    back: "המקרר",
    loading: "טוען…",
    myName: "השם שלי",
    look: "מראה",
    language: "שפה",
    myData: "הנתונים שלי",
    privacy: "מדיניות הפרטיות",
    account: "חשבון",
  },
  theme: {
    system: "אוטומטי",
    light: "בהיר",
    dark: "כהה",
  },
  language: {
    he: "עברית",
    en: "English",
  },
};

export type Dictionary = typeof he;

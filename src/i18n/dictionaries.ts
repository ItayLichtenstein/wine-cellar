import { en } from "./en";
import { he, type Dictionary } from "./he";
import type { Locale } from "./locales";

// Both dictionaries are small text, so they are imported, not loaded on demand.
export const dictionaries: Record<Locale, Dictionary> = { he, en };
export type { Dictionary };

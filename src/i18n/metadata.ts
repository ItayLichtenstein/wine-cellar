import type { Metadata } from "next";
import type { Dictionary } from "./dictionaries";
import { getT } from "./server";

/**
 * A page's browser-tab title in the visitor's language: "Settings · Wine Cellar".
 * Reading the language cookie defers the metadata to request time, which is
 * fine here: every page already waits for it inside the root layout.
 * Usage: `export const generateMetadata = pageTitle((t) => t.titles.settings);`
 */
export function pageTitle(pick: (t: Dictionary) => string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: `${pick(t)} · ${t.titles.app}` };
  };
}

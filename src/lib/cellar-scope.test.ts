import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture test (like ArchUnit in Java): once friends exist, RLS lets a
 * user read friends' cellars too, so a list query without a cellar filter
 * would mix a friend's bottles into "my" fridge (ADR 0008).
 * Rule: every read of cellar data filters by cellar_id, or reads specific
 * rows by id / wine_id / user_id (ids that came from an already-scoped page).
 */
const CELLAR_TABLES = [
  "fridges", "shelves", "shelf_zones", "wines", "wine_vintages", "critic_scores", "bottles",
  "bottle_prices", "ratings", "tastings", "wishlist_items", "cellar_members", "cellar_invites",
  "friend_invites", "share_links",
];
const SCOPED = /\.eq\("(cellar_id|user_id|id|wine_id|wine_vintages\.wine_id)"|\.in\("id"/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

describe("cellar scope", () => {
  it("every read of cellar data says which cellar (or which rows) it wants", () => {
    const unscoped: string[] = [];
    const from = new RegExp(`\\.from\\("(${CELLAR_TABLES.join("|")})"\\)`, "g");
    for (const file of sourceFiles("src")) {
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(from)) {
        // The query chain runs until the end of the statement or the next query.
        const rest = code.slice(m.index);
        const end = rest.search(/;|\n\s*(supabase|createClient\(\))\s*\n?\s*\.from\(|,\n\s+supabase/);
        const chain = rest.slice(0, end === -1 ? undefined : end);
        if (chain.includes(".select(") && !SCOPED.test(chain)) {
          unscoped.push(`${file}:${code.slice(0, m.index).split("\n").length} ${m[1]}`);
        }
      }
    }
    expect(unscoped).toEqual([]);
  });
});

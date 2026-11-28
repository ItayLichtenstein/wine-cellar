// One row per connected AI (pure, so it is tested; ai-grants.ts reads the grants).

import type { AiKey } from "./ai-providers";

export type ConnectedAi = {
  /** Usually one. Reconnecting the same AI can register it again as a new client: one row for both. */
  clientIds: string[];
  name: string;
  key: AiKey | null;
  since: string;
  /** "Helps manage the cellar" (ADR 0013); otherwise it only suggests drafts. */
  canEdit: boolean;
};

/**
 * One row per AI: grants of the same known AI (Gemini registered twice after
 * a reconnect) become one, from the earliest date, and it "helps manage the
 * cellar" only if every one of them does. Unknown AIs stay apart.
 */
export function mergeSameAi(rows: ConnectedAi[]): ConnectedAi[] {
  const out: ConnectedAi[] = [];
  for (const r of rows) {
    const same = r.key ? out.find((o) => o.key === r.key) : undefined;
    if (!same) {
      out.push({ ...r, clientIds: [...r.clientIds] });
      continue;
    }
    same.clientIds.push(...r.clientIds);
    if (r.since < same.since) same.since = r.since;
    same.canEdit = same.canEdit && r.canEdit;
  }
  return out;
}

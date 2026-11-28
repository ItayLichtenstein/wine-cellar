import { createClient } from "@/lib/supabase/server";
import { aiDisplayName, identifyAi } from "./ai-providers";
import { mergeSameAi, type ConnectedAi } from "./ai-merge";

export type { ConnectedAi } from "./ai-merge";

/**
 * The AI assistants the signed-in user approved on the consent screen
 * (Supabase's OAuth server keeps the grants). Empty when the project has no
 * OAuth server yet, so the page shows the "not connected" state.
 */
export async function getConnectedAis(): Promise<ConnectedAi[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: edits }] = await Promise.all([
    supabase.auth.oauth.listGrants(),
    supabase.from("ai_edit_grants").select("client_id"),
  ]);
  if (error || !data) return [];
  const editing = new Set((edits ?? []).map((e) => e.client_id));
  return mergeSameAi(
    data.map((g) => {
      const name = g.client.name || "AI";
      return { clientIds: [g.client.id], name: aiDisplayName(name), key: identifyAi(name), since: g.granted_at, canEdit: editing.has(g.client.id) };
    }),
  );
}

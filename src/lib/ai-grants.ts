import { createClient } from "@/lib/supabase/server";
import { identifyAi, type AiKey } from "./ai-providers";

export type ConnectedAi = {
  clientId: string;
  name: string;
  key: AiKey | null;
  since: string;
};

/**
 * The AI assistants the signed-in user approved on the consent screen
 * (Supabase's OAuth server keeps the grants). Empty when the project has no
 * OAuth server yet, so the page shows the "not connected" state.
 */
export async function getConnectedAis(): Promise<ConnectedAi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error || !data) return [];
  return data.map((g) => {
    const name = g.client.name || "AI";
    return {
      clientId: g.client.id,
      name,
      key: identifyAi(name),
      since: g.granted_at,
    };
  });
}

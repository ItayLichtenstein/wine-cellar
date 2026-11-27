import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Where a label photo the AI found is stored: `<cellar>/web-<uuid>.webp` (see web-image.ts). */
export const WEB_IMAGE_PATH = /^[0-9a-f-]{36}\/web-[0-9a-f-]{36}\.webp$/;

/**
 * Gives the wine of a just-added bottle the photo the AI found, unless the
 * wine already has one (never replace a photo the user took). The fridge
 * thumbnail is made later in the browser (LabelThumbBackfill).
 */
export async function attachDraftImage(db: SupabaseClient<Database>, bottleId: string, image: string): Promise<void> {
  if (!image) return;
  const { data } = await db.from("bottles").select("wine_vintages(wine_id)").eq("id", bottleId).single();
  const wineId = data?.wine_vintages?.wine_id;
  if (!wineId) return;
  await db.from("wines").update({ label_image_path: image }).eq("id", wineId).is("label_image_path", null);
}

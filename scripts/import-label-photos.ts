/**
 * Imports the label photos from the old app's export into the "labels"
 * bucket, after the cellar itself was imported (scripts/import-old-app.ts).
 *
 *   node --experimental-strip-types scripts/import-label-photos.ts <export.html>
 *
 * - Matches photos to wines by winery + name (a label belongs to the wine).
 * - Strips EXIF/GPS and comments from every JPEG before upload.
 * - Skips wines that already have a photo, so running it twice is safe.
 * - Signs in as a user (default: the local test user), so RLS applies.
 * - Prints counts only: the export holds personal data.
 */
import { readFileSync } from "node:fs";
import { stripJpegMetadata } from "../src/lib/jpeg-metadata.ts";
import { connect } from "./import-target.ts";

type OldBottle = { winery?: string; name?: string; labels?: string[] };
type Snapshot = { bottles: OldBottle[]; img?: Record<string, string> };

const key = (winery = "", name = "") => `${winery.trim().toLowerCase()}|${name.trim().toLowerCase()}`;

function readSnapshot(path: string): Snapshot {
  const html = readFileSync(path, "utf8");
  const marker = "window.CELLAR_SNAPSHOT=";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Not an export file: CELLAR_SNAPSHOT not found");
  const end = html.indexOf("</script>", start);
  return JSON.parse(html.slice(start + marker.length, end).trim().replace(/;$/, ""));
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: node --experimental-strip-types scripts/import-label-photos.ts <export.html>");
  const snap = readSnapshot(file);

  const { supabase, where } = await connect();
  console.log(`Importing into: ${where}`);

  // First photo of each wine in the old app.
  const photoOf = new Map<string, string>();
  for (const b of snap.bottles) {
    const hash = b.labels?.[0];
    if (hash && snap.img?.[hash] && !photoOf.has(key(b.winery, b.name))) photoOf.set(key(b.winery, b.name), snap.img[hash]);
  }

  // Own cellar only: RLS also lets you read friends' wines, never theirs to change.
  const { data: cellarId } = await supabase.rpc("my_cellar_id");
  const { data: wines, error } = await supabase
    .from("wines")
    .select("id, cellar_id, winery, name, label_image_path")
    .eq("cellar_id", cellarId);
  if (error) throw new Error("Could not read wines");

  let uploaded = 0, skipped = 0, failed = 0;
  for (const w of wines) {
    const dataUrl = photoOf.get(key(w.winery, w.name));
    if (!dataUrl || w.label_image_path) {
      skipped++;
      continue;
    }
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
      failed++;
      continue;
    }
    const jpeg = stripJpegMetadata(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    const path = `${w.cellar_id}/${w.id}-${Date.now()}.jpg`;
    const { error: upError } = await supabase.storage.from("labels").upload(path, jpeg, { contentType: "image/jpeg" });
    const { error: dbError } = upError
      ? { error: upError }
      : await supabase.from("wines").update({ label_image_path: path }).eq("id", w.id);
    if (dbError) failed++;
    else uploaded++;
  }
  console.log(`Photos in export: ${photoOf.size} wines · uploaded: ${uploaded} · skipped: ${skipped} · failed: ${failed}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Import failed");
  process.exit(1);
});

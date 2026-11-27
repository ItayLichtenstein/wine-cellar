// Downloads the label photos people took into a folder, for the nightly
// backup (docs/backup.md). Photos an AI fetched from the web
// (`<cellar>/web-<uuid>.webp`) are skipped: their source link is kept on
// the file (metadata.source), so they can be fetched again.
//
// Plain fetch against the Storage REST API, no packages, so CI needs no
// `npm ci`. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (CI secret
// only; never in the browser or in git).
//
//   node --experimental-strip-types scripts/backup-labels.ts <out dir>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const out = process.argv[2];
if (!url || !key || !out) {
  console.error("Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and an output folder");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, apikey: key };
const BUCKET = "labels";

type Entry = { name: string; id: string | null };

async function list(prefix: string): Promise<Entry[]> {
  const all: Entry[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status}`);
    const page = (await res.json()) as Entry[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

let saved = 0;
let skipped = 0;
// Two levels: <cellar id>/<file>. A folder has id null.
for (const folder of await list("")) {
  if (folder.id !== null) continue;
  for (const file of await list(`${folder.name}/`)) {
    if (file.id === null) continue;
    if (file.name.startsWith("web-")) {
      skipped++;
      continue;
    }
    const path = `${folder.name}/${file.name}`;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers });
    if (!res.ok) throw new Error(`download ${path}: ${res.status}`);
    const target = join(out, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    saved++;
  }
}
console.log(`label photos: ${saved} saved, ${skipped} AI photos from the web skipped`);

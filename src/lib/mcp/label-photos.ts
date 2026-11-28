// Label photos an AI found on the web (ADR 0013): shared by suggest_bottles
// (new bottles) and set_label_photo (wines already in the cellar). The AI
// gives a link and says how well the photo matches; the server fetches it
// safely and keeps the link and the match on the file (storage metadata),
// so the nightly backup can skip it and fetch it again.

import { z } from "zod";
import type { Db } from "../fridges";
import { LABEL_BUCKET } from "../label-image";
import { fetchLabelImage } from "../web-image";

export const IMAGE_MATCHES = ["exact", "other_vintage", "similar"] as const;
export type ImageMatch = (typeof IMAGE_MATCHES)[number];

export const imageMatchSchema = z
  .enum(IMAGE_MATCHES)
  .optional()
  .describe(
    "How well the photo at image_url matches: exact = this wine and vintage; other_vintage = the same wine, another vintage; similar = this winery's same wine, but not sure the label looks the same. A photo of a different wine would mislead the user, so it is better to leave that one without a photo. Be honest: the reply tells you what to say to the user.",
  );

/** Where the user can see every wine without a photo, and replace a web photo with their own. */
export const labelsPage = (siteUrl: string) => `${siteUrl}/labels`;

export type SavedLabel = { ok: true; path: string } | { ok: false; reason: string };

/** Fetches the photo from the link and stores it in the cellar's folder as `web-<uuid>.webp`. */
export async function saveWebLabel(db: Db, cellarId: string, link: string, match: ImageMatch): Promise<SavedLabel> {
  const img = await fetchLabelImage(link);
  if (!img.ok) return { ok: false, reason: img.reason };
  // "web-": the nightly backup skips it; the source link (metadata) can fetch it again.
  const path = `${cellarId}/web-${crypto.randomUUID()}.webp`;
  const { error } = await db.storage.from(LABEL_BUCKET).upload(path, img.webp, { contentType: "image/webp", metadata: { source: link, match } });
  return error ? { ok: false, reason: "storage error" } : { ok: true, path };
}

/** One line for the tool reply about a saved photo: what to tell the user when it is not an exact match. */
export function savedNote(who: string, match: ImageMatch, siteUrl: string): string {
  if (match === "exact") return `${who}: label image saved (tell the user it is a photo from the web, and they can replace it with their own on the bottle's card).`;
  const what = match === "other_vintage" ? "a photo of another vintage of this wine" : "a photo you are not sure is this exact label";
  return `${who}: label image saved, but it is ${what}. Tell the user plainly (e.g. "I only found the 2022 label, not the 2021, so I used it"), and that they can keep it or replace it with their own photo on the bottle's card or at ${labelsPage(siteUrl)}.`;
}

/** The closing line when some wines are left without a photo. */
export function missingNote(count: number, siteUrl: string): string {
  return count
    ? `${count} wine(s) have no label photo now. Before telling the user, try once more for each with set_label_photo and another source (the winery's own site, Vivino, or another shop; some shops block downloads). Then tell the user which are still missing and that they can take the photos themselves at ${labelsPage(siteUrl)} (every wine without a photo, one tap each).`
    : "";
}

/** How many of these wines are in the cellar with no label photo (after adding them). */
export async function countMissing(db: Db, cellarId: string, wines: { winery: string; name: string }[]): Promise<number> {
  if (wines.length === 0) return 0;
  const { data } = await db.from("wines").select("winery, name").eq("cellar_id", cellarId).is("label_image_path", null);
  const key = (w: { winery: string; name: string }) => `${w.winery.toLowerCase()}|${w.name.toLowerCase()}`;
  const wanted = new Set(wines.map(key));
  return (data ?? []).filter((w) => wanted.has(key(w))).length;
}

/** Where a wine's label photo came from: none, the user's own, or an AI's find on the web. */
export function labelKind(path: string | null): "none" | "own" | "web" {
  return !path ? "none" : path.includes("/web-") ? "web" : "own";
}

/** A line per matching wine for wine_details, so the AI knows which photos exist and where they came from. */
export function formatLabelPhotos(wines: { winery: string; name: string; label_image_path: string | null }[], query: string, siteUrl: string): string {
  const q = query.trim().toLowerCase();
  const hits = wines.filter((w) => `${w.winery} ${w.name}`.toLowerCase().includes(q));
  if (hits.length === 0) return "";
  const say = { none: "none yet (set_label_photo, or the user takes it at " + labelsPage(siteUrl) + ")", own: "the user's own photo", web: "from the web (found by an AI; may be another vintage)" };
  return ["", "Label photo:", ...hits.slice(0, 10).map((w) => `${w.winery} – ${w.name}: ${say[labelKind(w.label_image_path)]}`)].join("\n");
}

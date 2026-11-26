"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { ACCEPTED_TYPES, LABEL_BUCKET, labelPath, makeThumb, reencode } from "@/lib/label-image";
import { createClient } from "@/lib/supabase/client";

/**
 * The wine's label photo on the bottle card: show it, take or replace it.
 * The bucket is private, so the image is shown through a signed URL that
 * expires after an hour (useless if it leaks later).
 */
export function LabelPhoto({
  wineId,
  cellarId,
  path,
  canEdit,
}: {
  wineId: string;
  cellarId: string;
  path: string | null;
  canEdit: boolean;
}) {
  const t = useT();
  const [current, setCurrent] = useState(path);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    createClient()
      .storage.from(LABEL_BUCKET)
      .createSignedUrl(current, 3600)
      .then(({ data }) => !cancelled && setUrl(data?.signedUrl ?? null));
    return () => {
      cancelled = true;
    };
  }, [current]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await reencode(file);
      const supabase = createClient();
      const newPath = labelPath(cellarId, wineId, Date.now(), blob.type);
      const { error: upError } = await supabase.storage
        .from(LABEL_BUCKET)
        .upload(newPath, blob, { contentType: blob.type });
      if (upError) throw upError;
      // The fridge shows this one. If it fails the photo still saves; the
      // home page makes the thumbnail later (LabelThumbBackfill).
      const thumb = await makeThumb(blob).catch(() => null);
      const { error: dbError } = await supabase.from("wines").update({ label_image_path: newPath, label_thumb: thumb }).eq("id", wineId);
      if (dbError) throw dbError;
      if (current) await supabase.storage.from(LABEL_BUCKET).remove([current]); // the old photo is no longer used
      setUrl(null);
      setCurrent(newPath);
    } catch (e) {
      setError(e instanceof Error && e.message === "type" ? t.bottle.photo.badType : t.bottle.photo.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {current && url && (
        // A signed, short-lived URL – next/image would try to cache it, so a plain img.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={t.bottle.photo.alt} className="max-h-56 rounded-lg object-contain shadow-sm" />
      )}
      {canEdit && (
        <label className="cursor-pointer text-sm underline underline-offset-2">
          {busy ? t.bottle.photo.uploading : current ? t.bottle.photo.replace : t.bottle.photo.take}
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            capture="environment"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

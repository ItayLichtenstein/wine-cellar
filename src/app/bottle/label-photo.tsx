"use client";

import { useEffect, useState } from "react";
import { ACCEPTED_TYPES, LABEL_BUCKET, labelPath, reencode } from "@/lib/label-image";
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
      const newPath = labelPath(cellarId, wineId);
      const { error: upError } = await supabase.storage
        .from(LABEL_BUCKET)
        .upload(newPath, blob, { contentType: "image/webp" });
      if (upError) throw upError;
      const { error: dbError } = await supabase.from("wines").update({ label_image_path: newPath }).eq("id", wineId);
      if (dbError) throw dbError;
      if (current) await supabase.storage.from(LABEL_BUCKET).remove([current]); // the old photo is no longer used
      setUrl(null);
      setCurrent(newPath);
    } catch (e) {
      setError(e instanceof Error && e.message === "type" ? "אפשר להעלות רק JPEG, PNG או WebP." : "ההעלאה לא הצליחה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {current && url && (
        // A signed, short-lived URL – next/image would try to cache it, so a plain img.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="תווית היין" className="max-h-56 rounded-lg object-contain shadow-sm" />
      )}
      {canEdit && (
        <label className="cursor-pointer text-sm underline underline-offset-2">
          {busy ? "מעלה…" : current ? "החלפת תמונת התווית" : "📷 צילום התווית"}
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

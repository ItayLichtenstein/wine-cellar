"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LABEL_BUCKET, makeThumb } from "@/lib/label-image";
import { createClient } from "@/lib/supabase/client";

/**
 * Photos that came in before thumbnails existed (or from the import script,
 * which runs without a canvas) get one here, once: download the photo, shrink
 * it in the browser, save it on the wine. Runs quietly for editors on the
 * home page; when done, the fridge refreshes and shows the labels.
 */
export function LabelThumbBackfill({ cellarId }: { cellarId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: wines } = await supabase
        .from("wines")
        .select("id, label_image_path")
        .eq("cellar_id", cellarId)
        .not("label_image_path", "is", null)
        .is("label_thumb", null)
        .limit(200);
      if (!wines?.length) return;
      let done = 0;
      for (const w of wines) {
        if (cancelled) return;
        try {
          const { data: file } = await supabase.storage.from(LABEL_BUCKET).download(w.label_image_path!);
          if (!file) continue;
          const thumb = await makeThumb(file);
          const { error } = await supabase.from("wines").update({ label_thumb: thumb }).eq("id", w.id);
          if (!error) done++;
        } catch {
          // One bad photo should not stop the rest; it is retried next visit.
        }
      }
      if (done && !cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [cellarId, router]);

  return null;
}

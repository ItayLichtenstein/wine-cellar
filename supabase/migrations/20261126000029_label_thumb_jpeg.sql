-- =====================================================================
-- Safari (iPhone and Mac) cannot write WebP from a canvas, so its label
-- thumbnails are JPEG. Accept both; still never a URL, never SVG.
-- =====================================================================

alter table public.wines drop constraint wines_label_thumb_check;
alter table public.wines add constraint wines_label_thumb_check
  check (label_thumb is null
         or (char_length(label_thumb) <= 20000
             and (label_thumb like 'data:image/webp;base64,%' or label_thumb like 'data:image/jpeg;base64,%')));

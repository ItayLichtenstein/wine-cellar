-- =====================================================================
-- Sharper label thumbnails in the fridge: 144×192 (3× the phone slot)
-- instead of 96×128, so the label can be read. A bigger picture needs a
-- higher size cap. Old thumbnails are cleared so the home page remakes
-- them from the full photo (LabelThumbBackfill); the photos stay.
-- =====================================================================

alter table public.wines drop constraint wines_label_thumb_check;
alter table public.wines add constraint wines_label_thumb_check
  check (label_thumb is null
         or (char_length(label_thumb) <= 40000
             and (label_thumb like 'data:image/webp;base64,%' or label_thumb like 'data:image/jpeg;base64,%')));

update public.wines set label_thumb = null
  where label_thumb is not null and label_image_path is not null;

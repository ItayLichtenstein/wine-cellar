-- =====================================================================
-- A tiny thumbnail of the label photo, for the fridge drawing.
-- The full photo (~150KB) lives in the private bucket behind a signed URL;
-- 82 of those per fridge would be ~12MB on a phone, and signed URLs change
-- on every load so the browser cannot cache them. A 96×128 WebP is ~4KB,
-- small enough to sit in the row as a data: URL and come with the query,
-- under the same RLS as the wine itself (members and friends, never guests).
-- =====================================================================

alter table public.wines
  add column label_thumb text
  check (label_thumb is null
         or (char_length(label_thumb) <= 20000 and label_thumb like 'data:image/webp;base64,%'));

-- =====================================================================
-- Label photos: a PRIVATE storage bucket, one folder per cellar.
--
-- Path: <cellar_id>/<wine_id>-<timestamp>.webp
-- - private bucket: no public URLs; the app shows a photo through a
--   short-lived signed URL, created for a signed-in member only.
-- - JPEG/PNG/WebP only (no SVG – it can carry scripts), at most 1 MB.
--   The browser re-encodes every photo before upload, which also strips
--   EXIF metadata such as the GPS location of the home (docs/security.md).
-- - RLS on storage.objects: the first folder of the path must be a cellar
--   the user belongs to; only editors may add, replace or remove photos.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('labels', 'labels', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (storage.foldername(name))[1] is the first folder of the object's path.
-- A malformed folder name fails the uuid cast, which simply denies access.
create policy "labels: members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'labels' and public.is_cellar_member(((storage.foldername(name))[1])::uuid));

create policy "labels: editors insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid));

create policy "labels: editors update"
  on storage.objects for update to authenticated
  using (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid));

create policy "labels: editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid));

-- The path stored on the wine must point inside the wine's own cellar folder.
alter table public.wines
  add constraint wines_image_path_in_cellar
  check (label_image_path is null or label_image_path like cellar_id::text || '/%');

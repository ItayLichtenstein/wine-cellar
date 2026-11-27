-- =====================================================================
-- Label photos and AI clients (ADR 0009). The pre-request guard only covers
-- the database API; the storage API is checked by these policies alone.
-- An AI token (client_id claim) may add a label photo our MCP server
-- fetched for a draft (`<cellar>/web-<uuid>.webp`), and nothing else:
-- it cannot overwrite or delete the household's photos.
-- =====================================================================

drop policy "labels: editors insert" on storage.objects;
create policy "labels: editors insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'labels'
    and public.is_cellar_editor(((storage.foldername(name))[1])::uuid)
    and ((auth.jwt() ->> 'client_id') is null or storage.filename(name) ~ '^web-[0-9a-f-]{36}\.webp$')
  );

drop policy "labels: editors update" on storage.objects;
create policy "labels: editors update"
  on storage.objects for update to authenticated
  using (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid) and (auth.jwt() ->> 'client_id') is null)
  with check (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid) and (auth.jwt() ->> 'client_id') is null);

drop policy "labels: editors delete" on storage.objects;
create policy "labels: editors delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'labels' and public.is_cellar_editor(((storage.foldername(name))[1])::uuid) and (auth.jwt() ->> 'client_id') is null);

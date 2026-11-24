-- =====================================================================
-- Hardening round 2.
--
-- 1. Length limits on every text column.
--    The browser talks to the database directly, so the UI's limits are
--    only a suggestion. Without limits in the database, anyone signed in
--    could store megabytes per field and fill the free-tier quota.
-- 2. A personal rating can only name someone from the same household.
-- 3. The sign-up trigger trims and shortens the name it receives
--    (the name comes from the client and is not trusted).
-- =====================================================================

-- ---------- 1. Length limits ----------

alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) between 1 and 50);

alter table public.cellars
  add constraint cellars_name_len check (char_length(name) between 1 and 80);

alter table public.fridge_models
  add constraint fridge_models_brand_len  check (char_length(brand) between 1 and 60),
  add constraint fridge_models_model_len  check (char_length(model) between 1 and 60),
  add constraint fridge_models_layout_size check (pg_column_size(layout) <= 20000);

alter table public.fridges
  add constraint fridges_name_len  check (char_length(name) between 1 and 60),
  add constraint fridges_brand_len check (char_length(brand) <= 60),
  add constraint fridges_model_len check (char_length(model) <= 60),
  add constraint fridges_position_range check (position between 0 and 50);

alter table public.shelves
  add constraint shelves_position_range check (position between 1 and 60);

alter table public.shelf_zones
  add constraint zones_label_len check (char_length(label) <= 40),
  add constraint zones_position_range check (position between 1 and 20);

alter table public.wines
  add constraint wines_winery_len  check (char_length(winery) between 1 and 120),
  add constraint wines_name_len    check (char_length(name)   between 1 and 120),
  add constraint wines_grape_len   check (char_length(grape)   <= 200),
  add constraint wines_country_len check (char_length(country) <= 60),
  add constraint wines_region_len  check (char_length(region)  <= 120),
  add constraint wines_image_path_len check (char_length(label_image_path) <= 300);

alter table public.critic_scores
  add constraint critic_scores_critic_len check (char_length(critic) between 1 and 60);

alter table public.bottles
  add constraint bottles_link_len check (char_length(link_url) <= 2048),
  add constraint bottles_note_len check (char_length(note) <= 1000);

alter table public.tastings
  add constraint tastings_place_len check (char_length(place) <= 120),
  add constraint tastings_notes_len check (char_length(notes) <= 4000),
  add constraint tastings_location_len check (char_length(last_location) <= 300);

-- ---------- 2. Ratings: only for people in this household ----------
-- Household members trust each other: one may enter a rating on behalf of
-- another ("she told me to give it 4.5"). What must never happen is a
-- rating under the id of someone OUTSIDE the household.
-- So rater_id must be empty (shared) or a member of the same cellar.

create function public.is_member_of(p_cellar_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cellar_members
    where cellar_id = p_cellar_id and user_id = p_user_id
  );
$$;

revoke execute on function public.is_member_of(uuid, uuid) from public, anon;
grant  execute on function public.is_member_of(uuid, uuid) to authenticated;

drop policy "ratings: editors insert" on public.ratings;
drop policy "ratings: editors update" on public.ratings;

create policy "ratings: editors insert for household"
  on public.ratings for insert to authenticated
  with check (
    public.is_cellar_editor(cellar_id)
    and (rater_id is null or public.is_member_of(cellar_id, rater_id))
  );

create policy "ratings: editors update for household"
  on public.ratings for update to authenticated
  using (public.is_cellar_editor(cellar_id))
  with check (
    public.is_cellar_editor(cellar_id)
    and (rater_id is null or public.is_member_of(cellar_id, rater_id))
  );

-- ---------- 3. Sign-up: never trust the length of the incoming name ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name      text;
  v_cellar_id uuid;
begin
  -- Google sends full_name. Magic-link users only have an email, and we
  -- never derive a name from it (that would show part of the email to the
  -- household and friends). They get a placeholder and are asked for a
  -- name on first login. The value comes from the client: trim and cap it.
  v_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'משתמש חדש'
  ), 50);

  insert into public.profiles (id, display_name) values (new.id, v_name);

  insert into public.cellars (name) values ('המרתף של ' || v_name)
  returning id into v_cellar_id;

  insert into public.cellar_members (cellar_id, user_id, role)
  values (v_cellar_id, new.id, 'member');

  return new;
end;
$$;

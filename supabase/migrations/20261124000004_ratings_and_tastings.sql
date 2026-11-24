-- =====================================================================
-- Ratings and tastings (drinking events).
-- =====================================================================

-- A rating belongs to a wine, optionally to one vintage.
--   vintage_id null -> rating for the wine as a whole
--   rater_id  null  -> the household's shared rating (the default)
--   rater_id  set   -> one member's own rating ("separate ratings" opened)
-- Shown rating: the vintage's if it exists, otherwise the wine's.
create table public.ratings (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null,
  wine_id     uuid not null,
  vintage_id  uuid,
  -- Deleting an account deletes that person's own ratings (shared ones stay).
  rater_id    uuid references public.profiles (id) on delete cascade,
  score       numeric(2,1) not null check (score between 1.0 and 5.0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (wine_id, cellar_id)    references public.wines (id, cellar_id) on delete cascade,
  foreign key (vintage_id, cellar_id) references public.wine_vintages (id, cellar_id) on delete cascade,
  unique nulls not distinct (wine_id, vintage_id, rater_id)
);

-- One drinking event. bottle_id null = drunk outside the cellar
-- (restaurant, friends). One shared tasting note per event.
create table public.tastings (
  id             uuid primary key default gen_random_uuid(),
  cellar_id      uuid not null,
  wine_id        uuid not null,
  vintage_id     uuid,
  bottle_id      uuid unique,            -- a bottle is drunk only once
  tasted_on      date not null default current_date,
  place          text,                   -- "אצל מאיה", "מסעדה"...
  notes          text,
  last_location  text,                   -- where the bottle sat, kept for history
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (wine_id, cellar_id)    references public.wines (id, cellar_id) on delete cascade,
  foreign key (vintage_id, cellar_id) references public.wine_vintages (id, cellar_id) on delete cascade,
  foreign key (bottle_id, cellar_id)  references public.bottles (id, cellar_id) on delete set null (bottle_id)
);

create trigger ratings_updated_at  before update on public.ratings  for each row execute function public.set_updated_at();
create trigger tastings_updated_at before update on public.tastings for each row execute function public.set_updated_at();

alter table public.ratings  enable row level security;
alter table public.tastings enable row level security;

create policy "ratings: members read"    on public.ratings for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "ratings: editors insert"  on public.ratings for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "ratings: editors update"  on public.ratings for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "ratings: editors delete"  on public.ratings for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "tastings: members read"   on public.tastings for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "tastings: editors insert" on public.tastings for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "tastings: editors update" on public.tastings for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "tastings: editors delete" on public.tastings for delete to authenticated using (public.is_cellar_editor(cellar_id));

-- ---------- "We drank it": one transaction ----------
-- Marks the bottle consumed, frees its slot and opens a drinking event.
-- Either everything happens or nothing does.
create function public.drink_bottle(
  p_bottle_id  uuid,
  p_tasted_on  date default current_date,
  p_notes      text default null
)
returns uuid
language plpgsql
security invoker   -- runs with the caller's rights, so RLS still applies
set search_path = ''
as $$
declare
  v_bottle    public.bottles;
  v_wine_id   uuid;
  v_location  text;
  v_tasting   uuid;
begin
  select * into v_bottle from public.bottles where id = p_bottle_id for update;
  if not found then
    raise exception 'bottle not found' using errcode = 'no_data_found';
  end if;
  if v_bottle.status = 'consumed' then
    raise exception 'bottle was already consumed' using errcode = 'check_violation';
  end if;

  select wine_id into v_wine_id from public.wine_vintages where id = v_bottle.vintage_id;

  -- Human-readable last location, e.g. "מקרר יין · מדף 3 · אחורית · מקום 2"
  select concat_ws(' · ', f.name, 'מדף ' || s.position, z.label,
                   case when v_bottle.slot is not null then 'מקום ' || v_bottle.slot end)
    into v_location
    from public.shelf_zones z
    join public.shelves s on s.id = z.shelf_id
    join public.fridges f on f.id = s.fridge_id
   where z.id = v_bottle.zone_id;

  update public.bottles
     set status = 'consumed', zone_id = null, slot = null, consumed_on = p_tasted_on
   where id = p_bottle_id;

  insert into public.tastings (cellar_id, wine_id, vintage_id, bottle_id, tasted_on, notes, last_location)
  values (v_bottle.cellar_id, v_wine_id, v_bottle.vintage_id, p_bottle_id, p_tasted_on, p_notes, v_location)
  returning id into v_tasting;

  return v_tasting;
end;
$$;

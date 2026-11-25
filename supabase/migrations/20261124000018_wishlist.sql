-- =====================================================================
-- Wishlist (stage 5). Belongs to the cellar (shared by the household).
-- An item points to a wine of the cellar; a wine that exists only for the
-- wishlist has no bottles, so it never shows in the fridge or the list.
-- year null = "this wine, any vintage"; a year = "exactly this vintage".
-- (Visibility to friends comes with stage 4.)
-- =====================================================================

create table public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null,
  wine_id     uuid not null,
  year        int check (year between 1900 and 2100),
  note        text check (char_length(note) <= 500),
  link_url    text check (link_url ~* '^https?://' and char_length(link_url) <= 500),
  source_note text check (char_length(source_note) <= 120),  -- "ראיתי אצל מאיה"
  created_at  timestamptz not null default now(),
  foreign key (wine_id, cellar_id) references public.wines (id, cellar_id) on delete cascade,
  unique nulls not distinct (wine_id, year)
);

alter table public.wishlist_items enable row level security;

create policy "wishlist: members read"    on public.wishlist_items for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "wishlist: editors insert"  on public.wishlist_items for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "wishlist: editors update"  on public.wishlist_items for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "wishlist: editors delete"  on public.wishlist_items for delete to authenticated using (public.is_cellar_editor(cellar_id));

alter publication supabase_realtime add table public.wishlist_items;

-- Add (or refresh) a wish: finds or creates the wine (without bottles),
-- like add_bottles. The same wine + year twice updates the note instead
-- of adding a duplicate. Runs as the caller: RLS decides.
create function public.add_to_wishlist(
  p_winery  text,
  p_name    text,
  p_type    public.wine_type default 'red',
  p_year    int  default null,
  p_note    text default null,
  p_link    text default null,
  p_source  text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
  v_wine   uuid;
  v_item   uuid;
begin
  if v_cellar is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select id into v_wine from public.wines
   where cellar_id = v_cellar and lower(winery) = lower(trim(p_winery)) and lower(name) = lower(trim(p_name));
  if v_wine is null then
    insert into public.wines (cellar_id, winery, name, type)
    values (v_cellar, trim(p_winery), trim(p_name), p_type)
    returning id into v_wine;
  end if;

  insert into public.wishlist_items (cellar_id, wine_id, year, note, link_url, source_note)
  values (v_cellar, v_wine, p_year, nullif(trim(p_note), ''), nullif(trim(p_link), ''), nullif(trim(p_source), ''))
  on conflict (wine_id, year) do update
    set note = coalesce(excluded.note, public.wishlist_items.note),
        link_url = coalesce(excluded.link_url, public.wishlist_items.link_url)
  returning id into v_item;
  return v_item;
end;
$$;

revoke execute on function public.add_to_wishlist(text, text, public.wine_type, int, text, text, text) from public, anon;
grant  execute on function public.add_to_wishlist(text, text, public.wine_type, int, text, text, text) to authenticated;

-- Joining with bottles (0017) now also brings the joiner's wishlist.
create or replace function public.move_cellar_data(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w   record;
  v   record;
  b   record;
  v_wine    uuid;
  v_vintage uuid;
  v_bottle  uuid;
begin
  create temporary table if not exists pg_temp.wine_map    (old_id uuid primary key, new_id uuid) on commit drop;
  create temporary table if not exists pg_temp.vintage_map (old_id uuid primary key, new_id uuid) on commit drop;
  create temporary table if not exists pg_temp.bottle_map  (old_id uuid primary key, new_id uuid) on commit drop;

  -- Wines: reuse by winery + name, else copy (without the photo, see above).
  for w in select * from public.wines where cellar_id = p_from loop
    select id into v_wine from public.wines
     where cellar_id = p_to and lower(winery) = lower(w.winery) and lower(name) = lower(w.name);
    if v_wine is null then
      insert into public.wines (cellar_id, winery, name, type, grape, country, region, kosher, shape)
      values (p_to, w.winery, w.name, w.type, w.grape, w.country, w.region, w.kosher, w.shape)
      returning id into v_wine;
    end if;
    insert into pg_temp.wine_map values (w.id, v_wine);
  end loop;

  -- Vintages: reuse by year (NV = NV), else copy with its window.
  for v in select * from public.wine_vintages where cellar_id = p_from loop
    select id into v_vintage from public.wine_vintages
     where wine_id = (select new_id from pg_temp.wine_map where old_id = v.wine_id)
       and year is not distinct from v.year;
    if v_vintage is null then
      insert into public.wine_vintages (wine_id, cellar_id, year, drink_from, drink_to, peak_from, peak_to, window_source, alcohol)
      values ((select new_id from pg_temp.wine_map where old_id = v.wine_id), p_to, v.year,
              v.drink_from, v.drink_to, v.peak_from, v.peak_to, v.window_source, v.alcohol)
      returning id into v_vintage;
    end if;
    insert into pg_temp.vintage_map values (v.id, v_vintage);
  end loop;

  -- Critic scores: add the ones the shared vintage does not have yet.
  insert into public.critic_scores (vintage_id, cellar_id, critic, score)
  select m.new_id, p_to, c.critic, c.score
    from public.critic_scores c join pg_temp.vintage_map m on m.old_id = c.vintage_id
   where c.cellar_id = p_from
     and not exists (select 1 from public.critic_scores x where x.vintage_id = m.new_id and lower(x.critic) = lower(c.critic));

  -- Bottles (+ prices). A bottle in a fridge comes "outside the fridge".
  for b in select * from public.bottles where cellar_id = p_from loop
    insert into public.bottles (cellar_id, vintage_id, status, link_url, note, added_on, consumed_on)
    values (p_to, (select new_id from pg_temp.vintage_map where old_id = b.vintage_id),
            case when b.status = 'stored' then 'unplaced' else b.status end,
            b.link_url, b.note, b.added_on, b.consumed_on)
    returning id into v_bottle;
    insert into pg_temp.bottle_map values (b.id, v_bottle);
  end loop;

  insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
  select m.new_id, p_to, p.paid, p.regular, p.is_gift
    from public.bottle_prices p join pg_temp.bottle_map m on m.old_id = p.bottle_id
   where p.cellar_id = p_from;

  -- History.
  insert into public.tastings (cellar_id, wine_id, vintage_id, bottle_id, tasted_on, place, notes, last_location)
  select p_to,
         (select new_id from pg_temp.wine_map where old_id = t.wine_id),
         (select new_id from pg_temp.vintage_map where old_id = t.vintage_id),
         (select new_id from pg_temp.bottle_map where old_id = t.bottle_id),
         t.tasted_on, t.place, t.notes, t.last_location
    from public.tastings t
   where t.cellar_id = p_from;

  -- Ratings: the shared cellar's existing rating wins on a clash.
  insert into public.ratings (cellar_id, wine_id, vintage_id, rater_id, score)
  select p_to,
         (select new_id from pg_temp.wine_map where old_id = r.wine_id),
         (select new_id from pg_temp.vintage_map where old_id = r.vintage_id),
         r.rater_id, r.score
    from public.ratings r
   where r.cellar_id = p_from
  on conflict (wine_id, vintage_id, rater_id) do nothing;

  -- Wishes (a joiner's wishlist comes along; the shared one wins on a clash).
  insert into public.wishlist_items (cellar_id, wine_id, year, note, link_url, source_note)
  select p_to, (select new_id from pg_temp.wine_map where old_id = i.wine_id), i.year, i.note, i.link_url, i.source_note
    from public.wishlist_items i
   where i.cellar_id = p_from
  on conflict (wine_id, year) do nothing;

  drop table pg_temp.wine_map;
  drop table pg_temp.vintage_map;
  drop table pg_temp.bottle_map;
end;
$$;
revoke execute on function public.move_cellar_data(uuid, uuid) from public, anon, authenticated;

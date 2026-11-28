-- =====================================================================
-- A wine's body: light, medium, medium-full or full. Like the grape, it
-- belongs to the wine (every bottle and vintage of it), and it is optional
-- (null = not known). The site's details form, the AI's add and edit tools
-- and the undo all carry it.
-- =====================================================================

create type public.wine_body as enum ('light', 'medium', 'medium_full', 'full');
alter table public.wines add column body public.wine_body;

-- The details form saves everything at once, so the body joins it. A new
-- parameter would make a second version of the function (an overload), so
-- the old one is dropped first; p_body is last, with a default, so a call
-- without it (an old tab) still works and leaves the body as it is.
drop function public.update_wine_details(uuid, uuid, text, text, text, public.kosher_status, public.bottle_shape, numeric, integer, integer, public.window_source, jsonb);

create function public.update_wine_details(
  p_wine_id       uuid,
  p_vintage_id    uuid,
  p_grape         text,
  p_country       text,
  p_region        text,
  p_kosher        public.kosher_status,
  p_shape         public.bottle_shape,
  p_alcohol       numeric,
  p_peak_from     int,
  p_peak_to       int,
  p_window_source public.window_source,
  p_critics       jsonb default '[]',
  p_body          text default null -- null: leave it; '': not known; else light / medium / medium_full / full
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar uuid;
  v_item   jsonb;
begin
  -- The vintage must belong to this wine (and be visible to the caller).
  select cellar_id into v_cellar
    from public.wine_vintages
   where id = p_vintage_id and wine_id = p_wine_id;
  if v_cellar is null then
    raise exception 'vintage not found' using errcode = 'no_data_found';
  end if;
  if jsonb_typeof(p_critics) is distinct from 'array' or jsonb_array_length(p_critics) > 20 then
    raise exception 'critics must be a list of up to 20' using errcode = 'check_violation';
  end if;

  update public.wines
     set grape   = nullif(trim(p_grape), ''),
         country = nullif(trim(p_country), ''),
         region  = nullif(trim(p_region), ''),
         kosher  = coalesce(p_kosher, 'unknown'),
         shape   = coalesce(p_shape, 'standard'),
         body    = case when p_body is null then body else nullif(p_body, '')::public.wine_body end
   where id = p_wine_id;

  update public.wine_vintages
     set alcohol = p_alcohol, peak_from = p_peak_from, peak_to = p_peak_to, window_source = p_window_source
   where id = p_vintage_id;

  delete from public.critic_scores where vintage_id = p_vintage_id;
  for v_item in select * from jsonb_array_elements(p_critics) loop
    insert into public.critic_scores (vintage_id, cellar_id, critic, score)
    values (p_vintage_id, v_cellar, trim(v_item ->> 'critic'), (v_item ->> 'score')::int);
  end loop;
end;
$$;

revoke execute on function public.update_wine_details(uuid, uuid, text, text, text, public.kosher_status, public.bottle_shape, numeric, int, int, public.window_source, jsonb, text) from public, anon;
grant  execute on function public.update_wine_details(uuid, uuid, text, text, text, public.kosher_status, public.bottle_shape, numeric, int, int, public.window_source, jsonb, text) to authenticated;

-- The AI's edit, now with the body too (same signature).
create or replace function public.ai_edit_wine(p_vintage_id uuid, p_bottle_ids uuid[], p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.wine_vintages;
  w public.wines;
  v_prices jsonb;
  v_notes jsonb;
begin
  if jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'changes must be an object' using errcode = 'check_violation';
  end if;
  select * into v from public.wine_vintages where id = p_vintage_id;
  if not found then
    raise exception 'wine not found' using errcode = 'no_data_found';
  end if;
  select * into w from public.wines where id = v.wine_id;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]') into v_prices
    from public.bottle_prices p where p.bottle_id = any (coalesce(p_bottle_ids, '{}'));
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'note', b.note)), '[]') into v_notes
    from public.bottles b where b.id = any (coalesce(p_bottle_ids, '{}')) and b.vintage_id = v.id;

  if p_changes ?| array['type', 'grape', 'country', 'region', 'kosher', 'shape', 'body'] then
    update public.wines set
      type    = case when p_changes ? 'type' then (p_changes ->> 'type')::public.wine_type else type end,
      grape   = case when p_changes ? 'grape' then nullif(trim(p_changes ->> 'grape'), '') else grape end,
      country = case when p_changes ? 'country' then nullif(trim(p_changes ->> 'country'), '') else country end,
      region  = case when p_changes ? 'region' then nullif(trim(p_changes ->> 'region'), '') else region end,
      kosher  = case when p_changes ? 'kosher' then (p_changes ->> 'kosher')::public.kosher_status else kosher end,
      shape   = case when p_changes ? 'shape' then (p_changes ->> 'shape')::public.bottle_shape else shape end,
      body    = case when p_changes ? 'body' then (p_changes ->> 'body')::public.wine_body else body end
     where id = w.id;
    if not found then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if p_changes ?| array['drink_from', 'drink_to', 'peak_from', 'peak_to', 'alcohol'] then
    update public.wine_vintages set
      drink_from = case when p_changes ? 'drink_from' then (p_changes ->> 'drink_from')::int else drink_from end,
      drink_to   = case when p_changes ? 'drink_to' then (p_changes ->> 'drink_to')::int else drink_to end,
      peak_from  = case when p_changes ? 'peak_from' then (p_changes ->> 'peak_from')::int else peak_from end,
      peak_to    = case when p_changes ? 'peak_to' then (p_changes ->> 'peak_to')::int else peak_to end,
      alcohol    = case when p_changes ? 'alcohol' then (p_changes ->> 'alcohol')::numeric else alcohol end
     where id = v.id;
    if not found then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if p_changes ? 'price' then
    insert into public.bottle_prices (bottle_id, cellar_id, paid)
    select b.id, b.cellar_id, (p_changes ->> 'price')::numeric
      from public.bottles b where b.id = any (coalesce(p_bottle_ids, '{}')) and b.vintage_id = v.id
    on conflict (bottle_id) do update set paid = excluded.paid;
  end if;
  if p_changes ? 'note' then
    update public.bottles set note = nullif(trim(p_changes ->> 'note'), '')
     where id = any (coalesce(p_bottle_ids, '{}')) and vintage_id = v.id;
  end if;

  return jsonb_build_object(
    'wine', jsonb_build_object('id', w.id, 'type', w.type, 'grape', w.grape, 'country', w.country, 'region', w.region, 'kosher', w.kosher, 'shape', w.shape, 'body', w.body),
    'vintage', jsonb_build_object('id', v.id, 'drink_from', v.drink_from, 'drink_to', v.drink_to, 'peak_from', v.peak_from, 'peak_to', v.peak_to, 'alcohol', v.alcohol),
    'bottles', to_jsonb(coalesce(p_bottle_ids, '{}')),
    'prices', v_prices,
    'notes', v_notes);
end;
$$;

-- Undo: the body is put back too.
create or replace function public.undo_ai_change(p_draft_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d public.drafts;
  u jsonb;
  b public.bottles;
begin
  select * into d from public.drafts where id = p_draft_id and applied_by_ai and undone_at is null for update;
  if not found then
    raise exception 'nothing to undo' using errcode = 'no_data_found';
  end if;
  u := d.undo;

  if d.kind = 'add_bottles' then
    delete from public.bottles
     where cellar_id = d.cellar_id and status <> 'consumed'
       and id in (select jsonb_array_elements_text(u -> 'bottles')::uuid);

  elsif d.kind = 'move' then
    perform public.move_bottle((u ->> 'bottle')::uuid, (u ->> 'zone_id')::uuid, (u ->> 'slot')::int);

  elsif d.kind = 'drink' then
    delete from public.tastings where id = (u ->> 'tasting')::uuid and cellar_id = d.cellar_id;
    update public.bottles
       set status = (u ->> 'status')::public.bottle_status, zone_id = (u ->> 'zone_id')::uuid,
           slot = (u ->> 'slot')::int, consumed_on = null
     where id = (u ->> 'bottle')::uuid and cellar_id = d.cellar_id and status = 'consumed';
    if not found then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;

  elsif d.kind = 'delete' then
    b := jsonb_populate_record(null::public.bottles, u -> 'bottle');
    if b.cellar_id <> d.cellar_id then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
    begin
      insert into public.bottles select b.*;
    exception when unique_violation then
      -- Its place was taken in the meantime: back, but outside the fridge.
      b.status := 'unplaced'; b.zone_id := null; b.slot := null;
      insert into public.bottles select b.*;
    end;
    if jsonb_typeof(u -> 'price') = 'object' and (u -> 'price' ->> 'bottle_id') is not null then
      insert into public.bottle_prices select (jsonb_populate_record(null::public.bottle_prices, u -> 'price')).*;
    end if;

  elsif d.kind = 'edit' then
    -- Kosher, shape, alcohol and notes exist only in undo records from migration 47 on, the body from 48.
    update public.wines set type = (u -> 'wine' ->> 'type')::public.wine_type, grape = u -> 'wine' ->> 'grape',
           country = u -> 'wine' ->> 'country', region = u -> 'wine' ->> 'region',
           kosher = coalesce((u -> 'wine' ->> 'kosher')::public.kosher_status, kosher),
           shape = coalesce((u -> 'wine' ->> 'shape')::public.bottle_shape, shape),
           body = case when u -> 'wine' ? 'body' then (u -> 'wine' ->> 'body')::public.wine_body else body end
     where id = (u -> 'wine' ->> 'id')::uuid and cellar_id = d.cellar_id;
    update public.wine_vintages set drink_from = (u -> 'vintage' ->> 'drink_from')::int, drink_to = (u -> 'vintage' ->> 'drink_to')::int,
           peak_from = (u -> 'vintage' ->> 'peak_from')::int, peak_to = (u -> 'vintage' ->> 'peak_to')::int,
           alcohol = case when u -> 'vintage' ? 'alcohol' then (u -> 'vintage' ->> 'alcohol')::numeric else alcohol end
     where id = (u -> 'vintage' ->> 'id')::uuid and cellar_id = d.cellar_id;
    update public.bottles x set note = n ->> 'note'
      from jsonb_array_elements(coalesce(u -> 'notes', '[]')) n
     where x.id = (n ->> 'id')::uuid and x.cellar_id = d.cellar_id;
    -- Prices: back to what they were (no row before = no price).
    delete from public.bottle_prices
     where cellar_id = d.cellar_id and bottle_id in (select jsonb_array_elements_text(u -> 'bottles')::uuid);
    insert into public.bottle_prices
    select (jsonb_populate_record(null::public.bottle_prices, p)).*
      from jsonb_array_elements(coalesce(u -> 'prices', '[]')) p
     where (p ->> 'cellar_id')::uuid = d.cellar_id
       and exists (select 1 from public.bottles x where x.id = (p ->> 'bottle_id')::uuid);

  elsif d.kind = 'wishlist' and u ? 'removed' then
    -- A wish the AI removed: back, as it was.
    insert into public.wishlist_items
    select (jsonb_populate_record(null::public.wishlist_items, u -> 'removed')).*
     where (u -> 'removed' ->> 'cellar_id')::uuid = d.cellar_id
    on conflict (id) do nothing;

  elsif d.kind = 'wishlist' then
    delete from public.wishlist_items where id = (u ->> 'item')::uuid and cellar_id = d.cellar_id;

  elsif d.kind = 'taste' and u ? 'edited' then
    -- A past tasting the AI corrected: its date, place and notes, and the household score.
    update public.tastings set tasted_on = (u -> 'edited' ->> 'tasted_on')::date, place = u -> 'edited' ->> 'place', notes = u -> 'edited' ->> 'notes'
     where id = (u -> 'edited' ->> 'id')::uuid and cellar_id = d.cellar_id;
    if not found then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
    if u -> 'edited' ? 'score' then
      delete from public.ratings
       where cellar_id = d.cellar_id and wine_id = (u -> 'edited' ->> 'wine_id')::uuid
         and vintage_id is not distinct from (u -> 'edited' ->> 'vintage_id')::uuid and rater_id is null;
      if u -> 'edited' ->> 'score' is not null then
        perform public.set_rating((u -> 'edited' ->> 'wine_id')::uuid, (u -> 'edited' ->> 'score')::numeric, (u -> 'edited' ->> 'vintage_id')::uuid);
      end if;
    end if;

  elsif d.kind = 'taste' then
    delete from public.tastings where id = (u ->> 'tasting')::uuid and cellar_id = d.cellar_id;

  elsif d.kind = 'fridge' and u ? 'created' then
    -- A fridge the AI made: removed again, but only while it is empty
    -- (bottles already in it stay, and the user deletes it on the site).
    if exists (select 1 from public.bottles b2
                 join public.shelf_zones z on z.id = b2.zone_id
                 join public.shelves s on s.id = z.shelf_id
                where s.fridge_id = (u ->> 'created')::uuid and b2.status = 'stored') then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
    delete from public.fridges where id = (u ->> 'created')::uuid and cellar_id = d.cellar_id;
    if not found then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;

  elsif d.kind = 'fridge' then
    if not exists (select 1 from public.fridges where id = (u ->> 'fridge')::uuid and cellar_id = d.cellar_id) then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
    perform public.update_fridge((u ->> 'fridge')::uuid, u ->> 'name', u -> 'shelves', u ->> 'brand', u ->> 'model');

  elsif d.kind = 'label' then
    -- Back to the photo before (or none); the wines check keeps the path in the cellar's folder.
    update public.wines set label_image_path = u ->> 'path', label_thumb = u ->> 'thumb'
     where id = (u ->> 'wine')::uuid and cellar_id = d.cellar_id;
    if not found then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
  end if;

  update public.drafts set undone_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.undo_ai_change(uuid) to authenticated;

-- The CSV import takes the body too (a new wine only, like the grape).
create or replace function public.import_cellar(p_source text, p_file_hash text, p_bottles jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar  uuid := public.my_cellar_id();
  v_import  uuid;
  b         jsonb;
  v_wine    uuid;
  v_vintage uuid;
  v_bottle  uuid;
  v_year    int;
  v_wines   int := 0;
  v_count   int := 0;
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_bottles) <> 'array' or jsonb_array_length(p_bottles) not between 1 and 2000 then
    raise exception 'between 1 and 2000 bottles' using errcode = '22023';
  end if;

  insert into public.imports (cellar_id, source, file_hash)
  values (v_cellar, p_source, p_file_hash)
  returning id into v_import;

  for b in select value from jsonb_array_elements(p_bottles) loop
    select w.id into v_wine
    from public.wines w
    where w.cellar_id = v_cellar
      and lower(w.winery) = lower(b ->> 'winery')
      and lower(w.name) = lower(b ->> 'name');

    if v_wine is null then
      insert into public.wines (cellar_id, winery, name, type, grape, country, region, kosher, body, import_id)
      values (
        v_cellar, b ->> 'winery', b ->> 'name',
        coalesce((b ->> 'type')::public.wine_type, 'red'),
        b ->> 'grape', b ->> 'country', b ->> 'region',
        coalesce((b ->> 'kosher')::public.kosher_status, 'unknown'),
        (b ->> 'body')::public.wine_body,
        v_import
      )
      returning id into v_wine;
      v_wines := v_wines + 1;
    end if;

    v_year := (b ->> 'year')::int;
    select v.id into v_vintage
    from public.wine_vintages v
    where v.wine_id = v_wine and v.year is not distinct from v_year;

    if v_vintage is null then
      insert into public.wine_vintages (wine_id, cellar_id, year, drink_from, drink_to, peak_from, peak_to, alcohol, import_id)
      values (
        v_wine, v_cellar, v_year,
        (b ->> 'drink_from')::int, (b ->> 'drink_to')::int,
        (b ->> 'peak_from')::int, (b ->> 'peak_to')::int,
        (b ->> 'alcohol')::numeric, v_import
      )
      returning id into v_vintage;
    end if;

    insert into public.bottles (cellar_id, vintage_id, status, added_on, consumed_on, note, link_url, import_id)
    values (
      v_cellar, v_vintage,
      coalesce((b ->> 'status')::public.bottle_status, 'unplaced'),
      coalesce((b ->> 'added_on')::date, current_date),
      (b ->> 'consumed_on')::date,
      b ->> 'note', b ->> 'link_url', v_import
    )
    returning id into v_bottle;

    if b ->> 'paid' is not null or b ->> 'regular' is not null or (b ->> 'is_gift')::boolean then
      insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
      values (v_bottle, v_cellar, (b ->> 'paid')::numeric, (b ->> 'regular')::numeric, coalesce((b ->> 'is_gift')::boolean, false));
    end if;

    v_count := v_count + 1;
  end loop;

  update public.imports set wines = v_wines, bottles = v_count where id = v_import;
  return jsonb_build_object('import_id', v_import, 'wines', v_wines, 'bottles', v_count);
end;
$$;

revoke execute on function public.import_cellar(text, text, jsonb) from public, anon;
grant execute on function public.import_cellar(text, text, jsonb) to authenticated;

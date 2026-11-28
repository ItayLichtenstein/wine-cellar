-- =====================================================================
-- More that the AI can do, for an AI the user lets make changes, each
-- undoable on /ai:
--   * remove a wine from the wishlist (bought, or no longer wanted);
--   * correct a past tasting: its date, place, notes and the score;
--   * a wine's kosher status, bottle shape, alcohol and the bottles' notes.
-- (Bottles on their way need nothing new: add_bottles already takes a status.)
-- Deleting a fridge stays on the site only, on purpose.
-- =====================================================================

-- Removes one wish; returns the row, for the undo.
create function public.ai_remove_wishlist_item(p_item uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  delete from public.wishlist_items where id = p_item returning to_jsonb(wishlist_items.*) into v_row;
  if v_row is null then
    raise exception 'wish not found' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.ai_remove_wishlist_item(uuid) from public, anon;
grant execute on function public.ai_remove_wishlist_item(uuid) to authenticated;

-- Corrects a past tasting: only the keys present in p_changes (tasted_on,
-- place, notes, score). Returns the values before, for the undo.
create function public.ai_edit_tasting(p_tasting uuid, p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.tastings;
  v_score numeric;
begin
  if jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'changes must be an object' using errcode = 'check_violation';
  end if;
  select * into t from public.tastings where id = p_tasting;
  if not found then
    raise exception 'tasting not found' using errcode = 'no_data_found';
  end if;
  select score into v_score from public.ratings
   where wine_id = t.wine_id and vintage_id is not distinct from t.vintage_id and rater_id is null;
  if (p_changes ->> 'tasted_on')::date > current_date + 1 then
    raise exception 'a tasting cannot be in the future' using errcode = 'check_violation';
  end if;

  update public.tastings set
    tasted_on = case when p_changes ? 'tasted_on' then (p_changes ->> 'tasted_on')::date else tasted_on end,
    place     = case when p_changes ? 'place' then nullif(trim(p_changes ->> 'place'), '') else place end,
    notes     = case when p_changes ? 'notes' then nullif(trim(p_changes ->> 'notes'), '') else notes end
   where id = t.id;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_changes ? 'score' then
    perform public.set_rating(t.wine_id, (p_changes ->> 'score')::numeric, t.vintage_id);
  end if;

  return jsonb_build_object('id', t.id, 'tasted_on', t.tasted_on, 'place', t.place, 'notes', t.notes,
    'wine_id', t.wine_id, 'vintage_id', t.vintage_id)
    || case when p_changes ? 'score' then jsonb_build_object('score', v_score) else '{}'::jsonb end;
end;
$$;
revoke execute on function public.ai_edit_tasting(uuid, jsonb) from public, anon;
grant execute on function public.ai_edit_tasting(uuid, jsonb) to authenticated;

-- A wine's details, now also kosher, bottle shape, alcohol and the notes of
-- the bottles given (same signature, so no second version of it).
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

  if p_changes ?| array['type', 'grape', 'country', 'region', 'kosher', 'shape'] then
    update public.wines set
      type    = case when p_changes ? 'type' then (p_changes ->> 'type')::public.wine_type else type end,
      grape   = case when p_changes ? 'grape' then nullif(trim(p_changes ->> 'grape'), '') else grape end,
      country = case when p_changes ? 'country' then nullif(trim(p_changes ->> 'country'), '') else country end,
      region  = case when p_changes ? 'region' then nullif(trim(p_changes ->> 'region'), '') else region end,
      kosher  = case when p_changes ? 'kosher' then (p_changes ->> 'kosher')::public.kosher_status else kosher end,
      shape   = case when p_changes ? 'shape' then (p_changes ->> 'shape')::public.bottle_shape else shape end
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
    'wine', jsonb_build_object('id', w.id, 'type', w.type, 'grape', w.grape, 'country', w.country, 'region', w.region, 'kosher', w.kosher, 'shape', w.shape),
    'vintage', jsonb_build_object('id', v.id, 'drink_from', v.drink_from, 'drink_to', v.drink_to, 'peak_from', v.peak_from, 'peak_to', v.peak_to, 'alcohol', v.alcohol),
    'bottles', to_jsonb(coalesce(p_bottle_ids, '{}')),
    'prices', v_prices,
    'notes', v_notes);
end;
$$;

-- The guard: the AI with an edit grant may also call the two new functions.
create or replace function public.limit_oauth_clients()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_client text := v_claims ->> 'client_id';
  v_method text := current_setting('request.method', true);
  v_path   text := current_setting('request.path', true);
begin
  if v_client is null then
    return; -- the user themself (or anon): RLS as usual
  end if;
  if v_method in ('GET', 'HEAD') then
    return;
  end if;
  if v_method = 'POST' and v_path in (
    '/drafts',
    '/rpc/my_cellar_id', '/rpc/my_friends', '/rpc/is_cellar_editor', '/rpc/is_cellar_member', '/rpc/can_read_cellar'
  ) then
    return;
  end if;
  if exists (select 1 from public.ai_edit_grants g where g.user_id::text = v_claims ->> 'sub' and g.client_id = v_client)
     and ((v_method = 'POST' and v_path in (
            '/rpc/add_bottles', '/rpc/drink_bottle', '/rpc/move_bottle', '/rpc/set_rating',
            '/rpc/update_wine_details', '/rpc/ai_delete_bottle',
            '/rpc/ai_edit_wine', '/rpc/add_to_wishlist', '/rpc/log_tasting', '/rpc/update_fridge',
            '/rpc/ai_create_fridge', '/rpc/ai_remove_wishlist_item', '/rpc/ai_edit_tasting'))
          or (v_method = 'PATCH' and v_path in ('/drafts', '/wines'))) then
    return;
  end if;
  raise exception 'AI clients can only read and suggest drafts'
    using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
end;
$$;

-- Undo, for the new changes too.
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
    -- Kosher, shape, alcohol and notes exist only in undo records from migration 47 on.
    update public.wines set type = (u -> 'wine' ->> 'type')::public.wine_type, grape = u -> 'wine' ->> 'grape',
           country = u -> 'wine' ->> 'country', region = u -> 'wine' ->> 'region',
           kosher = coalesce((u -> 'wine' ->> 'kosher')::public.kosher_status, kosher),
           shape = coalesce((u -> 'wine' ->> 'shape')::public.bottle_shape, shape)
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

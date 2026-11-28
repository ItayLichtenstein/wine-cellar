-- =====================================================================
-- The AI may set up a new fridge or cabinet (e.g. from a photo of it),
-- not only change one that exists. Only an AI the user lets make changes
-- (the guard below), and it can be undone on /ai while the fridge is empty.
-- ai_create_fridge is create_fridge plus the kind (fridge or cabinet): a
-- new name, because another parameter on create_fridge would make a second
-- version of it (an overload) next to the old one.
-- =====================================================================

create function public.ai_create_fridge(
  p_name    text,
  p_shelves jsonb,
  p_kind    text default 'fridge',
  p_brand   text default null,
  p_model   text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind not in ('fridge', 'cabinet') then
    raise exception 'kind must be fridge or cabinet' using errcode = 'check_violation';
  end if;
  -- A cabinet has no brand or model.
  v_id := public.create_fridge(p_name, p_shelves,
            case when p_kind = 'cabinet' then null else p_brand end,
            case when p_kind = 'cabinet' then null else p_model end);
  update public.fridges set kind = p_kind where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.ai_create_fridge(text, jsonb, text, text, text) from public, anon;
grant execute on function public.ai_create_fridge(text, jsonb, text, text, text) to authenticated;

-- The guard: the AI with an edit grant may also create a fridge.
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
            '/rpc/ai_create_fridge'))
          or (v_method = 'PATCH' and v_path in ('/drafts', '/wines'))) then
    return;
  end if;
  raise exception 'AI clients can only read and suggest drafts'
    using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
end;
$$;

-- Undo: a fridge the AI created is removed again.
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
    update public.wines set type = (u -> 'wine' ->> 'type')::public.wine_type, grape = u -> 'wine' ->> 'grape',
           country = u -> 'wine' ->> 'country', region = u -> 'wine' ->> 'region'
     where id = (u -> 'wine' ->> 'id')::uuid and cellar_id = d.cellar_id;
    update public.wine_vintages set drink_from = (u -> 'vintage' ->> 'drink_from')::int, drink_to = (u -> 'vintage' ->> 'drink_to')::int,
           peak_from = (u -> 'vintage' ->> 'peak_from')::int, peak_to = (u -> 'vintage' ->> 'peak_to')::int
     where id = (u -> 'vintage' ->> 'id')::uuid and cellar_id = d.cellar_id;
    -- Prices: back to what they were (no row before = no price).
    delete from public.bottle_prices
     where cellar_id = d.cellar_id and bottle_id in (select jsonb_array_elements_text(u -> 'bottles')::uuid);
    insert into public.bottle_prices
    select (jsonb_populate_record(null::public.bottle_prices, p)).*
      from jsonb_array_elements(coalesce(u -> 'prices', '[]')) p
     where (p ->> 'cellar_id')::uuid = d.cellar_id
       and exists (select 1 from public.bottles x where x.id = (p ->> 'bottle_id')::uuid);

  elsif d.kind = 'wishlist' then
    delete from public.wishlist_items where id = (u ->> 'item')::uuid and cellar_id = d.cellar_id;

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

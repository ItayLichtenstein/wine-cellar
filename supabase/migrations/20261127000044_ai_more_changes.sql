-- =====================================================================
-- More changes an AI with edit rights can make itself (ADR 0013), each
-- logged with what is needed to undo it on the site:
--   edit     – details of a wine / vintage / bottle prices (ai_edit_wine)
--   wishlist – a wine added to the wishlist (add_to_wishlist)
--   taste    – a drink outside the cellar, e.g. a restaurant (log_tasting)
--   fridge   – the fridge's shelves and zones (update_fridge)
-- An AI that only suggests does not get these: the tools tell the user to
-- make the change on the site or to let the AI make changes.
-- =====================================================================

alter type public.draft_kind add value if not exists 'edit';
alter type public.draft_kind add value if not exists 'wishlist';
alter type public.draft_kind add value if not exists 'taste';
alter type public.draft_kind add value if not exists 'fridge';

-- A fridge's layout (to undo a fridge change) is bigger than a bottle.
alter table public.drafts drop constraint if exists drafts_undo_check;
alter table public.drafts add constraint drafts_undo_check
  check (undo is null or (jsonb_typeof(undo) = 'object' and char_length(undo::text) <= 40000));

-- Changes a wine's details: only the keys present in p_changes. Wine
-- fields (type, grape, country, region) and the vintage's drinking window
-- apply to every bottle of it; a price applies to the bottles given.
-- Returns the values before, for the undo. Runs with the caller's rights.
create function public.ai_edit_wine(p_vintage_id uuid, p_bottle_ids uuid[], p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.wine_vintages;
  w public.wines;
  v_prices jsonb;
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

  if p_changes ?| array['type', 'grape', 'country', 'region'] then
    update public.wines set
      type    = case when p_changes ? 'type' then (p_changes ->> 'type')::public.wine_type else type end,
      grape   = case when p_changes ? 'grape' then nullif(trim(p_changes ->> 'grape'), '') else grape end,
      country = case when p_changes ? 'country' then nullif(trim(p_changes ->> 'country'), '') else country end,
      region  = case when p_changes ? 'region' then nullif(trim(p_changes ->> 'region'), '') else region end
     where id = w.id;
    if not found then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if p_changes ?| array['drink_from', 'drink_to', 'peak_from', 'peak_to'] then
    update public.wine_vintages set
      drink_from = case when p_changes ? 'drink_from' then (p_changes ->> 'drink_from')::int else drink_from end,
      drink_to   = case when p_changes ? 'drink_to' then (p_changes ->> 'drink_to')::int else drink_to end,
      peak_from  = case when p_changes ? 'peak_from' then (p_changes ->> 'peak_from')::int else peak_from end,
      peak_to    = case when p_changes ? 'peak_to' then (p_changes ->> 'peak_to')::int else peak_to end
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

  return jsonb_build_object(
    'wine', jsonb_build_object('id', w.id, 'type', w.type, 'grape', w.grape, 'country', w.country, 'region', w.region),
    'vintage', jsonb_build_object('id', v.id, 'drink_from', v.drink_from, 'drink_to', v.drink_to, 'peak_from', v.peak_from, 'peak_to', v.peak_to),
    'bottles', to_jsonb(coalesce(p_bottle_ids, '{}')),
    'prices', v_prices);
end;
$$;
grant execute on function public.ai_edit_wine(uuid, uuid[], jsonb) to authenticated;

-- The guard: the AI with an edit grant may also call these.
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
            '/rpc/ai_edit_wine', '/rpc/add_to_wishlist', '/rpc/log_tasting', '/rpc/update_fridge'))
          or (v_method = 'PATCH' and v_path in ('/drafts', '/wines'))) then
    return;
  end if;
  raise exception 'AI clients can only read and suggest drafts'
    using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
end;
$$;

-- Undo, now also for the four new kinds.
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

  elsif d.kind = 'fridge' then
    if not exists (select 1 from public.fridges where id = (u ->> 'fridge')::uuid and cellar_id = d.cellar_id) then
      raise exception 'cannot undo' using errcode = 'check_violation';
    end if;
    perform public.update_fridge((u ->> 'fridge')::uuid, u ->> 'name', u -> 'shelves', u ->> 'brand', u ->> 'model');
  end if;

  update public.drafts set undone_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.undo_ai_change(uuid) to authenticated;

-- =====================================================================
-- AI edit mode (ADR 0013). On the consent screen the user chooses, per
-- connected AI: "prepare changes for my approval" (drafts, ADR 0009) or
-- "make changes itself". The choice is a row here, and the database guard
-- (limit_oauth_clients) reads it, so the AI cannot grant itself edit rights.
--
-- Every change an AI makes itself is still written to drafts (as approved,
-- applied_by_ai) with what is needed to undo it, so the site can show
-- "what the AI changed" with an undo button.
-- =====================================================================

create table public.ai_edit_grants (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id  text not null check (char_length(client_id) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.ai_edit_grants enable row level security;
create policy "ai_edit_grants: own read"   on public.ai_edit_grants for select to authenticated using (user_id = auth.uid());
create policy "ai_edit_grants: own add"    on public.ai_edit_grants for insert to authenticated with check (user_id = auth.uid());
create policy "ai_edit_grants: own remove" on public.ai_edit_grants for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.ai_edit_grants to authenticated;

alter type public.draft_kind add value if not exists 'delete';

alter table public.drafts
  add column applied_by_ai boolean not null default false,
  add column undo jsonb check (undo is null or (jsonb_typeof(undo) = 'object' and char_length(undo::text) <= 8000)),
  add column undone_at timestamptz;

-- The guard: an AI with an edit grant may also call the functions that
-- change bottles (the same ones the site uses). Still never: membership,
-- sharing, account, admin, or granting itself rights.
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
            '/rpc/update_wine_details', '/rpc/ai_delete_bottle'))
          or (v_method = 'PATCH' and v_path in ('/drafts', '/wines'))) then
    return;
  end if;
  raise exception 'AI clients can only read and suggest drafts'
    using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
end;
$$;

-- Deleting a bottle (not drinking it), keeping a copy so it can be undone.
create function public.ai_delete_bottle(p_bottle_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bottle public.bottles;
  v_price  public.bottle_prices;
begin
  select * into v_bottle from public.bottles where id = p_bottle_id and status <> 'consumed';
  if not found then
    raise exception 'bottle not found' using errcode = 'no_data_found';
  end if;
  select * into v_price from public.bottle_prices where bottle_id = p_bottle_id;
  delete from public.bottles where id = p_bottle_id;
  if not found then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  -- No price row: v_price is all nulls, so keep none.
  return jsonb_build_object('bottle', to_jsonb(v_bottle), 'price', case when v_price.bottle_id is not null then to_jsonb(v_price) end);
end;
$$;
grant execute on function public.ai_delete_bottle(uuid) to authenticated;

-- Undo one change an AI made itself. Only the user (not an AI) calls this:
-- it is not on the guard's list. Runs with the caller's rights (RLS).
create function public.undo_ai_change(p_draft_id uuid)
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
  end if;

  update public.drafts set undone_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.undo_ai_change(uuid) to authenticated;

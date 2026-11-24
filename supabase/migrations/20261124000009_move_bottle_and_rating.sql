-- =====================================================================
-- move_bottle(): put a bottle in a slot or stack – or swap with the
-- bottle already there – in one transaction.
-- set_rating(): add or replace a rating (shared or per member).
-- Both are shared entry points for the website and the future MCP server
-- and run as the caller, so RLS applies.
-- =====================================================================

-- Target: a zone (and slot, for a row). p_zone_id null = take the bottle
-- out of the fridge. If the target row slot is taken, the two bottles
-- swap places – the common case when rearranging a fridge.
create function public.move_bottle(
  p_bottle_id uuid,
  p_zone_id   uuid,
  p_slot      int default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bottle public.bottles;
  v_other  public.bottles;
begin
  select * into v_bottle from public.bottles where id = p_bottle_id for update;
  if not found then
    raise exception 'bottle not found' using errcode = 'no_data_found';
  end if;
  if v_bottle.status = 'consumed' then
    raise exception 'a consumed bottle cannot be moved' using errcode = 'check_violation';
  end if;

  -- Out of the fridge.
  if p_zone_id is null then
    update public.bottles set status = 'unplaced', zone_id = null, slot = null where id = p_bottle_id;
    return;
  end if;

  -- Is someone already in that row slot?
  if p_slot is not null then
    select * into v_other from public.bottles
     where zone_id = p_zone_id and slot = p_slot and id <> p_bottle_id
     for update;
  end if;

  if v_other.id is not null then
    -- Swap: step aside first, because (zone_id, slot) must stay unique
    -- after every single statement.
    update public.bottles set status = 'unplaced', zone_id = null, slot = null where id = v_other.id;
    update public.bottles
       set status = 'stored', zone_id = p_zone_id, slot = p_slot
     where id = p_bottle_id;
    update public.bottles
       set status  = case when v_bottle.zone_id is null then 'unplaced'::public.bottle_status else 'stored' end,
           zone_id = v_bottle.zone_id,
           slot    = v_bottle.slot
     where id = v_other.id;
  else
    update public.bottles
       set status = 'stored', zone_id = p_zone_id, slot = p_slot
     where id = p_bottle_id;
  end if;
end;
$$;

-- p_vintage_id null = a rating for the wine as a whole.
-- p_rater_id   null = the household's shared rating.
create function public.set_rating(
  p_wine_id    uuid,
  p_score      numeric,
  p_vintage_id uuid default null,
  p_rater_id   uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar uuid;
begin
  select cellar_id into v_cellar from public.wines where id = p_wine_id;
  if v_cellar is null then
    raise exception 'wine not found' using errcode = 'no_data_found';
  end if;

  insert into public.ratings (cellar_id, wine_id, vintage_id, rater_id, score)
  values (v_cellar, p_wine_id, p_vintage_id, p_rater_id, round(p_score, 1))
  on conflict (wine_id, vintage_id, rater_id)
  do update set score = excluded.score;
end;
$$;

revoke execute on function public.move_bottle(uuid, uuid, int)            from public, anon;
revoke execute on function public.set_rating(uuid, numeric, uuid, uuid)   from public, anon;
grant  execute on function public.move_bottle(uuid, uuid, int)            to authenticated;
grant  execute on function public.set_rating(uuid, numeric, uuid, uuid)   to authenticated;

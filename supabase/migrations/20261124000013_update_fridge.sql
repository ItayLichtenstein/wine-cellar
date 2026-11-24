-- =====================================================================
-- update_fridge(): edit an existing fridge in one transaction.
--
-- p_shelves has the same shape as in create_fridge(), plus optional ids:
--   [{ "id": "<shelf id>", "zones": [{ "id": "<zone id>", "kind": "row", "capacity": 5, "label": "..." }] }]
-- - A shelf/zone WITH the id of an existing one in this fridge is kept, so
--   its bottles stay where they are (only position/capacity/label change).
-- - Without an id (or with an id that is not in this fridge) it is new.
-- - Existing shelves/zones missing from the list are deleted.
-- Bottles are never deleted: the zone triggers move bottles of a deleted
-- or shrunk row to "outside the fridge", and here the same is done for a
-- stack that got smaller (the most recently added bottles leave first).
-- The UI shows the user which bottles will leave before saving.
-- Runs as the caller; only an editor of the cellar may change it.
-- =====================================================================

-- Fix: the shrink trigger unplaced EVERY bottle of a stack on any update
-- that listed kind/capacity, even when nothing changed. Now a bottle leaves
-- only when its row became a stack, or its slot no longer exists.
-- (A smaller stack is handled in update_fridge below.)
create or replace function public.unplace_bottles_of_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.bottles
       set status = 'unplaced', zone_id = null, slot = null
     where zone_id = old.id;
    return old;
  end if;

  update public.bottles
     set status = 'unplaced', zone_id = null, slot = null
   where zone_id = new.id
     and ((new.kind = 'stack' and old.kind = 'row')
          or (new.kind = 'row' and (old.kind = 'stack' or slot > new.capacity)));
  return new;
end;
$$;

create function public.update_fridge(
  p_fridge_id uuid,
  p_name      text,
  p_shelves   jsonb,
  p_brand     text default null,
  p_model     text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar   uuid;
  v_shelf    uuid;
  v_zone     uuid;
  v_shelf_js jsonb;
  v_zone_js  jsonb;
  v_shelf_no int := 0;
  v_zone_no  int;
begin
  select cellar_id into v_cellar from public.fridges where id = p_fridge_id;
  if v_cellar is null then
    raise exception 'fridge not found' using errcode = 'no_data_found';
  end if;
  if not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_shelves) is distinct from 'array'
     or jsonb_array_length(p_shelves) not between 1 and 30 then
    raise exception 'a fridge needs 1 to 30 shelves' using errcode = 'check_violation';
  end if;

  update public.fridges
     set name = trim(p_name), brand = nullif(trim(p_brand), ''), model = nullif(trim(p_model), '')
   where id = p_fridge_id;

  -- 1. Delete what is no longer listed (zone triggers unplace their bottles).
  delete from public.shelf_zones z
   using public.shelves s
   where z.shelf_id = s.id and s.fridge_id = p_fridge_id
     and z.id::text not in (
       select zj ->> 'id'
         from jsonb_array_elements(p_shelves) sj, jsonb_array_elements(sj -> 'zones') zj
        where zj ? 'id');
  delete from public.shelves
   where fridge_id = p_fridge_id
     and id::text not in (select sj ->> 'id' from jsonb_array_elements(p_shelves) sj where sj ? 'id');

  -- 2. Keep or create, in the new order. Positions are unique per fridge /
  --    per shelf, but the constraints are deferred, so swapping is fine.
  for v_shelf_js in select * from jsonb_array_elements(p_shelves) loop
    v_shelf_no := v_shelf_no + 1;
    if jsonb_typeof(v_shelf_js -> 'zones') is distinct from 'array'
       or jsonb_array_length(v_shelf_js -> 'zones') not between 1 and 6 then
      raise exception 'shelf % needs 1 to 6 zones', v_shelf_no using errcode = 'check_violation';
    end if;

    v_shelf := null;
    update public.shelves set position = v_shelf_no
     where id = (v_shelf_js ->> 'id')::uuid and fridge_id = p_fridge_id
    returning id into v_shelf;
    if v_shelf is null then
      insert into public.shelves (fridge_id, cellar_id, position)
      values (p_fridge_id, v_cellar, v_shelf_no)
      returning id into v_shelf;
    end if;

    v_zone_no := 0;
    for v_zone_js in select * from jsonb_array_elements(v_shelf_js -> 'zones') loop
      v_zone_no := v_zone_no + 1;
      v_zone := null;
      update public.shelf_zones
         set position = v_zone_no,
             kind     = (v_zone_js ->> 'kind')::public.zone_kind,
             capacity = (v_zone_js ->> 'capacity')::int,
             label    = nullif(trim(v_zone_js ->> 'label'), '')
       where id = (v_zone_js ->> 'id')::uuid and shelf_id = v_shelf
      returning id into v_zone;
      if v_zone is null then
        insert into public.shelf_zones (shelf_id, cellar_id, position, kind, capacity, label)
        values (v_shelf, v_cellar, v_zone_no, (v_zone_js ->> 'kind')::public.zone_kind,
                (v_zone_js ->> 'capacity')::int, nullif(trim(v_zone_js ->> 'label'), ''))
        returning id into v_zone;
      else
        -- A smaller stack: the newest bottles beyond the capacity leave.
        update public.bottles
           set status = 'unplaced', zone_id = null, slot = null
         where id in (
           select b.id from public.bottles b
            where b.zone_id = v_zone
            order by b.added_on desc, b.created_at desc
           offset (v_zone_js ->> 'capacity')::int);
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.update_fridge(uuid, text, jsonb, text, text) from public, anon;
grant  execute on function public.update_fridge(uuid, text, jsonb, text, text) to authenticated;

-- =====================================================================
-- create_fridge(): build a whole fridge – shelves and zones – at once.
--
-- Why a database function and not code in the website:
-- * One transaction: a half-built fridge can never be saved.
-- * One place for the rules: the website today and the MCP server later
--   both call this, so neither can skip the validation.
-- * SECURITY INVOKER: it runs as the caller, so RLS still decides
--   (a viewer, or someone from another cellar, is refused).
--
-- p_shelves is a JSON array, top shelf first:
--   [ { "zones": [ { "kind": "row",   "capacity": 5, "label": "אחורית" },
--                  { "kind": "row",   "capacity": 5, "label": "קדמית"  } ] },
--     { "zones": [ { "kind": "stack", "capacity": 8, "label": "ערימה"  } ] } ]
-- =====================================================================

create function public.create_fridge(
  p_name     text,
  p_shelves  jsonb,
  p_brand    text default null,
  p_model    text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar   uuid := public.my_cellar_id();
  v_fridge   uuid;
  v_shelf    uuid;
  v_shelf_js jsonb;
  v_zone_js  jsonb;
  v_shelf_no int := 0;
  v_zone_no  int;
begin
  if v_cellar is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  -- Shape checks. Lengths and ranges are also enforced by the table
  -- constraints; these give clearer messages for the common mistakes.
  if jsonb_typeof(p_shelves) is distinct from 'array'
     or jsonb_array_length(p_shelves) not between 1 and 30 then
    raise exception 'a fridge needs 1 to 30 shelves' using errcode = 'check_violation';
  end if;

  insert into public.fridges (cellar_id, name, brand, model, position)
  values (
    v_cellar,
    trim(p_name),
    nullif(trim(p_brand), ''),
    nullif(trim(p_model), ''),
    (select count(*) from public.fridges where cellar_id = v_cellar)
  )
  returning id into v_fridge;

  for v_shelf_js in select * from jsonb_array_elements(p_shelves) loop
    v_shelf_no := v_shelf_no + 1;

    if jsonb_typeof(v_shelf_js -> 'zones') is distinct from 'array'
       or jsonb_array_length(v_shelf_js -> 'zones') not between 1 and 6 then
      raise exception 'shelf % needs 1 to 6 zones', v_shelf_no using errcode = 'check_violation';
    end if;

    insert into public.shelves (fridge_id, cellar_id, position)
    values (v_fridge, v_cellar, v_shelf_no)
    returning id into v_shelf;

    v_zone_no := 0;
    for v_zone_js in select * from jsonb_array_elements(v_shelf_js -> 'zones') loop
      v_zone_no := v_zone_no + 1;
      insert into public.shelf_zones (shelf_id, cellar_id, position, kind, capacity, label)
      values (
        v_shelf,
        v_cellar,
        v_zone_no,
        (v_zone_js ->> 'kind')::public.zone_kind,   -- anything but row/stack fails here
        (v_zone_js ->> 'capacity')::int,            -- the table checks 1..50
        nullif(trim(v_zone_js ->> 'label'), '')
      );
    end loop;
  end loop;

  return v_fridge;
end;
$$;

revoke execute on function public.create_fridge(text, jsonb, text, text) from public, anon;
grant  execute on function public.create_fridge(text, jsonb, text, text) to authenticated;

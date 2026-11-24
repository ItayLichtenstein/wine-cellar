-- =====================================================================
-- add_bottles(): "I bought N bottles of this wine" in one transaction.
--
-- 1. Finds the wine by winery + name (case-insensitive) or creates it.
--    So "קומטו" bought twice is one wine, not two.
-- 2. Finds the vintage (year, or NV when year is null) or creates it.
--    A drinking window given here fills in / updates the vintage.
-- 3. Creates the bottles. The first ones go to the places given
--    (zone + slot); the rest are "outside the fridge" or "in transit".
-- 4. Stores the price per bottle (in its own table – ADR 0003).
--
-- Like create_fridge(), this is the shared entry point for the website
-- and the future MCP server, and it runs as the caller (RLS applies).
-- Two bottles racing for one slot: the unique (zone_id, slot) constraint
-- lets exactly one win; the other call fails as a whole.
-- =====================================================================

create function public.add_bottles(
  p_winery      text,
  p_name        text,
  p_quantity    int,
  p_type        public.wine_type     default 'red',
  p_year        int                  default null,
  p_places      jsonb                default '[]',   -- [{ "zone_id": "...", "slot": 3 }, { "zone_id": "..." }]
  p_rest_status public.bottle_status default 'unplaced',
  p_paid        numeric              default null,
  p_regular     numeric              default null,
  p_is_gift     boolean              default false,
  p_drink_from  int                  default null,
  p_drink_to    int                  default null
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar   uuid := public.my_cellar_id();
  v_wine     uuid;
  v_vintage  uuid;
  v_bottle   uuid;
  v_place    jsonb;
  v_ids      uuid[] := '{}';
  v_has_price boolean := p_paid is not null or p_regular is not null or p_is_gift;
begin
  if v_cellar is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_quantity not between 1 and 48 then
    raise exception 'quantity must be 1 to 48' using errcode = 'check_violation';
  end if;
  if p_rest_status not in ('unplaced', 'in_transit') then
    raise exception 'bottles without a place are either unplaced or in transit'
      using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_places) is distinct from 'array'
     or jsonb_array_length(p_places) > p_quantity then
    raise exception 'more places than bottles' using errcode = 'check_violation';
  end if;

  -- 1. Wine: reuse or create.
  select id into v_wine from public.wines
   where cellar_id = v_cellar
     and lower(winery) = lower(trim(p_winery))
     and lower(name)   = lower(trim(p_name));

  if v_wine is null then
    insert into public.wines (cellar_id, winery, name, type)
    values (v_cellar, trim(p_winery), trim(p_name), p_type)
    returning id into v_wine;
  end if;

  -- 2. Vintage: reuse or create. (IS NOT DISTINCT FROM: null = null for NV.)
  select id into v_vintage from public.wine_vintages
   where wine_id = v_wine and year is not distinct from p_year;

  if v_vintage is null then
    insert into public.wine_vintages (wine_id, cellar_id, year, drink_from, drink_to)
    values (v_wine, v_cellar, p_year, p_drink_from, p_drink_to)
    returning id into v_vintage;
  elsif p_drink_from is not null or p_drink_to is not null then
    update public.wine_vintages
       set drink_from = coalesce(p_drink_from, drink_from),
           drink_to   = coalesce(p_drink_to, drink_to)
     where id = v_vintage;
  end if;

  -- 3 + 4. Bottles and prices.
  for i in 1 .. p_quantity loop
    v_place := p_places -> (i - 1);   -- null once the places run out

    insert into public.bottles (cellar_id, vintage_id, status, zone_id, slot)
    values (
      v_cellar,
      v_vintage,
      case when v_place is null then p_rest_status else 'stored' end,
      (v_place ->> 'zone_id')::uuid,
      (v_place ->> 'slot')::int
    )
    returning id into v_bottle;

    if v_has_price then
      insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
      values (v_bottle, v_cellar, p_paid, p_regular, p_is_gift);
    end if;

    v_ids := v_ids || v_bottle;
  end loop;

  return v_ids;
end;
$$;

revoke execute on function public.add_bottles(text, text, int, public.wine_type, int, jsonb, public.bottle_status, numeric, numeric, boolean, int, int) from public, anon;
grant  execute on function public.add_bottles(text, text, int, public.wine_type, int, jsonb, public.bottle_status, numeric, numeric, boolean, int, int) to authenticated;

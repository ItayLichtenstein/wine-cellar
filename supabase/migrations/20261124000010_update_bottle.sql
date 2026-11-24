-- =====================================================================
-- update_bottle(): fix the details of a bottle, in one transaction.
--
-- Fields live on three levels (ADR 0002), so an edit lands where the
-- field belongs:
--   wine    (winery, name, type)       -> changes for EVERY bottle of the wine
--   vintage (year, drinking window)    -> a new year moves the bottle to that
--                                         vintage (found or created)
--   bottle  (price, note, link)        -> this bottle only
-- Renaming a wine to a name that already exists in the cellar fails with
-- 23505 (merging two wines is a separate, deliberate action).
-- Runs as the caller, so RLS applies.
-- =====================================================================

create function public.update_bottle(
  p_bottle_id  uuid,
  p_winery     text,
  p_name       text,
  p_type       public.wine_type,
  p_year       int,
  p_drink_from int,
  p_drink_to   int,
  p_paid       numeric,
  p_regular    numeric,
  p_is_gift    boolean,
  p_note       text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bottle  public.bottles;
  v_wine    uuid;
  v_vintage uuid;
begin
  select * into v_bottle from public.bottles where id = p_bottle_id for update;
  if not found then
    raise exception 'bottle not found' using errcode = 'no_data_found';
  end if;

  select wine_id into v_wine from public.wine_vintages where id = v_bottle.vintage_id;

  -- Wine level.
  update public.wines
     set winery = trim(p_winery), name = trim(p_name), type = p_type
   where id = v_wine;

  -- Vintage level: reuse the vintage of that year, or create it.
  select id into v_vintage from public.wine_vintages
   where wine_id = v_wine and year is not distinct from p_year;
  if v_vintage is null then
    insert into public.wine_vintages (wine_id, cellar_id, year)
    values (v_wine, v_bottle.cellar_id, p_year)
    returning id into v_vintage;
  end if;
  update public.wine_vintages
     set drink_from = p_drink_from, drink_to = p_drink_to
   where id = v_vintage;

  -- Bottle level.
  update public.bottles
     set vintage_id = v_vintage, note = nullif(trim(p_note), '')
   where id = p_bottle_id;

  if p_paid is null and p_regular is null and not coalesce(p_is_gift, false) then
    delete from public.bottle_prices where bottle_id = p_bottle_id;
  else
    insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
    values (p_bottle_id, v_bottle.cellar_id, p_paid, p_regular, coalesce(p_is_gift, false))
    on conflict (bottle_id) do update
      set paid = excluded.paid, regular = excluded.regular, is_gift = excluded.is_gift;
  end if;
end;
$$;

revoke execute on function public.update_bottle(uuid, text, text, public.wine_type, int, int, int, numeric, numeric, boolean, text) from public, anon;
grant  execute on function public.update_bottle(uuid, text, text, public.wine_type, int, int, int, numeric, numeric, boolean, text) to authenticated;

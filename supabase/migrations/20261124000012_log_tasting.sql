-- =====================================================================
-- log_tasting(): "we drank this outside the cellar" (restaurant, friends).
-- A tasting with no bottle: finds or creates the wine and vintage (same
-- rules as add_bottles), records the tasting, and the score if given.
-- The wine then exists in the cellar's catalog with no bottles, which is
-- what lets the history, ratings and a future "buy again" refer to it.
-- Runs as the caller (RLS applies); a viewer is refused by the policies.
-- =====================================================================

create function public.log_tasting(
  p_winery    text,
  p_name      text,
  p_type      public.wine_type default 'red',
  p_year      int              default null,
  p_tasted_on date             default current_date,
  p_place     text             default null,
  p_notes     text             default null,
  p_score     numeric          default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar  uuid := public.my_cellar_id();
  v_wine    uuid;
  v_vintage uuid;
  v_tasting uuid;
begin
  if v_cellar is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  -- The database runs in UTC, but "today" in Israel (or anywhere) can be
  -- up to 14 hours ahead – so one day of slack, not more.
  if p_tasted_on > current_date + 1 then
    raise exception 'a tasting cannot be in the future' using errcode = 'check_violation';
  end if;

  select id into v_wine from public.wines
   where cellar_id = v_cellar
     and lower(winery) = lower(trim(p_winery))
     and lower(name)   = lower(trim(p_name));
  if v_wine is null then
    insert into public.wines (cellar_id, winery, name, type)
    values (v_cellar, trim(p_winery), trim(p_name), p_type)
    returning id into v_wine;
  end if;

  select id into v_vintage from public.wine_vintages
   where wine_id = v_wine and year is not distinct from p_year;
  if v_vintage is null then
    insert into public.wine_vintages (wine_id, cellar_id, year)
    values (v_wine, v_cellar, p_year)
    returning id into v_vintage;
  end if;

  insert into public.tastings (cellar_id, wine_id, vintage_id, tasted_on, place, notes)
  values (v_cellar, v_wine, v_vintage, p_tasted_on, nullif(trim(p_place), ''), nullif(trim(p_notes), ''))
  returning id into v_tasting;

  if p_score is not null then
    perform public.set_rating(v_wine, p_score, v_vintage);
  end if;
  return v_tasting;
end;
$$;

revoke execute on function public.log_tasting(text, text, public.wine_type, int, date, text, text, numeric) from public, anon;
grant  execute on function public.log_tasting(text, text, public.wine_type, int, date, text, text, numeric) to authenticated;

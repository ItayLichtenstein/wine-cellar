-- =====================================================================
-- A ceiling on how much one cellar can hold, so no single account (a
-- script, an AI in a loop, repeated imports) can fill the shared free-tier
-- database (500MB). Far above any real cellar: a big collector has a few
-- thousand bottles. History and ratings count too, and are never deleted.
--
-- One statement-level trigger per table: it runs once per INSERT, even an
-- import of 2,000 rows, and counts only the cellars that statement touched.
-- Over the cap, the whole insert is refused (hint 'cellar_full').
-- =====================================================================

create function public.check_cellar_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap int := tg_argv[0]::int;
  v_full uuid;
begin
  execute format(
    'select c.cellar_id from (select distinct cellar_id from new_rows) c
      where (select count(*) from public.%I t where t.cellar_id = c.cellar_id) > $1 limit 1',
    tg_table_name)
    into v_full using v_cap;
  if v_full is not null then
    raise exception 'the cellar is full (% %)', v_cap, tg_table_name using errcode = 'check_violation', hint = 'cellar_full';
  end if;
  return null;
end;
$$;
revoke execute on function public.check_cellar_cap() from public, anon, authenticated;

do $$
declare
  caps constant jsonb := '{
    "bottles": 10000, "wines": 5000, "wine_vintages": 10000, "tastings": 10000, "ratings": 20000,
    "critic_scores": 20000, "wishlist_items": 1000, "fridges": 20, "shelves": 600, "shelf_zones": 2000,
    "imports": 500, "share_links": 200
  }';
  t text;
begin
  for t in select jsonb_object_keys(caps) loop
    execute format(
      'create trigger %I after insert on public.%I referencing new table as new_rows for each statement execute function public.check_cellar_cap(%L)',
      t || '_cap', t, caps ->> t);
  end loop;
end;
$$;

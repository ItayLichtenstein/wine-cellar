-- Import from a file (spec: "ייבוא מקובץ", stage A: CSV).
--
-- The browser reads the file and sends only structured rows; the file itself
-- never reaches the server. import_cellar() writes everything in ONE
-- transaction (all or nothing) as the signed-in user (security invoker), so
-- the usual RLS applies. Every import is recorded, and what it created
-- carries its import_id, so the last import can be undone within a week.

create table public.imports (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null references public.cellars (id) on delete cascade,
  source      text not null check (char_length(source) between 1 and 40),
  -- SHA-256 of the file, to warn "this file was already imported".
  file_hash   text check (file_hash ~ '^[0-9a-f]{64}$'),
  wines       int not null default 0 check (wines >= 0),
  bottles     int not null default 0 check (bottles >= 0),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz
);
create index imports_cellar on public.imports (cellar_id, created_at desc);

alter table public.imports enable row level security;

create policy "members read their cellar's imports" on public.imports
  for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "editors record imports" on public.imports
  for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "editors mark imports undone" on public.imports
  for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));

alter table public.wines         add column import_id uuid references public.imports (id) on delete set null;
alter table public.wine_vintages add column import_id uuid references public.imports (id) on delete set null;
alter table public.bottles       add column import_id uuid references public.imports (id) on delete set null;
create index bottles_import  on public.bottles (import_id) where import_id is not null;
create index vintages_import on public.wine_vintages (import_id) where import_id is not null;
create index wines_import    on public.wines (import_id) where import_id is not null;

/**
 * p_bottles: one JSON object per bottle (the browser expands quantities):
 * winery, name (required), type, grape, country, region, kosher, year,
 * drink_from, drink_to, peak_from, peak_to, alcohol, status
 * ('unplaced' | 'in_transit' | 'consumed'), added_on, consumed_on, note,
 * link_url, paid, regular, is_gift.
 * A wine that already exists (same winery and name, any case) is reused.
 * Bottles never go into a fridge here: they land outside it, to be placed.
 */
create function public.import_cellar(p_source text, p_file_hash text, p_bottles jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar  uuid := public.my_cellar_id();
  v_import  uuid;
  b         jsonb;
  v_wine    uuid;
  v_vintage uuid;
  v_bottle  uuid;
  v_year    int;
  v_wines   int := 0;
  v_count   int := 0;
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_bottles) <> 'array' or jsonb_array_length(p_bottles) not between 1 and 2000 then
    raise exception 'between 1 and 2000 bottles' using errcode = '22023';
  end if;

  insert into public.imports (cellar_id, source, file_hash)
  values (v_cellar, p_source, p_file_hash)
  returning id into v_import;

  for b in select value from jsonb_array_elements(p_bottles) loop
    select w.id into v_wine
    from public.wines w
    where w.cellar_id = v_cellar
      and lower(w.winery) = lower(b ->> 'winery')
      and lower(w.name) = lower(b ->> 'name');

    if v_wine is null then
      insert into public.wines (cellar_id, winery, name, type, grape, country, region, kosher, import_id)
      values (
        v_cellar, b ->> 'winery', b ->> 'name',
        coalesce((b ->> 'type')::public.wine_type, 'red'),
        b ->> 'grape', b ->> 'country', b ->> 'region',
        coalesce((b ->> 'kosher')::public.kosher_status, 'unknown'),
        v_import
      )
      returning id into v_wine;
      v_wines := v_wines + 1;
    end if;

    v_year := (b ->> 'year')::int;
    select v.id into v_vintage
    from public.wine_vintages v
    where v.wine_id = v_wine and v.year is not distinct from v_year;

    if v_vintage is null then
      insert into public.wine_vintages (wine_id, cellar_id, year, drink_from, drink_to, peak_from, peak_to, alcohol, import_id)
      values (
        v_wine, v_cellar, v_year,
        (b ->> 'drink_from')::int, (b ->> 'drink_to')::int,
        (b ->> 'peak_from')::int, (b ->> 'peak_to')::int,
        (b ->> 'alcohol')::numeric, v_import
      )
      returning id into v_vintage;
    end if;

    insert into public.bottles (cellar_id, vintage_id, status, added_on, consumed_on, note, link_url, import_id)
    values (
      v_cellar, v_vintage,
      coalesce((b ->> 'status')::public.bottle_status, 'unplaced'),
      coalesce((b ->> 'added_on')::date, current_date),
      (b ->> 'consumed_on')::date,
      b ->> 'note', b ->> 'link_url', v_import
    )
    returning id into v_bottle;

    if b ->> 'paid' is not null or b ->> 'regular' is not null or (b ->> 'is_gift')::boolean then
      insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
      values (v_bottle, v_cellar, (b ->> 'paid')::numeric, (b ->> 'regular')::numeric, coalesce((b ->> 'is_gift')::boolean, false));
    end if;

    v_count := v_count + 1;
  end loop;

  update public.imports set wines = v_wines, bottles = v_count where id = v_import;
  return jsonb_build_object('import_id', v_import, 'wines', v_wines, 'bottles', v_count);
end;
$$;

revoke execute on function public.import_cellar(text, text, jsonb) from public, anon;
grant execute on function public.import_cellar(text, text, jsonb) to authenticated;

/**
 * Undo the cellar's last import, if it is less than a week old: deletes the
 * bottles it created, then the vintages and wines it created that have no
 * bottles left (a wine that existed before keeps its other bottles).
 * Returns how many bottles were removed.
 */
create function public.undo_last_import()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
  v_import uuid;
  v_count  int;
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select i.id into v_import
  from public.imports i
  where i.cellar_id = v_cellar and i.undone_at is null and i.created_at > now() - interval '7 days'
  order by i.created_at desc
  limit 1;
  if v_import is null then
    raise exception 'nothing to undo' using errcode = 'P0002';
  end if;

  delete from public.bottles where import_id = v_import and cellar_id = v_cellar;
  get diagnostics v_count = row_count;
  delete from public.wine_vintages v
  where v.import_id = v_import and v.cellar_id = v_cellar
    and not exists (select 1 from public.bottles x where x.vintage_id = v.id);
  delete from public.wines w
  where w.import_id = v_import and w.cellar_id = v_cellar
    and not exists (select 1 from public.wine_vintages x where x.wine_id = w.id);
  update public.imports set undone_at = now() where id = v_import;
  return v_count;
end;
$$;

revoke execute on function public.undo_last_import() from public, anon;
grant execute on function public.undo_last_import() to authenticated;

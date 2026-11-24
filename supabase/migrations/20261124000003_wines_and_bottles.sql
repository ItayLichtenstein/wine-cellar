-- =====================================================================
-- Wines and bottles: wine -> vintage -> bottle (ADR 0002),
-- with prices in their own table (ADR 0003).
-- =====================================================================

create type public.wine_type as enum
  ('red', 'white', 'rose', 'orange', 'sparkling', 'dessert', 'fortified', 'other');
create type public.kosher_status as enum ('yes', 'no', 'unknown');
create type public.bottle_shape  as enum ('standard', 'burgundy');
create type public.window_source as enum ('critic', 'estimate');  -- "מבקר או חנות" / "הערכה"
create type public.bottle_status as enum ('stored', 'unplaced', 'in_transit', 'consumed');

-- ---------- Wine: winery + name, private to one cellar ----------

create table public.wines (
  id                uuid primary key default gen_random_uuid(),
  cellar_id         uuid not null references public.cellars (id) on delete cascade,
  winery            text not null,
  name              text not null,
  type              public.wine_type not null default 'red',
  grape             text,
  country           text,
  region            text,
  kosher            public.kosher_status not null default 'unknown',
  shape             public.bottle_shape not null default 'standard',
  label_image_path  text,              -- path in Supabase Storage
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, cellar_id)
);

-- The same wine may not be entered twice in a cellar (case-insensitive).
create unique index wines_unique_per_cellar
  on public.wines (cellar_id, lower(winery), lower(name));

-- ---------- Vintage: a wine in a given year ----------

create table public.wine_vintages (
  id             uuid primary key default gen_random_uuid(),
  wine_id        uuid not null,
  cellar_id      uuid not null,
  year           int check (year between 1900 and 2100),  -- null = non-vintage (NV)
  drink_from     int check (drink_from between 1900 and 2200),
  drink_to       int check (drink_to   between 1900 and 2200),
  peak_from      int check (peak_from  between 1900 and 2200),
  peak_to        int check (peak_to    between 1900 and 2200),
  window_source  public.window_source,
  alcohol        numeric(4,1) check (alcohol between 0 and 25),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (wine_id, cellar_id) references public.wines (id, cellar_id) on delete cascade,
  unique (id, cellar_id),
  -- One row per year; NULLS NOT DISTINCT makes "NV" count as one value too.
  unique nulls not distinct (wine_id, year),
  check (drink_from is null or drink_to is null or drink_from <= drink_to),
  check (peak_from  is null or peak_to  is null or peak_from  <= peak_to)
);

create table public.critic_scores (
  id          uuid primary key default gen_random_uuid(),
  vintage_id  uuid not null,
  cellar_id   uuid not null,
  critic      text not null,           -- "Suckling", "Wine Advocate", ...
  score       int not null check (score between 50 and 100),
  created_at  timestamptz not null default now(),
  foreign key (vintage_id, cellar_id) references public.wine_vintages (id, cellar_id) on delete cascade
);

-- ---------- Bottle: one physical bottle ----------

create table public.bottles (
  id           uuid primary key default gen_random_uuid(),
  cellar_id    uuid not null,
  vintage_id   uuid not null,
  status       public.bottle_status not null default 'unplaced',
  zone_id      uuid,                   -- set only while stored
  slot         int check (slot >= 1),  -- set only in a row zone
  link_url     text check (link_url ~* '^https?://'),
  note         text,
  added_on     date not null default current_date,  -- needed for the year summary
  consumed_on  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (vintage_id, cellar_id) references public.wine_vintages (id, cellar_id) on delete cascade,
  -- Composite FK: a bottle can only be placed in a zone of its own cellar.
  -- (Ignored while zone_id is null.)
  foreign key (zone_id, cellar_id) references public.shelf_zones (id, cellar_id),
  unique (id, cellar_id),
  -- Two bottles can never share a slot – the race-condition guard.
  unique (zone_id, slot),
  check ((status = 'stored') = (zone_id is not null)),
  check (zone_id is not null or slot is null),
  check ((status = 'consumed') = (consumed_on is not null))
);

-- Prices live apart so RLS can hide them per friend (ADR 0003).
create table public.bottle_prices (
  bottle_id   uuid primary key,
  cellar_id   uuid not null,
  paid        numeric(10,2) check (paid >= 0),     -- what we paid (0 for a gift)
  regular     numeric(10,2) check (regular >= 0),  -- usual price / estimate for a gift
  is_gift     boolean not null default false,
  updated_at  timestamptz not null default now(),
  foreign key (bottle_id, cellar_id) references public.bottles (id, cellar_id) on delete cascade
);

create trigger wines_updated_at    before update on public.wines         for each row execute function public.set_updated_at();
create trigger vintages_updated_at before update on public.wine_vintages for each row execute function public.set_updated_at();
create trigger bottles_updated_at  before update on public.bottles       for each row execute function public.set_updated_at();
create trigger prices_updated_at   before update on public.bottle_prices for each row execute function public.set_updated_at();

-- ---------- Placement rules the simple constraints can't express ----------

-- A row needs a slot within its capacity; a stack has no slots but a limit.
create function public.check_bottle_placement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind     public.zone_kind;
  v_capacity int;
  v_count    int;
begin
  if new.zone_id is null then
    return new;
  end if;

  select kind, capacity into v_kind, v_capacity
  from public.shelf_zones where id = new.zone_id;

  if v_kind = 'row' then
    if new.slot is null or new.slot > v_capacity then
      raise exception 'slot % is outside this row (capacity %)', new.slot, v_capacity
        using errcode = 'check_violation';
    end if;
  else
    if new.slot is not null then
      raise exception 'bottles in a stack have no slot number'
        using errcode = 'check_violation';
    end if;
    select count(*) into v_count
    from public.bottles where zone_id = new.zone_id and id <> new.id;
    if v_count >= v_capacity then
      raise exception 'stack is full (capacity %)', v_capacity
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger bottles_check_placement
  before insert or update of zone_id, slot on public.bottles
  for each row execute function public.check_bottle_placement();

-- Removing a zone (or shrinking a row) never deletes bottles:
-- the affected bottles move to "outside the fridge". The UI warns first.
create function public.unplace_bottles_of_zone()
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

  -- UPDATE: row shrank or turned into a stack
  update public.bottles
     set status = 'unplaced', zone_id = null, slot = null
   where zone_id = new.id
     and (new.kind = 'stack' or slot > new.capacity);
  return new;
end;
$$;

create trigger zones_unplace_on_delete
  before delete on public.shelf_zones
  for each row execute function public.unplace_bottles_of_zone();

create trigger zones_unplace_on_shrink
  before update of capacity, kind on public.shelf_zones
  for each row execute function public.unplace_bottles_of_zone();

-- ---------- Row Level Security ----------

alter table public.wines         enable row level security;
alter table public.wine_vintages enable row level security;
alter table public.critic_scores enable row level security;
alter table public.bottles       enable row level security;
alter table public.bottle_prices enable row level security;

create policy "wines: members read"      on public.wines for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "wines: editors insert"    on public.wines for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "wines: editors update"    on public.wines for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "wines: editors delete"    on public.wines for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "vintages: members read"   on public.wine_vintages for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "vintages: editors insert" on public.wine_vintages for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "vintages: editors update" on public.wine_vintages for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "vintages: editors delete" on public.wine_vintages for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "critics: members read"    on public.critic_scores for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "critics: editors insert"  on public.critic_scores for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "critics: editors update"  on public.critic_scores for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "critics: editors delete"  on public.critic_scores for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "bottles: members read"    on public.bottles for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "bottles: editors insert"  on public.bottles for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "bottles: editors update"  on public.bottles for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "bottles: editors delete"  on public.bottles for delete to authenticated using (public.is_cellar_editor(cellar_id));

-- Stage 4 adds: friends whose friend_links.shows_prices is on may read prices.
create policy "prices: members read"     on public.bottle_prices for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "prices: editors insert"   on public.bottle_prices for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "prices: editors update"   on public.bottle_prices for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "prices: editors delete"   on public.bottle_prices for delete to authenticated using (public.is_cellar_editor(cellar_id));

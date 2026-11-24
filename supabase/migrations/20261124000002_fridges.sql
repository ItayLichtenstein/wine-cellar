-- =====================================================================
-- Fridges: fridge -> shelves -> zones.
--
-- A zone is either a numbered row of slots or a stack with a capacity.
-- Any real layout is built from these two pieces: front + back rows,
-- a single row, a stack, or a two-high stack (= two stack zones).
--
-- Tenant safety: shelves and zones repeat cellar_id and point to their
-- parent with a COMPOSITE foreign key (parent_id, cellar_id). The database
-- therefore guarantees a shelf can never sit in another cellar's fridge,
-- and RLS policies stay a simple is_cellar_member(cellar_id).
-- =====================================================================

create type public.zone_kind as enum ('row', 'stack');

-- Catalog of fridge models. The layout is only a template that gets COPIED
-- into the user's own tables, so JSON is enough here.
create table public.fridge_models (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  model       text not null,
  layout      jsonb not null,
  created_at  timestamptz not null default now(),
  unique (brand, model)
);

create table public.fridges (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null references public.cellars (id) on delete cascade,
  model_id    uuid references public.fridge_models (id) on delete set null,  -- template it came from
  name        text not null,
  brand       text,
  model       text,
  position    int not null default 0,  -- order of fridges in the UI
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, cellar_id)               -- target for composite foreign keys
);

create table public.shelves (
  id          uuid primary key default gen_random_uuid(),
  fridge_id   uuid not null,
  cellar_id   uuid not null,
  position    int not null,            -- 1 = top shelf
  created_at  timestamptz not null default now(),
  foreign key (fridge_id, cellar_id) references public.fridges (id, cellar_id) on delete cascade,
  unique (id, cellar_id),
  -- Deferred so shelves can be reordered inside one transaction.
  unique (fridge_id, position) deferrable initially deferred
);

create table public.shelf_zones (
  id          uuid primary key default gen_random_uuid(),
  shelf_id    uuid not null,
  cellar_id   uuid not null,
  position    int not null,            -- order inside the shelf (back to front)
  kind        public.zone_kind not null,
  capacity    int not null check (capacity between 1 and 50),
  label       text,                    -- e.g. "אחורית", "קדמית", "שכבה עליונה"
  created_at  timestamptz not null default now(),
  foreign key (shelf_id, cellar_id) references public.shelves (id, cellar_id) on delete cascade,
  unique (id, cellar_id),
  unique (shelf_id, position) deferrable initially deferred
);

create trigger fridges_updated_at before update on public.fridges
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------

alter table public.fridge_models enable row level security;
alter table public.fridges       enable row level security;
alter table public.shelves       enable row level security;
alter table public.shelf_zones   enable row level security;

-- The catalog is readable by every signed-in user and written only by us (seed).
create policy "fridge_models: signed-in read"
  on public.fridge_models for select to authenticated using (true);

-- Same four policies for each cellar-owned table:
-- members (and viewers) read, editors write.
create policy "fridges: members read"   on public.fridges for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "fridges: editors insert" on public.fridges for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "fridges: editors update" on public.fridges for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "fridges: editors delete" on public.fridges for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "shelves: members read"   on public.shelves for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "shelves: editors insert" on public.shelves for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "shelves: editors update" on public.shelves for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "shelves: editors delete" on public.shelves for delete to authenticated using (public.is_cellar_editor(cellar_id));

create policy "zones: members read"     on public.shelf_zones for select to authenticated using (public.is_cellar_member(cellar_id));
create policy "zones: editors insert"   on public.shelf_zones for insert to authenticated with check (public.is_cellar_editor(cellar_id));
create policy "zones: editors update"   on public.shelf_zones for update to authenticated using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "zones: editors delete"   on public.shelf_zones for delete to authenticated using (public.is_cellar_editor(cellar_id));

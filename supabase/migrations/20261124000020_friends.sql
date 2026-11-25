-- =====================================================================
-- Friends (stage 4). Friendship is between CELLARS, not people: whoever
-- joins a household gets its friends, whoever leaves loses them.
--
-- friend_links has two rows per friendship, one per direction:
--   (owner_cellar_id, friend_cellar_id, shows_prices)
-- "May Maya see my prices?" is then a one-row lookup, and each side
-- controls its own switch (spec: per friend and per direction, off by default).
--
-- A friend READS the whole cellar (fridges, bottles, ratings, notes,
-- history, wishlist), never writes, and sees prices only if shows_prices.
-- Household data (members, invites) stays private.
-- The app filters every query by cellar (ADR 0008), so a friend's bottles
-- never mix into my own fridge.
-- =====================================================================

create table public.friend_links (
  owner_cellar_id  uuid not null references public.cellars (id) on delete cascade,
  friend_cellar_id uuid not null references public.cellars (id) on delete cascade,
  shows_prices     boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (owner_cellar_id, friend_cellar_id),
  check (owner_cellar_id <> friend_cellar_id)
);
create index on public.friend_links (friend_cellar_id);

alter table public.friend_links enable row level security;

-- Both sides of a friendship see its rows (to show "they share prices with you").
-- All writes go through the functions below.
create policy "friend links: both sides read"
  on public.friend_links for select to authenticated
  using (public.is_cellar_member(owner_cellar_id) or public.is_cellar_member(friend_cellar_id));

create table public.friend_invites (
  id           uuid primary key default gen_random_uuid(),
  cellar_id    uuid not null references public.cellars (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  shows_prices boolean not null default false,  -- the sender's choice
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz
);

alter table public.friend_invites enable row level security;

create policy "friend invites: members read"
  on public.friend_invites for select to authenticated
  using (public.is_cellar_member(cellar_id));
create policy "friend invites: editors revoke"
  on public.friend_invites for delete to authenticated
  using (public.is_cellar_editor(cellar_id));

grant select, insert, update, delete on public.friend_links, public.friend_invites to authenticated;

-- ---------- who may read what ----------

-- Is this cellar a friend of mine (it lets my cellar in)?
create function public.is_friend_cellar(p_cellar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friend_links
     where owner_cellar_id = p_cellar_id and friend_cellar_id = public.my_cellar_id()
  );
$$;

-- Read access: my household, or a friend cellar.
create function public.can_read_cellar(p_cellar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_cellar_member(p_cellar_id) or public.is_friend_cellar(p_cellar_id);
$$;

-- Prices: my household, or a friend that chose to show me theirs.
create function public.can_read_prices(p_cellar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_cellar_member(p_cellar_id) or exists (
    select 1 from public.friend_links
     where owner_cellar_id = p_cellar_id and friend_cellar_id = public.my_cellar_id() and shows_prices
  );
$$;

revoke execute on function public.is_friend_cellar(uuid), public.can_read_cellar(uuid), public.can_read_prices(uuid) from public, anon;
grant  execute on function public.is_friend_cellar(uuid), public.can_read_cellar(uuid), public.can_read_prices(uuid) to authenticated;

-- Swap "members read" for "members and friends read" on the cellar's content.
drop policy "fridges: members read"   on public.fridges;
drop policy "shelves: members read"   on public.shelves;
drop policy "zones: members read"     on public.shelf_zones;
drop policy "wines: members read"     on public.wines;
drop policy "vintages: members read"  on public.wine_vintages;
drop policy "critics: members read"   on public.critic_scores;
drop policy "bottles: members read"   on public.bottles;
drop policy "prices: members read"    on public.bottle_prices;
drop policy "ratings: members read"   on public.ratings;
drop policy "tastings: members read"  on public.tastings;
drop policy "wishlist: members read"  on public.wishlist_items;

create policy "fridges: members and friends read"  on public.fridges        for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "shelves: members and friends read"  on public.shelves        for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "zones: members and friends read"    on public.shelf_zones    for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "wines: members and friends read"    on public.wines          for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "vintages: members and friends read" on public.wine_vintages  for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "critics: members and friends read"  on public.critic_scores  for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "bottles: members and friends read"  on public.bottles        for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "prices: members and allowed friends read" on public.bottle_prices for select to authenticated using (public.can_read_prices(cellar_id));
create policy "ratings: members and friends read"  on public.ratings        for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "tastings: members and friends read" on public.tastings       for select to authenticated using (public.can_read_cellar(cellar_id));
create policy "wishlist: members and friends read" on public.wishlist_items for select to authenticated using (public.can_read_cellar(cellar_id));

-- Label photos: the folder is the cellar id.
drop policy "labels: members read" on storage.objects;
create policy "labels: members and friends read"
  on storage.objects for select to authenticated
  using (bucket_id = 'labels' and public.can_read_cellar(((storage.foldername(name))[1])::uuid));

-- Names: a friend sees the display names of the friend cellar's people
-- (cellar title, who rated what). Never emails – they are not in profiles.
-- Definer: the membership lookup must see the friend's cellar_members rows,
-- which RLS keeps private to the household.
create function public.can_read_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid()) or exists (
    select 1 from public.cellar_members m
     where m.user_id = p_user_id and public.can_read_cellar(m.cellar_id)
  );
$$;
revoke execute on function public.can_read_profile(uuid) from public, anon;
grant  execute on function public.can_read_profile(uuid) to authenticated;

drop policy "profiles: read self and household" on public.profiles;
create policy "profiles: read self, household and friends"
  on public.profiles for select to authenticated
  using (public.can_read_profile(id));

-- ---------- functions ----------

-- My friend cellars with their people's names (the app builds the title),
-- and the price switch in each direction.
create function public.my_friends()
returns table (cellar_id uuid, names text[], i_show_prices boolean, they_show_prices boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select mine.friend_cellar_id,
         array(select p.display_name from public.cellar_members m join public.profiles p on p.id = m.user_id
                where m.cellar_id = mine.friend_cellar_id and m.role = 'member' order by m.joined_at),
         mine.shows_prices,
         coalesce(theirs.shows_prices, false)
    from public.friend_links mine
    left join public.friend_links theirs
      on theirs.owner_cellar_id = mine.friend_cellar_id and theirs.friend_cellar_id = mine.owner_cellar_id
   where mine.owner_cellar_id = public.my_cellar_id()
   order by mine.created_at;
$$;

create function public.create_friend_invite(p_shows_prices boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
  v_token  text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  insert into public.friend_invites (cellar_id, token_hash, shows_prices, created_by)
  values (v_cellar, public.hash_token(v_token), p_shows_prices, auth.uid());
  return v_token; -- shown once, never stored
end;
$$;

-- Who sent this invite? Lets the accept screen say "המרתף של מאיה" before
-- the user agrees. Same answer (nothing) for unknown / used / expired.
create function public.peek_friend_invite(p_token text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(select p.display_name from public.cellar_members m join public.profiles p on p.id = m.user_id
                where m.cellar_id = i.cellar_id and m.role = 'member' order by m.joined_at)
    from public.friend_invites i
   where i.token_hash = public.hash_token(coalesce(p_token, ''))
     and i.used_at is null and i.expires_at > now()
     and auth.uid() is not null;
$$;

-- Accepting makes the friendship mutual. p_shows_prices = the accepter's
-- choice for their own prices.
create function public.accept_friend_invite(p_token text, p_shows_prices boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mine   uuid := public.my_cellar_id();
  v_invite public.friend_invites;
begin
  if v_mine is null or not public.is_cellar_editor(v_mine) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.friend_invites
   where token_hash = public.hash_token(coalesce(p_token, ''))
     and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid invite' using errcode = 'no_data_found';
  end if;
  if v_invite.cellar_id = v_mine then
    raise exception 'own cellar' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.friend_links where owner_cellar_id = v_mine and friend_cellar_id = v_invite.cellar_id) then
    raise exception 'already friends' using errcode = 'unique_violation';
  end if;

  update public.friend_invites set used_at = now() where id = v_invite.id;
  insert into public.friend_links (owner_cellar_id, friend_cellar_id, shows_prices) values
    (v_invite.cellar_id, v_mine, v_invite.shows_prices),
    (v_mine, v_invite.cellar_id, p_shows_prices);
  return v_invite.cellar_id;
end;
$$;

-- Either side may end the friendship; both directions go.
create function public.remove_friend(p_friend_cellar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mine uuid := public.my_cellar_id();
begin
  if v_mine is null or not public.is_cellar_editor(v_mine) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  delete from public.friend_links
   where (owner_cellar_id = v_mine and friend_cellar_id = p_friend_cellar)
      or (owner_cellar_id = p_friend_cellar and friend_cellar_id = v_mine);
end;
$$;

-- My switch only: may this friend see MY prices?
create function public.set_friend_prices(p_friend_cellar uuid, p_shows boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mine uuid := public.my_cellar_id();
begin
  if v_mine is null or not public.is_cellar_editor(v_mine) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.friend_links set shows_prices = p_shows
   where owner_cellar_id = v_mine and friend_cellar_id = p_friend_cellar;
end;
$$;

-- "I want this too": copies a friend's wine into my cellar (no bottles, so
-- it shows only in the wishlist) and fills the source ("ראיתי אצל מאיה").
-- Runs as definer to read the friend's names, so it checks access itself.
create function public.add_friend_wine_to_wishlist(p_wine_id uuid, p_year int default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mine   uuid := public.my_cellar_id();
  w        public.wines;
  v_names  text[];
  v_source text;
  v_wine   uuid;
  v_item   uuid;
begin
  if v_mine is null or not public.is_cellar_editor(v_mine) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into w from public.wines where id = p_wine_id;
  if not found or not public.is_friend_cellar(w.cellar_id) then
    raise exception 'not found' using errcode = 'no_data_found';
  end if;

  v_names := array(select p.display_name from public.cellar_members m join public.profiles p on p.id = m.user_id
                    where m.cellar_id = w.cellar_id and m.role = 'member' order by m.joined_at);
  v_source := left('ראיתי אצל ' || case
      when cardinality(v_names) <= 1 then coalesce(v_names[1], 'חברים')
      -- Same grammar as cellarTitle(): "ו" + Hebrew name, "ו־" + any other.
      else array_to_string(v_names[1:cardinality(v_names) - 1], ', ')
           || case when v_names[cardinality(v_names)] ~ '^[א-ת]' then ' ו' else ' ו־' end
           || v_names[cardinality(v_names)]
    end, 120);

  select id into v_wine from public.wines
   where cellar_id = v_mine and lower(winery) = lower(w.winery) and lower(name) = lower(w.name);
  if v_wine is null then
    insert into public.wines (cellar_id, winery, name, type, grape, country, region, kosher, shape)
    values (v_mine, w.winery, w.name, w.type, w.grape, w.country, w.region, w.kosher, w.shape)
    returning id into v_wine;
  end if;

  insert into public.wishlist_items (cellar_id, wine_id, year, source_note)
  values (v_mine, v_wine, p_year, v_source)
  on conflict (wine_id, year) do update set source_note = coalesce(public.wishlist_items.source_note, excluded.source_note)
  returning id into v_item;
  return v_item;
end;
$$;

revoke execute on function
  public.my_friends(), public.create_friend_invite(boolean), public.peek_friend_invite(text),
  public.accept_friend_invite(text, boolean), public.remove_friend(uuid),
  public.set_friend_prices(uuid, boolean), public.add_friend_wine_to_wishlist(uuid, int)
  from public, anon;
grant execute on function
  public.my_friends(), public.create_friend_invite(boolean), public.peek_friend_invite(text),
  public.accept_friend_invite(text, boolean), public.remove_friend(uuid),
  public.set_friend_prices(uuid, boolean), public.add_friend_wine_to_wishlist(uuid, int)
  to authenticated;

alter publication supabase_realtime add table public.friend_links;

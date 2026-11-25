-- =====================================================================
-- View link without an account (stage 4). Whoever holds the link sees the
-- cellar live (not a frozen copy); prices and history can be hidden.
-- One active link per cellar; a new link or "revoke" cuts the old one.
--
-- The guest is not signed in, so RLS cannot know who they are. Their only
-- door is shared_cellar(token): it checks the token and returns just what
-- the link allows. Outside it, anon has no access to any table.
-- The token is stored as a SHA-256 hash, like invites, and is shown once.
-- =====================================================================

create table public.share_links (
  id           uuid primary key default gen_random_uuid(),
  cellar_id    uuid not null references public.cellars (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  hide_prices  boolean not null default true,
  hide_history boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
-- At most one active link per cellar.
create unique index share_links_one_active on public.share_links (cellar_id) where revoked_at is null;

alter table public.share_links enable row level security;
create policy "share links: members read"
  on public.share_links for select to authenticated
  using (public.is_cellar_member(cellar_id));
-- Writes only through the functions below.
grant select, insert, update, delete on public.share_links to authenticated;

-- New link (revokes the previous one). Returns the token, shown once.
create function public.create_share_link(p_hide_prices boolean default true, p_hide_history boolean default false)
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
  update public.share_links set revoked_at = now() where cellar_id = v_cellar and revoked_at is null;
  insert into public.share_links (cellar_id, token_hash, hide_prices, hide_history, created_by)
  values (v_cellar, public.hash_token(v_token), p_hide_prices, p_hide_history, auth.uid());
  return v_token;
end;
$$;

create function public.revoke_share_link()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.share_links set revoked_at = now() where cellar_id = v_cellar and revoked_at is null;
end;
$$;

revoke execute on function public.create_share_link(boolean, boolean), public.revoke_share_link() from public, anon;
grant  execute on function public.create_share_link(boolean, boolean), public.revoke_share_link() to authenticated;

-- The guest's only door. Unknown or revoked token → null (same answer,
-- so tokens cannot be probed). Returns the cellar as JSON in the shape the
-- app's own loaders read, minus what the link hides. Never emails, never
-- household lists, never notes about who rated what.
create function public.shared_cellar(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.share_links;
begin
  select * into l from public.share_links
   where token_hash = public.hash_token(coalesce(p_token, '')) and revoked_at is null;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'names', (select coalesce(jsonb_agg(p.display_name order by m.joined_at), '[]')
                from public.cellar_members m join public.profiles p on p.id = m.user_id
               where m.cellar_id = l.cellar_id and m.role = 'member'),
    'hide_prices', l.hide_prices,
    'hide_history', l.hide_history,
    'fridges', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', f.id, 'name', f.name, 'brand', f.brand, 'model', f.model,
                  'shelves', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', s.id,
                      'zones', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', z.id, 'kind', z.kind, 'capacity', z.capacity, 'label', z.label) order by z.position), '[]')
                        from public.shelf_zones z where z.shelf_id = s.id)
                    ) order by s.position), '[]')
                    from public.shelves s where s.fridge_id = f.id)
                ) order by f.position), '[]')
                from public.fridges f where f.cellar_id = l.cellar_id),
    'bottles', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', b.id, 'status', b.status, 'zone_id', b.zone_id, 'slot', b.slot,
                  'shelf', (select s.position from public.shelf_zones z join public.shelves s on s.id = z.shelf_id where z.id = b.zone_id),
                  'year', v.year, 'drink_from', v.drink_from, 'drink_to', v.drink_to,
                  'peak_from', v.peak_from, 'peak_to', v.peak_to,
                  'winery', w.winery, 'name', w.name, 'type', w.type, 'country', w.country,
                  'kosher', w.kosher, 'shape', w.shape,
                  'price', case when l.hide_prices then null
                                else (select coalesce(pr.regular, pr.paid) from public.bottle_prices pr where pr.bottle_id = b.id) end
                ) order by b.added_on desc), '[]')
                from public.bottles b
                join public.wine_vintages v on v.id = b.vintage_id
                join public.wines w on w.id = v.wine_id
               where b.cellar_id = l.cellar_id and b.status <> 'consumed'),
    'history', case when l.hide_history then '[]'::jsonb else
               (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id, 'tasted_on', t.tasted_on, 'place', t.place, 'notes', t.notes,
                  'year', v.year, 'winery', w.winery, 'name', w.name
                ) order by t.tasted_on desc, t.created_at desc), '[]')
                from public.tastings t
                join public.wines w on w.id = t.wine_id
                left join public.wine_vintages v on v.id = t.vintage_id
               where t.cellar_id = l.cellar_id) end
  );
end;
$$;

revoke execute on function public.shared_cellar(text) from public;
grant  execute on function public.shared_cellar(text) to anon, authenticated;

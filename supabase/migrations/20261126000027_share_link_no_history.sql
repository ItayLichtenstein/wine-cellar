-- =====================================================================
-- The view link no longer shares the drinking history, at all.
-- Sending someone the link means "look at my fridge", not "read what we
-- drank and our notes on it". A choice nobody should want is removed, so
-- the column, the parameter and the 'history' key all go.
-- =====================================================================

drop function public.create_share_link(boolean, boolean);

create function public.create_share_link(p_hide_prices boolean default true)
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
  insert into public.share_links (cellar_id, token_hash, hide_prices, created_by)
  values (v_cellar, public.hash_token(v_token), p_hide_prices, auth.uid());
  return v_token;
end;
$$;

revoke execute on function public.create_share_link(boolean) from public, anon;
grant  execute on function public.create_share_link(boolean) to authenticated;

-- Same as migration 0021, minus 'hide_history' and 'history'.
create or replace function public.shared_cellar(p_token text)
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
               where b.cellar_id = l.cellar_id and b.status <> 'consumed')
  );
end;
$$;

alter table public.share_links drop column hide_history;

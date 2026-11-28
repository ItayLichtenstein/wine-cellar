-- =====================================================================
-- The share link draws a wine cabinet as a cabinet (not a fridge), and the
-- guest's card shows the wine's body. Both are public facts, nothing personal.
-- =====================================================================

-- Same as migration 0030, plus the fridge's kind and the wine's body.
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
                  'id', f.id, 'name', f.name, 'brand', f.brand, 'model', f.model, 'kind', f.kind,
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
                  'kosher', w.kosher, 'shape', w.shape, 'thumb', w.label_thumb,
                  'grape', w.grape, 'region', w.region, 'alcohol', v.alcohol, 'body', w.body,
                  'critics', (select coalesce(jsonb_agg(jsonb_build_object('critic', c.critic, 'score', c.score) order by c.score desc), '[]')
                                from public.critic_scores c where c.vintage_id = v.id),
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

-- =====================================================================
-- Joining a household WITH bottles (decided with the user, 2026-11-25).
--
-- When someone who is alone in a cellar that has data accepts an invite
-- and confirms ("bring my bottles"):
-- - wines are matched by winery + name, vintages by year; a match is
--   reused, anything else is created in the shared cellar;
-- - bottles come along: those in a fridge land "outside the fridge"
--   (the shared cellar's fridges are arranged differently); bottles on
--   their way, outside the fridge or already drunk keep their status;
-- - prices, tastings (history), critic scores and ratings come along;
--   where the shared cellar already has a rating for the same thing,
--   the shared cellar's rating is kept;
-- - fridges are NOT moved; the old cellar is then deleted.
-- Not moved yet: label photos (they live in the old cellar's storage
-- folder) – the wine keeps no photo and can be photographed again.
--
-- Rows cannot simply get a new cellar_id: every table points to its parent
-- by (id, cellar_id), so each row is COPIED with mapped ids, and the old
-- cellar is deleted at the end (cascading its rows away). One transaction.
-- =====================================================================

create function public.move_cellar_data(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w   record;
  v   record;
  b   record;
  v_wine    uuid;
  v_vintage uuid;
  v_bottle  uuid;
begin
  create temporary table if not exists pg_temp.wine_map    (old_id uuid primary key, new_id uuid) on commit drop;
  create temporary table if not exists pg_temp.vintage_map (old_id uuid primary key, new_id uuid) on commit drop;
  create temporary table if not exists pg_temp.bottle_map  (old_id uuid primary key, new_id uuid) on commit drop;

  -- Wines: reuse by winery + name, else copy (without the photo, see above).
  for w in select * from public.wines where cellar_id = p_from loop
    select id into v_wine from public.wines
     where cellar_id = p_to and lower(winery) = lower(w.winery) and lower(name) = lower(w.name);
    if v_wine is null then
      insert into public.wines (cellar_id, winery, name, type, grape, country, region, kosher, shape)
      values (p_to, w.winery, w.name, w.type, w.grape, w.country, w.region, w.kosher, w.shape)
      returning id into v_wine;
    end if;
    insert into pg_temp.wine_map values (w.id, v_wine);
  end loop;

  -- Vintages: reuse by year (NV = NV), else copy with its window.
  for v in select * from public.wine_vintages where cellar_id = p_from loop
    select id into v_vintage from public.wine_vintages
     where wine_id = (select new_id from pg_temp.wine_map where old_id = v.wine_id)
       and year is not distinct from v.year;
    if v_vintage is null then
      insert into public.wine_vintages (wine_id, cellar_id, year, drink_from, drink_to, peak_from, peak_to, window_source, alcohol)
      values ((select new_id from pg_temp.wine_map where old_id = v.wine_id), p_to, v.year,
              v.drink_from, v.drink_to, v.peak_from, v.peak_to, v.window_source, v.alcohol)
      returning id into v_vintage;
    end if;
    insert into pg_temp.vintage_map values (v.id, v_vintage);
  end loop;

  -- Critic scores: add the ones the shared vintage does not have yet.
  insert into public.critic_scores (vintage_id, cellar_id, critic, score)
  select m.new_id, p_to, c.critic, c.score
    from public.critic_scores c join pg_temp.vintage_map m on m.old_id = c.vintage_id
   where c.cellar_id = p_from
     and not exists (select 1 from public.critic_scores x where x.vintage_id = m.new_id and lower(x.critic) = lower(c.critic));

  -- Bottles (+ prices). A bottle in a fridge comes "outside the fridge".
  for b in select * from public.bottles where cellar_id = p_from loop
    insert into public.bottles (cellar_id, vintage_id, status, link_url, note, added_on, consumed_on)
    values (p_to, (select new_id from pg_temp.vintage_map where old_id = b.vintage_id),
            case when b.status = 'stored' then 'unplaced' else b.status end,
            b.link_url, b.note, b.added_on, b.consumed_on)
    returning id into v_bottle;
    insert into pg_temp.bottle_map values (b.id, v_bottle);
  end loop;

  insert into public.bottle_prices (bottle_id, cellar_id, paid, regular, is_gift)
  select m.new_id, p_to, p.paid, p.regular, p.is_gift
    from public.bottle_prices p join pg_temp.bottle_map m on m.old_id = p.bottle_id
   where p.cellar_id = p_from;

  -- History.
  insert into public.tastings (cellar_id, wine_id, vintage_id, bottle_id, tasted_on, place, notes, last_location)
  select p_to,
         (select new_id from pg_temp.wine_map where old_id = t.wine_id),
         (select new_id from pg_temp.vintage_map where old_id = t.vintage_id),
         (select new_id from pg_temp.bottle_map where old_id = t.bottle_id),
         t.tasted_on, t.place, t.notes, t.last_location
    from public.tastings t
   where t.cellar_id = p_from;

  -- Ratings: the shared cellar's existing rating wins on a clash.
  insert into public.ratings (cellar_id, wine_id, vintage_id, rater_id, score)
  select p_to,
         (select new_id from pg_temp.wine_map where old_id = r.wine_id),
         (select new_id from pg_temp.vintage_map where old_id = r.vintage_id),
         r.rater_id, r.score
    from public.ratings r
   where r.cellar_id = p_from
  on conflict (wine_id, vintage_id, rater_id) do nothing;

  drop table pg_temp.wine_map;
  drop table pg_temp.vintage_map;
  drop table pg_temp.bottle_map;
end;
$$;

-- Internal: only accept_invite may call it.
revoke execute on function public.move_cellar_data(uuid, uuid) from public, anon, authenticated;

-- accept_invite gets a second argument: true = bring my bottles.
drop function public.accept_invite(text);

create function public.accept_invite(p_token text, p_bring_data boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_invite public.cellar_invites;
  v_old    uuid;
  v_has    boolean;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.cellar_invites
   where token_hash = public.hash_token(coalesce(p_token, ''))
     and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid invite' using errcode = 'no_data_found';
  end if;

  v_old := public.my_cellar_id();
  if v_old = v_invite.cellar_id then
    raise exception 'already a member' using errcode = 'unique_violation';
  end if;

  if (select count(*) from public.cellar_members where cellar_id = v_old) = 1 then
    -- Alone in the old cellar: it is dropped. Its data comes along only
    -- after the user confirmed (the join page warns first).
    v_has := exists (select 1 from public.bottles where cellar_id = v_old)
          or exists (select 1 from public.tastings where cellar_id = v_old);
    if v_has and not coalesce(p_bring_data, false) then
      raise exception 'your cellar has data' using errcode = 'check_violation', hint = 'has_data';
    end if;
    if v_has then
      perform public.move_cellar_data(v_old, v_invite.cellar_id);
    end if;
    delete from public.cellar_members where user_id = v_user;
    -- Fridges first: deleting a zone runs a trigger that updates the
    -- bottles in it, which must happen while their vintages still exist
    -- (in one cascade from the cellar the order is not guaranteed).
    delete from public.fridges where cellar_id = v_old;
    delete from public.cellars where id = v_old;
  else
    -- Others stay in the old cellar (with its data); keep a full member there.
    if not exists (select 1 from public.cellar_members
                    where cellar_id = v_old and user_id <> v_user and role = 'member') then
      raise exception 'the old cellar needs another member first' using errcode = 'check_violation', hint = 'last_member';
    end if;
    delete from public.cellar_members where user_id = v_user;
  end if;

  insert into public.cellar_members (cellar_id, user_id, role) values (v_invite.cellar_id, v_user, v_invite.role);
  update public.cellar_invites set used_at = now(), used_by = v_user where id = v_invite.id;
  return v_invite.cellar_id;
end;
$$;

revoke execute on function public.accept_invite(text, boolean) from public, anon;
grant  execute on function public.accept_invite(text, boolean) to authenticated;

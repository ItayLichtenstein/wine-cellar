-- =====================================================================
-- Faster reads at scale: RLS that can use an index.
--
-- Found by the load test (scripts/load-test): with 100 cellars and 10,000
-- bottles, the home-screen fridge query took ~1.1s for a 100-bottle
-- cellar. The read policies were `using (can_read_cellar(cellar_id))`:
-- a function of the row, so Postgres scanned EVERY bottle of every cellar
-- and called the function 10,000 times.
--
-- Fix (the pattern Supabase recommends):
-- 1. readable_cellar_ids(): the cellars I may read (mine + friends who
--    share with me), computed ONCE per query.
-- 2. Policies become `cellar_id in (select readable_cellar_ids())`. The
--    sub-select doesn't depend on the row, so Postgres runs it once and
--    then looks rows up by cellar_id...
-- 3. ...through a new index on cellar_id in each table (Postgres doesn't
--    index foreign keys by itself).
-- Same rule as before, only evaluated differently; can_read_cellar()
-- stays for the functions that call it.
-- =====================================================================

create function public.readable_cellar_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_cellar_id()
  union
  select owner_cellar_id from public.friend_links where friend_cellar_id = public.my_cellar_id();
$$;
revoke execute on function public.readable_cellar_ids() from public, anon;
grant execute on function public.readable_cellar_ids() to authenticated;

create index on public.fridges        (cellar_id);
create index on public.shelves        (cellar_id);
create index on public.shelf_zones    (cellar_id);
create index on public.wines          (cellar_id);
create index on public.wine_vintages  (cellar_id);
create index on public.critic_scores  (cellar_id);
create index on public.bottles        (cellar_id, status);
create index on public.ratings        (cellar_id);
create index on public.tastings       (cellar_id);
create index on public.wishlist_items (cellar_id);

alter policy "fridges: members and friends read"  on public.fridges        using (cellar_id in (select public.readable_cellar_ids()));
alter policy "shelves: members and friends read"  on public.shelves        using (cellar_id in (select public.readable_cellar_ids()));
alter policy "zones: members and friends read"    on public.shelf_zones    using (cellar_id in (select public.readable_cellar_ids()));
alter policy "wines: members and friends read"    on public.wines          using (cellar_id in (select public.readable_cellar_ids()));
alter policy "vintages: members and friends read" on public.wine_vintages  using (cellar_id in (select public.readable_cellar_ids()));
alter policy "critics: members and friends read"  on public.critic_scores  using (cellar_id in (select public.readable_cellar_ids()));
alter policy "bottles: members and friends read"  on public.bottles        using (cellar_id in (select public.readable_cellar_ids()));
alter policy "ratings: members and friends read"  on public.ratings        using (cellar_id in (select public.readable_cellar_ids()));
alter policy "tastings: members and friends read" on public.tastings       using (cellar_id in (select public.readable_cellar_ids()));
alter policy "wishlist: members and friends read" on public.wishlist_items using (cellar_id in (select public.readable_cellar_ids()));

-- =====================================================================
-- Defense in depth: anonymous visitors get nothing.
--
-- Supabase grants the `anon` role access to every table and function by
-- default and relies on RLS alone. Our policies are written only for
-- `authenticated`, so anon is already blocked – but one mistaken policy
-- would open a hole. Here we remove the grants themselves, so anon is
-- blocked twice. The guest share link (stage 4) will use one dedicated
-- function that is granted explicitly.
-- =====================================================================

-- Tables: no direct access for anon, now and for tables created later.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Functions: Postgres lets PUBLIC (everyone) execute new functions by default.
-- Remove that, then grant back only what signed-in users really call.
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function public.is_cellar_member(uuid) to authenticated;
grant execute on function public.is_cellar_editor(uuid) to authenticated;
grant execute on function public.my_cellar_id()         to authenticated;
grant execute on function public.drink_bottle(uuid, date, text) to authenticated;

-- Trigger functions (set_updated_at, handle_new_user, check_bottle_placement,
-- unplace_bottles_of_zone) need no grant: Postgres does not check EXECUTE
-- when a trigger fires, and nobody should call them directly.

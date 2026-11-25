-- =====================================================================
-- Explicit table access for signed-in users.
--
-- Supabase can grant API access to new tables automatically, but that is a
-- per-project setting – and it is OFF in our cloud project (the safer
-- choice). So access is granted here, in code, the same way everywhere:
-- signed-in users may use the tables, and RLS decides which ROWS each one
-- can see or change. Anonymous visitors still get nothing (migration 0005).
-- =====================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tables added by later migrations get the same access.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

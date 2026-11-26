-- Removes everything seed.sql created (LOCAL ONLY).
\set ON_ERROR_STOP on
delete from public.cellars where id in (
  select m.cellar_id from public.cellar_members m join auth.users u on u.id = m.user_id
  where u.email like 'loadtest-%@example.com');
delete from auth.users where email like 'loadtest-%@example.com';
analyze;

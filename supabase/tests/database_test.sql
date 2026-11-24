-- =====================================================================
-- Database tests (pgTAP). Run with:  supabase test db
--
-- Everything runs inside one transaction that is rolled back at the end,
-- so the tests never leave data behind.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- ---------- Helpers: act as a given user ----------
-- Supabase reads the user id from the JWT claims; we fake them here.
create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

-- ---------- Guards against future mistakes ----------
-- A table added by a later migration without RLS would be readable by any
-- signed-in user. These two tests fail the build if that ever happens.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every table in public has RLS enabled');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'every SECURITY DEFINER function pins its search_path');

-- A view runs with its creator's rights and skips RLS unless it is
-- declared security_invoker. Any future view must be.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce('security_invoker=true' = any(c.reloptions), false)),
  0, 'every view in public is security_invoker');

-- Emails live only in auth.users, which the API does not expose.
-- No table that the API exposes may hold an email.
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name ilike '%email%'),
  0, 'no exposed table stores email addresses');

-- ---------- Setup: three users sign up ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'yonatan@example.com',  '{"full_name":"יונתן"}'),
  ('22222222-2222-2222-2222-222222222222', 'maya@example.com', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'viewer@example.com', '{"full_name":"צופה"}');

-- 1–3: sign-up creates profile, cellar and membership
select is((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111'),
          'יונתן', 'sign-up creates a profile from the Google name');
select is((select display_name from profiles where id = '22222222-2222-2222-2222-222222222222'),
          'משתמש חדש', 'magic-link user gets a placeholder name, never part of the email');
select is((select count(*)::int from cellar_members
           where user_id in ('11111111-1111-1111-1111-111111111111',
                             '22222222-2222-2222-2222-222222222222',
                             '33333333-3333-3333-3333-333333333333')),
          3, 'every new user gets a cellar');

-- Make user 3 a VIEWER of Yonatan's cellar (stage 2 will do this via an invite).
delete from cellars where id = (select cellar_id from cellar_members
                                where user_id = '33333333-3333-3333-3333-333333333333');
insert into cellar_members (cellar_id, user_id, role)
select cellar_id, '33333333-3333-3333-3333-333333333333', 'viewer'
from cellar_members where user_id = '11111111-1111-1111-1111-111111111111';

-- Remember Yonatan's cellar id, so later tests can target it directly
-- (other users cannot even look it up – RLS hides it).
select set_config('test.yonatan_cellar',
  (select cellar_id::text from cellar_members
   where user_id = '11111111-1111-1111-1111-111111111111'), true);

select set_config('test.maya_cellar',
  (select cellar_id::text from cellar_members
   where user_id = '22222222-2222-2222-2222-222222222222'), true);

-- 4: one cellar per user
select throws_ok(
  $$ insert into cellar_members (cellar_id, user_id)
     select cellar_id, '11111111-1111-1111-1111-111111111111' from cellar_members
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  '23505', null, 'a user cannot belong to two cellars');

-- ---------- Yonatan builds a fridge and adds a bottle ----------
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');

insert into fridges (id, cellar_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', my_cellar_id(), 'מקרר יין');
insert into shelves (id, fridge_id, cellar_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', my_cellar_id(), 1);
insert into shelf_zones (id, shelf_id, cellar_id, position, kind, capacity, label) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', my_cellar_id(), 1, 'row', 3, 'אחורית'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', my_cellar_id(), 2, 'stack', 1, 'ערימה');
insert into wines (id, cellar_id, winery, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', my_cellar_id(), 'יקב', 'קומטו');
insert into wine_vintages (id, wine_id, cellar_id, year) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', my_cellar_id(), 2021);
insert into bottles (id, cellar_id, vintage_id, status, zone_id, slot) values
  ('cccccccc-0000-0000-0000-000000000001', my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002',
   'stored', 'aaaaaaaa-0000-0000-0000-000000000003', 1);
insert into bottle_prices (bottle_id, cellar_id, paid) values
  ('cccccccc-0000-0000-0000-000000000001', my_cellar_id(), 120);

-- 5: same wine twice (different case) is rejected
select throws_ok(
  $$ insert into wines (cellar_id, winery, name) values (my_cellar_id(), 'יקב', 'קומטו') $$,
  '23505', null, 'the same wine cannot be added twice to a cellar');

-- 6: two bottles in the same slot
select throws_ok(
  $$ insert into bottles (cellar_id, vintage_id, status, zone_id, slot)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002', 'stored',
             'aaaaaaaa-0000-0000-0000-000000000003', 1) $$,
  '23505', null, 'two bottles cannot share a slot');

-- 7: slot beyond the row's capacity
select throws_ok(
  $$ insert into bottles (cellar_id, vintage_id, status, zone_id, slot)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002', 'stored',
             'aaaaaaaa-0000-0000-0000-000000000003', 4) $$,
  '23514', null, 'slot must be within the row capacity');

-- 8: stack capacity
insert into bottles (cellar_id, vintage_id, status, zone_id)
values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002', 'stored', 'aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$ insert into bottles (cellar_id, vintage_id, status, zone_id)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002', 'stored',
             'aaaaaaaa-0000-0000-0000-000000000004') $$,
  '23514', null, 'a full stack rejects another bottle');

-- 9: "stored" without a zone is impossible
select throws_ok(
  $$ insert into bottles (cellar_id, vintage_id, status)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000002', 'stored') $$,
  '23514', null, 'a stored bottle must have a zone');

-- ---------- Maya must not see or touch Yonatan's cellar ----------
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');

-- 10–12: reads are filtered by RLS
select is((select count(*)::int from bottles), 0, 'Maya sees none of Yonatan''s bottles');
select is((select count(*)::int from bottle_prices), 0, 'Maya sees none of Yonatan''s prices');
select is((select count(*)::int from cellars), 1, 'Maya sees only her own cellar');

-- 13: writing into Yonatan's cellar is blocked
select throws_ok(
  $$ insert into wines (cellar_id, winery, name)
     values (current_setting('test.yonatan_cellar')::uuid, 'x', 'y') $$,
  '42501', null, 'Maya cannot add wine to Yonatan''s cellar');

-- 14: a shelf in Maya's cellar cannot point at Yonatan's fridge (composite FK)
select throws_ok(
  $$ insert into shelves (fridge_id, cellar_id, position)
     values ('aaaaaaaa-0000-0000-0000-000000000001', my_cellar_id(), 9) $$,
  '23503', null, 'cross-cellar references are rejected by the foreign key');

-- 15: Maya cannot add herself to Yonatan's cellar
select throws_ok(
  $$ insert into cellar_members (cellar_id, user_id, role)
     values (current_setting('test.yonatan_cellar')::uuid, auth.uid(), 'member') $$,
  '42501', null, 'nobody can add themselves to another cellar');

-- ---------- The viewer can read but not write ----------
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');

-- 15: viewer reads
select is((select count(*)::int from bottles), 2, 'viewer sees the household bottles');

-- 16: viewer cannot add a wine
select throws_ok(
  $$ insert into wines (cellar_id, winery, name) values (my_cellar_id(), 'x', 'y') $$,
  '42501', null, 'viewer cannot add wine');

-- viewer cannot promote themselves (no update policy -> 0 rows changed)
update cellar_members set role = 'member' where user_id = auth.uid();
select pg_temp.logout();
select is((select role::text from cellar_members where user_id = '33333333-3333-3333-3333-333333333333'),
          'viewer', 'a viewer cannot promote themselves to member');

-- ---------- Removing a zone keeps the bottles ----------
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
delete from shelf_zones where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- 17
select is((select status::text from bottles where id = 'cccccccc-0000-0000-0000-000000000001'),
          'unplaced', 'bottles of a removed zone move outside the fridge');

-- ---------- Abuse attempts by a legitimate member ----------
-- a member MAY enter a rating on behalf of another household member
select lives_ok(
  $$ insert into ratings (cellar_id, wine_id, rater_id, score)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000001',
             '33333333-3333-3333-3333-333333333333', 4.0) $$,
  'can rate on behalf of a household member');

-- ...but never under the id of someone outside the household
select throws_ok(
  $$ insert into ratings (cellar_id, wine_id, rater_id, score)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000001',
             '22222222-2222-2222-2222-222222222222', 1.0) $$,
  '42501', null, 'cannot rate under the name of someone outside the household');

select lives_ok(
  $$ insert into ratings (cellar_id, wine_id, score)
     values (my_cellar_id(), 'bbbbbbbb-0000-0000-0000-000000000001', 4.5) $$,
  'a shared household rating is allowed');

-- a bottle cannot be moved into another cellar
select throws_ok(
  $$ update bottles set cellar_id = current_setting('test.maya_cellar')::uuid
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  null, null, 'a bottle cannot be moved to another cellar');

-- giant text is rejected by the database, not only by the UI
select throws_ok(
  $$ update bottles set note = repeat('x', 5000)
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'over-long text is rejected');

-- a javascript: link is rejected
select throws_ok(
  $$ update bottles set link_url = 'javascript:alert(1)'
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'javascript: links are rejected');

-- ---------- "We drank it" ----------
select drink_bottle('cccccccc-0000-0000-0000-000000000001', '2026-11-24', 'מעולה');

-- 18
select is((select status::text || '/' || consumed_on::text from bottles
           where id = 'cccccccc-0000-0000-0000-000000000001'),
          'consumed/2026-11-24', 'drinking marks the bottle consumed with a date');

-- ---------- create_fridge() ----------
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$ select create_fridge('מקרר יין', '[
       {"zones":[{"kind":"row","capacity":5,"label":"אחורית"},{"kind":"row","capacity":5,"label":"קדמית"}]},
       {"zones":[{"kind":"stack","capacity":8},{"kind":"stack","capacity":8},{"kind":"row","capacity":2}]}
     ]'::jsonb, 'Liebherr', 'WKt 4552') $$,
  'create_fridge builds a fridge with mixed zones');

select is((select count(*)::int from shelf_zones), 5, 'all five zones were created');

select is((select string_agg(kind::text || capacity, ',' order by s.position, z.position)
           from shelf_zones z join shelves s on s.id = z.shelf_id),
          'row5,row5,stack8,stack8,row2', 'zones keep their order, top shelf first');

-- a bad zone kind rolls back the whole fridge (one transaction)
select throws_ok(
  $$ select create_fridge('שבור', '[{"zones":[{"kind":"row","capacity":3}]},{"zones":[{"kind":"drawer","capacity":3}]}]'::jsonb) $$,
  '22P02', null, 'an unknown zone kind is rejected');
select is((select count(*)::int from fridges), 1, 'the failed fridge left nothing behind');

-- a viewer cannot create fridges
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select create_fridge('של צופה', '[{"zones":[{"kind":"row","capacity":3}]}]'::jsonb) $$,
  '42501', null, 'a viewer cannot create a fridge');

-- ---------- Anonymous visitors get nothing ----------
select pg_temp.logout();
select set_config('role', 'anon', true);

-- 19–21
select throws_ok($$ select count(*) from bottles $$, '42501', null,
                 'anon cannot read tables at all (no grant, not just RLS)');
select throws_ok($$ select count(*) from bottle_prices $$, '42501', null,
                 'anon cannot read prices');
select throws_ok($$ select is_cellar_member(gen_random_uuid()) $$, '42501', null,
                 'anon cannot call helper functions');

select pg_temp.logout();
select * from finish();
rollback;

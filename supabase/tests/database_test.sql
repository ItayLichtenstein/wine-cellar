-- =====================================================================
-- Database tests (pgTAP). Run with:  supabase test db
--
-- Everything runs inside one transaction that is rolled back at the end,
-- so the tests never leave data behind.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(105);

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

-- Signed-in users can use every table (RLS then filters the rows). This
-- must not depend on the cloud project's "grant API access" setting.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not has_table_privilege('authenticated', c.oid, 'select, insert, update, delete')),
  0, 'signed-in users have explicit access to every table');

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

-- ---------- add_bottles() (Maya now has a fridge) ----------
select set_config('test.maya_row', (select z.id::text from shelf_zones z join shelves s on s.id = z.shelf_id
                                    where s.position = 1 and z.position = 1), true);
select set_config('test.maya_stack', (select z.id::text from shelf_zones z join shelves s on s.id = z.shelf_id
                                      where s.position = 2 and z.position = 1), true);

select lives_ok(
  format($$ select add_bottles('יקב טוב', 'קומטו', 3, 'red', 2021,
            '[{"zone_id":"%s","slot":1},{"zone_id":"%s"}]'::jsonb,
            p_paid => 120, p_regular => 140) $$,
         current_setting('test.maya_row'), current_setting('test.maya_stack')),
  'add 3 bottles: one in a row slot, one in a stack, one left over');

select is((select string_agg(status::text, ',' order by status::text) from bottles),
          'stored,stored,unplaced', 'placed bottles are stored, the rest are outside the fridge');

select is((select count(*)::int from bottle_prices where paid = 120 and regular = 140), 3,
          'every bottle gets its price');

-- same wine, different spelling case, NV: reuses the wine, adds a vintage
select lives_ok($$ select add_bottles('יקב טוב', 'קומטו', 1, p_rest_status => 'in_transit') $$,
                'add an NV bottle that is still in transit');
select is((select count(*)::int || '/' || (select count(*) from wine_vintages) from wines),
          '1/2', 'one wine, two vintages (2021 and NV)');

-- a taken slot rejects the whole call
select throws_ok(
  format($$ select add_bottles('יקב טוב', 'קומטו', 1, p_year => 2021,
            p_places => '[{"zone_id":"%s","slot":1}]'::jsonb) $$, current_setting('test.maya_row')),
  '23505', null, 'a taken slot is rejected');
select is((select count(*)::int from bottles), 4, 'the rejected call added nothing');

-- ---------- move_bottle() and set_rating() ----------
-- the bottle in row slot 1 moves to slot 2 (empty)
select lives_ok(
  format($$ select move_bottle((select id from bottles where slot = 1), '%s', 2) $$, current_setting('test.maya_row')),
  'move a bottle to an empty slot');

-- put the unplaced 2021 bottle in slot 2 -> it swaps with the bottle there
select lives_ok(
  format($$ select move_bottle((select b.id from bottles b join wine_vintages v on v.id = b.vintage_id
                                where b.status = 'unplaced' and v.year = 2021), '%s', 2) $$,
         current_setting('test.maya_row')),
  'move onto a taken slot swaps the two bottles');
select is((select count(*)::int from bottles where zone_id::text = current_setting('test.maya_row') and slot = 2), 1,
          'after the swap the slot holds exactly one bottle');
select is((select count(*)::int from bottles where status = 'unplaced'), 1,
          'the bottle that was there took the other bottle''s old place (outside the fridge)');

-- ratings: insert, then replace
select lives_ok($$ select set_rating((select id from wines), 4.46) $$, 'set a shared rating');
select lives_ok($$ select set_rating((select id from wines), 4.8) $$, 'set it again');
select is((select count(*)::int || '/' || max(score)::text from ratings where rater_id is null and vintage_id is null),
          '1/4.8', 'setting a rating again replaces it (one row, latest score)');

-- ---------- update_bottle() ----------
-- fix the year of one 2021 bottle to 2022 + set a price: it moves to a new vintage
select lives_ok(
  $$ select update_bottle((select b.id from bottles b join wine_vintages v on v.id = b.vintage_id
                           where v.year = 2021 and b.status = 'stored' limit 1),
                          'יקב טוב', 'קומטו', 'red', 2022, 2025, 2030, 100, null, false, 'הערה') $$,
  'edit a bottle: new year, window, price, note');
select is((select count(*)::int from wine_vintages where year = 2022), 1, 'changing the year created the 2022 vintage');
select is((select paid::int from bottle_prices bp join bottles b on b.id = bp.bottle_id where b.note = 'הערה'), 100,
          'the price of the edited bottle was replaced');

-- renaming the wine changes it for every bottle (one wine row)
select lives_ok(
  $$ select update_bottle((select id from bottles where note = 'הערה'),
                          'יקב טוב', 'קומטו רזרב', 'red', 2022, 2025, 2030, 100, null, false, 'הערה') $$,
  'rename the wine');
select is((select string_agg(distinct name, ',') from wines), 'קומטו רזרב', 'the rename applies to the whole wine');

-- update_wine_details: fields land on wine and vintage; critics are replaced
select lives_ok(
  $$ select update_wine_details(
       (select wine_id from wine_vintages where year = 2022 limit 1),
       (select id from wine_vintages where year = 2022 limit 1),
       'קברנה', 'ישראל', 'גליל', 'yes', 'burgundy', 14.5, 2026, 2028, 'critic',
       '[{"critic":"Suckling","score":94},{"critic":"Parker","score":92}]') $$,
  'update the extra wine details');
select is((select grape || '/' || country || '/' || kosher::text || '/' || shape::text from wines limit 1),
          'קברנה/ישראל/yes/burgundy', 'wine-level details saved');
select is((select count(*)::int from critic_scores), 2, 'two critic scores saved');
select throws_ok(
  $$ select update_wine_details(gen_random_uuid(), (select id from wine_vintages limit 1),
       null, null, null, null, null, null, null, null, null, '[]') $$,
  'P0002', null, 'a vintage of another wine is rejected');

-- log_tasting: a tasting without a bottle, with its score
select lives_ok(
  $$ select log_tasting('יקב מסעדה', 'יין מסעדה', 'white', 2021, current_date, 'מסעדה', 'טוב', 4.5) $$,
  'log a tasting outside the cellar');
select is((select count(*)::int from tastings t join wines w on w.id = t.wine_id
            where w.name = 'יין מסעדה' and t.bottle_id is null and t.place = 'מסעדה'), 1,
          'the tasting has no bottle and keeps the place');
select throws_ok(
  $$ select log_tasting('x', 'y', 'red', null, current_date + 2) $$,
  '23514', null, 'a tasting in the future is rejected');

-- update_fridge: reorder shelves keeping ids – bottles stay put
select set_config('test.stored_before', (select count(*)::text from bottles where status = 'stored'), true);
select set_config('test.bottles_before', (select count(*)::text from bottles), true);
select lives_ok(
  $$ select update_fridge((select id from fridges limit 1), 'מקרר יין', (
       select jsonb_agg(jsonb_build_object('id', s.id, 'zones', (
                select jsonb_agg(jsonb_build_object('id', z.id, 'kind', z.kind, 'capacity', z.capacity, 'label', z.label)
                                 order by z.position)
                  from shelf_zones z where z.shelf_id = s.id)) order by s.position desc)
         from shelves s)) $$,
  'update_fridge reorders shelves');
select is((select z.kind::text from shelf_zones z join shelves s on s.id = z.shelf_id
            where s.position = 1 and z.position = 1), 'stack', 'the former bottom shelf is now on top');
select is((select count(*)::text from bottles where status = 'stored'), current_setting('test.stored_before'),
          'reordering kept every bottle in place');

-- dropping the top shelf (with the stack) moves its bottles out, deletes none
select update_fridge((select id from fridges limit 1), 'מקרר יין', (
  select jsonb_agg(jsonb_build_object('id', s.id, 'zones', (
           select jsonb_agg(jsonb_build_object('id', z.id, 'kind', z.kind, 'capacity', z.capacity) order by z.position)
             from shelf_zones z where z.shelf_id = s.id)))
    from shelves s where s.position > 1));
select is((select count(*)::text from bottles), current_setting('test.bottles_before'),
          'removing a shelf never deletes bottles');

-- ---------- label photos (storage) ----------
-- bucket settings are read as the admin (users cannot list buckets)
select pg_temp.logout();
select is((select public from storage.buckets where id = 'labels'), false, 'the labels bucket is private');
select is((select allowed_mime_types from storage.buckets where id = 'labels'),
          array['image/jpeg', 'image/png', 'image/webp'], 'labels accept only JPEG/PNG/WebP (no SVG)');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ update wines set label_image_path = gen_random_uuid()::text || '/x.webp' $$,
  '23514', null, 'a wine cannot point to a photo in another cellar''s folder');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name, owner) values ('labels', '%s/x.webp', auth.uid()) $$,
         current_setting('test.yonatan_cellar')),
  '42501', null, 'a user cannot upload into another cellar''s folder');

-- a viewer cannot create fridges
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ select create_fridge('של צופה', '[{"zones":[{"kind":"row","capacity":3}]}]'::jsonb) $$,
  '42501', null, 'a viewer cannot create a fridge');

-- ---------- Household invites (stage 2) ----------
-- still the viewer: viewers cannot invite
select throws_ok($$ select create_invite() $$, '42501', null, 'a viewer cannot create an invite');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.token', create_invite('member'), true);
select matches(current_setting('test.token'), '^[0-9a-f]{64}$', 'an invite token is 32 random bytes (64 hex)');
select is((select count(*)::int from cellar_invites where token_hash = current_setting('test.token')), 0,
          'the raw token is never stored, only its hash');

-- a brand-new user (empty cellar) joins Yonatan's cellar
select pg_temp.logout();
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'partner@example.com', '{"full_name":"בן זוג"}'),
  ('55555555-5555-5555-5555-555555555555', 'other@example.com', '{"full_name":"אחר"}');
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
select lives_ok(format($$ select accept_invite('%s') $$, current_setting('test.token')), 'a new user accepts the invite');
select is(my_cellar_id()::text, current_setting('test.yonatan_cellar'), 'the new user now shares Yonatan''s cellar');

select pg_temp.login_as('55555555-5555-5555-5555-555555555555');
select throws_ok(format($$ select accept_invite('%s') $$, current_setting('test.token')),
                 'P0002', null, 'an invite works only once');
select throws_ok($$ select accept_invite('not-a-real-token') $$, 'P0002', null, 'a wrong token is rejected');

-- Maya already has bottles: refused until moving bottles is built
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select set_config('test.token2', create_invite('member'), true);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select throws_ok(format($$ select accept_invite('%s') $$, current_setting('test.token2')),
                 '23514', null, 'joining with a cellar that has data is refused (for now)');

-- leaving: the user gets a new empty cellar, the shared data stays
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
select set_config('test.yonatan_bottles', (select count(*)::text from bottles), true);
select lives_ok($$ select leave_cellar() $$, 'a member can leave');
select isnt(my_cellar_id()::text, current_setting('test.yonatan_cellar'), 'after leaving the user has a cellar of their own');

-- removing the viewer; then Yonatan cannot demote himself (last full member)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select is((select count(*)::text from bottles), current_setting('test.yonatan_bottles'), 'leaving took no bottles away');
select lives_ok($$ select remove_member('33333333-3333-3333-3333-333333333333') $$, 'a member can remove a viewer');
select throws_ok($$ select set_member_role(auth.uid(), 'viewer') $$, '23514', null,
                 'the last full member cannot become a viewer');
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');

-- realtime: every cellar table is streamed (and RLS filters who hears what)
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'),
          14, 'the cellar tables are published for real-time sync');

-- ---------- Joining WITH bottles (cellar merge) ----------
select pg_temp.logout();
insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'host@example.com',   '{"full_name":"מארחת"}'),
  ('77777777-7777-7777-7777-777777777777', 'joiner@example.com', '{"full_name":"מצטרף"}');

-- the host: one bottle of a wine both of them have
select pg_temp.login_as('66666666-6666-6666-6666-666666666666');
select add_bottles('יקב משותף', 'אדום', 1, 'red', 2020);
select set_config('test.host_cellar', my_cellar_id()::text, true);

-- the joiner: a fridge with a bottle in it, the same wine and year, another
-- wine on its way, a price, a drunk bottle with a tasting, and a rating
select pg_temp.login_as('77777777-7777-7777-7777-777777777777');
select set_config('test.joiner_cellar', my_cellar_id()::text, true);
select create_fridge('מקרר שלי', '[{"zones":[{"kind":"row","capacity":4}]}]'::jsonb);
select add_bottles('יקב משותף', 'אדום', 2, 'red', 2020,
                   jsonb_build_array(jsonb_build_object('zone_id', (select id from shelf_zones limit 1), 'slot', 1)),
                   p_paid => 99);
select add_bottles('יקב אחר', 'לבן', 1, 'white', 2022, p_rest_status => 'in_transit');
select drink_bottle((select id from bottles where status = 'unplaced' limit 1), current_date, 'היה טוב');
select set_rating((select id from wines where name = 'לבן'), 4.5);

-- the host invites; without confirming, the joiner is refused
select pg_temp.login_as('66666666-6666-6666-6666-666666666666');
select set_config('test.token3', create_invite('member'), true);
select pg_temp.login_as('77777777-7777-7777-7777-777777777777');
select throws_ok(format($$ select accept_invite('%s') $$, current_setting('test.token3')),
                 '23514', null, 'joining with data needs an explicit "bring my bottles"');
select lives_ok(format($$ select accept_invite('%s', true) $$, current_setting('test.token3')),
                'joining with "bring my bottles"');

-- now both see one cellar with everything in it
select is(my_cellar_id()::text, current_setting('test.host_cellar'), 'the joiner is in the host''s cellar');
select is((select count(*)::int from bottles), 4, 'all bottles are there (1 + 3)');
select is((select count(*)::int from wines), 2, 'the shared wine was matched by name, not duplicated');
select is((select count(*)::int from wine_vintages v join wines w on w.id = v.wine_id where w.name = 'אדום'), 1,
          'the same year became one vintage');
select is((select count(*)::int from bottles where status = 'stored'), 0, 'bottles from the old fridge are outside the fridge');
select is((select string_agg(status::text, ',' order by status::text) from bottles where vintage_id in
            (select v.id from wine_vintages v join wines w on w.id = v.wine_id where w.name = 'לבן')),
          'in_transit', 'a bottle on its way stays on its way');
select is((select count(*)::int from tastings where notes = 'היה טוב'), 1, 'the history came along');
select is((select count(*)::int from bottle_prices where paid = 99), 2, 'prices came along');

-- the old cellar (and its fridge) are gone
select pg_temp.logout();
select is((select count(*)::int from cellars where id = current_setting('test.joiner_cellar')::uuid), 0,
          'the old cellar was deleted, fridges and all');
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');

-- ---------- Wishlist ----------
select pg_temp.login_as('66666666-6666-6666-6666-666666666666');
select set_config('test.wines_before', (select count(*)::text from wines), true);
select lives_ok($$ select add_to_wishlist('יקב חלומות', 'אגדה', 'red', 2018, 'לחפש במבצע') $$, 'add a wish');
select is((select count(*)::int from bottles b join wine_vintages v on v.id = b.vintage_id join wines w on w.id = v.wine_id
            where w.name = 'אגדה'), 0, 'a wish creates a wine without bottles (not in the fridge or the list)');
select lives_ok($$ select add_to_wishlist('יקב חלומות', 'אגדה', 'red', 2018, null, 'https://example.com/w') $$,
                'adding the same wish again is fine');
select is((select count(*)::int from wishlist_items), 1, 'the same wine + year is one wish, not two');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from wishlist_items), 0, 'another cellar cannot see the wish');
select throws_ok($$ insert into wishlist_items (cellar_id, wine_id) select current_setting('test.host_cellar')::uuid, gen_random_uuid() $$,
                 '42501', null, 'another cellar cannot add to it');
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');

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

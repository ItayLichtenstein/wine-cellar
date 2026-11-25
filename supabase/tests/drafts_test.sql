-- AI drafts: household editors only, pending on creation, a cap on waiting drafts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"א"}'),
  ('dddddddd-0000-0000-0000-000000000002', 'v@example.com', '{"full_name":"צ"}'),
  ('dddddddd-0000-0000-0000-000000000003', 'x@example.com', '{"full_name":"ז"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'dddddddd-0000-0000-0000-000000000001'), true);
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'dddddddd-0000-0000-0000-000000000002');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.cellar')::uuid, 'dddddddd-0000-0000-0000-000000000002', 'viewer');

select pg_temp.login_as('dddddddd-0000-0000-0000-000000000001');
select lives_ok($$ insert into drafts (cellar_id, kind, payload, source) values (current_setting('test.cellar')::uuid, 'add_bottles', '{"winery":"Yatir"}', 'paste') $$,
                'an editor adds a draft');
select throws_ok($$ insert into drafts (cellar_id, kind, payload, source, status, decided_at) values (current_setting('test.cellar')::uuid, 'add_bottles', '{}', 'paste', 'approved', now()) $$,
                 '42501', null, 'a draft cannot be born approved');
select throws_ok($$ insert into drafts (cellar_id, kind, payload, source) values (current_setting('test.cellar')::uuid, 'add_bottles', '[1]', 'paste') $$,
                 '23514', null, 'the payload must be an object');

select pg_temp.login_as('dddddddd-0000-0000-0000-000000000002');
select is((select count(*)::int from drafts), 0, 'a viewer does not see drafts');
select throws_ok($$ insert into drafts (cellar_id, kind, payload, source) values (current_setting('test.cellar')::uuid, 'add_bottles', '{}', 'mcp') $$,
                 '42501', null, 'a viewer cannot add drafts');

select pg_temp.login_as('dddddddd-0000-0000-0000-000000000003');
select is((select count(*)::int from drafts), 0, 'another cellar does not see them');

select pg_temp.login_as('dddddddd-0000-0000-0000-000000000001');
insert into drafts (cellar_id, kind, payload, source)
select current_setting('test.cellar')::uuid, 'add_bottles', '{}', 'mcp' from generate_series(1, 49);
select is((select count(*)::int from drafts where status = 'pending'), 50, '50 drafts are waiting');
select throws_ok($$ insert into drafts (cellar_id, kind, payload, source) values (current_setting('test.cellar')::uuid, 'add_bottles', '{}', 'mcp') $$,
                 '23514', null, 'the 51st waiting draft is refused');

select * from finish();
rollback;

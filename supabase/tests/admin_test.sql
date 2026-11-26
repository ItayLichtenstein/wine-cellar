-- =====================================================================
-- App admin: only rows in app_admins may call the admin functions; the
-- table itself is invisible; ban / sign out / delete / add admin work and
-- are logged; an AI client acting for an admin is not an admin.
-- Runs in one transaction that is rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create function pg_temp.login_as(p_user uuid, p_client text default null) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
                    case when p_client is null then json_build_object('sub', p_user)::text
                         else json_build_object('sub', p_user, 'client_id', p_client)::text end, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'boss@example.com', '{"full_name":"בוס"}'),
  ('b0000000-0000-0000-0000-000000000001', 'bad@example.com',  '{"full_name":"מנצל"}'),
  ('c0000000-0000-0000-0000-000000000001', 'ok@example.com',   '{"full_name":"רגיל"}');
insert into app_admins (user_id) values ('a0000000-0000-0000-0000-000000000001');
insert into auth.sessions (id, user_id) values (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001');
select set_config('test.bad_cellar', (select cellar_id::text from cellar_members where user_id = 'b0000000-0000-0000-0000-000000000001'), true);

-- ---------- Structure ----------
select ok((select relrowsecurity from pg_class where oid = 'public.app_admins'::regclass), 'app_admins has RLS');
select is((select count(*)::int from pg_policies where tablename = 'app_admins'), 0, 'app_admins has no policies: invisible to the API');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_actions'::regclass), 'admin_actions has RLS');

-- ---------- A regular user ----------
select pg_temp.login_as('c0000000-0000-0000-0000-000000000001');
select is(is_app_admin(), false, 'a regular user is not an admin');
select is((select count(*)::int from app_admins), 0, 'a regular user cannot see who the admins are');
select throws_ok($$ select admin_overview() $$, '42501', null, 'a regular user cannot read the overview');
select throws_ok($$ select * from admin_users() $$, '42501', null, 'a regular user cannot list users');
select throws_ok($$ select admin_set_ban('b0000000-0000-0000-0000-000000000001', true) $$, '42501', null, 'a regular user cannot ban');
select throws_ok($$ select admin_set_admin('c0000000-0000-0000-0000-000000000001', true) $$, '42501', null, 'a regular user cannot make themselves admin');
select throws_ok($$ insert into app_admins (user_id) values ('c0000000-0000-0000-0000-000000000001') $$, '42501', null, 'nor insert into app_admins directly');

-- ---------- An AI client acting for the admin ----------
select pg_temp.login_as('a0000000-0000-0000-0000-000000000001', 'some-ai-client');
select is(is_app_admin(), false, 'an AI client is never an admin');
select throws_ok($$ select admin_overview() $$, '42501', null, 'an AI client cannot read the overview');

-- ---------- The admin ----------
select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select is(is_app_admin(), true, 'the admin is an admin');
select ok((select (admin_overview() ->> 'users')::int >= 3), 'the overview counts users');
select ok(not exists (select 1 from jsonb_object_keys(to_jsonb((select u from admin_users() u limit 1))) k where k ilike '%mail%'),
          'the user list has no email column');

select lives_ok($$ select admin_set_ban('b0000000-0000-0000-0000-000000000001', true, 'spam') $$, 'the admin bans a user');
select pg_temp.logout();
select ok((select banned_until > now() + interval '50 years' from auth.users where id = 'b0000000-0000-0000-0000-000000000001'), 'the ban is stored');
select is((select count(*)::int from auth.sessions where user_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'the banned user is signed out everywhere');

select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ select admin_set_ban('a0000000-0000-0000-0000-000000000001', true) $$, '23514', null, 'the admin cannot ban themselves');
select lives_ok($$ select admin_delete_user('b0000000-0000-0000-0000-000000000001', 'abuse') $$, 'the admin deletes a user');
select pg_temp.logout();
select is((select count(*)::int from cellars where id = current_setting('test.bad_cellar')::uuid), 0, 'a user alone in a cellar takes the cellar along');

select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select is((select array_agg(action order by id) from admin_actions where target_user = 'b0000000-0000-0000-0000-000000000001'), array['ban', 'delete_user'], 'every action is logged');

select * from finish();
rollback;

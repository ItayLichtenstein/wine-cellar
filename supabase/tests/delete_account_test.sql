-- Deleting an account: alone -> the cellar goes too; with others -> it stays.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.as_admin() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- A: alone, with a fridge and a wine. B + C: one cellar (C a full member). D + E: D the only member, E a viewer.
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'a@example.com', '{"full_name":"A"}'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'b@example.com', '{"full_name":"B"}'),
  ('eeeeeeee-0000-0000-0000-00000000000c', 'c@example.com', '{"full_name":"C"}'),
  ('eeeeeeee-0000-0000-0000-00000000000d', 'd@example.com', '{"full_name":"D"}'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@example.com', '{"full_name":"E"}');
select set_config('test.a', (select cellar_id::text from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-00000000000a'), true);
select set_config('test.b', (select cellar_id::text from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-00000000000b'), true);
select set_config('test.d', (select cellar_id::text from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-00000000000d'), true);
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-00000000000c');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.b')::uuid, 'eeeeeeee-0000-0000-0000-00000000000c', 'member');
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-00000000000e');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.d')::uuid, 'eeeeeeee-0000-0000-0000-00000000000e', 'viewer');
insert into wines (cellar_id, winery, name) values (current_setting('test.a')::uuid, 'Yatir', 'Forest'), (current_setting('test.b')::uuid, 'Yatir', 'Forest');

-- Alone.
select pg_temp.login_as('eeeeeeee-0000-0000-0000-00000000000a');
select is(account_deletion_plan(), 'delete_cellar', 'alone: the cellar goes too');
select lives_ok($$ select delete_my_account() $$, 'alone: deleting works');
select pg_temp.as_admin();
select is((select count(*)::int from cellars where id = current_setting('test.a')::uuid), 0, 'the cellar is gone');
select is((select count(*)::int from wines where cellar_id = current_setting('test.a')::uuid), 0, 'with its wines');
select is((select count(*)::int from auth.users where id = 'eeeeeeee-0000-0000-0000-00000000000a'), 0, 'and the user');

-- With another full member.
select pg_temp.login_as('eeeeeeee-0000-0000-0000-00000000000b');
select is(account_deletion_plan(), 'leave', 'with another member: only I go');
select delete_my_account();
select pg_temp.as_admin();
select is((select count(*)::int from wines where cellar_id = current_setting('test.b')::uuid), 1, 'the shared cellar keeps its wines');

-- The only full member, with a viewer.
select pg_temp.login_as('eeeeeeee-0000-0000-0000-00000000000d');
select is(account_deletion_plan(), 'last_member', 'the only full member with a viewer');
select throws_ok($$ select delete_my_account() $$, '23514', null, 'is refused');

-- An AI client (OAuth token) cannot do it, even if it reached the function.
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-00000000000e', 'client_id', 'x')::text, true);
select throws_ok($$ select delete_my_account() $$, '42501', null, 'an AI client cannot delete the account');

select * from finish();
rollback;

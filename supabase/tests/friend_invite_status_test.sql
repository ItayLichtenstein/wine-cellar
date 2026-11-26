-- =====================================================================
-- friend_invite_status: what the invite page shows (ok / friends / own /
-- invalid). Runs in one transaction that is rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'noa@example.com',  '{"full_name":"נועה"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'maya@example.com', '{"full_name":"מאיה"}');
update profiles set display_name = 'מאיה' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select set_config('test.maya', (select cellar_id::text from cellar_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'), true);

select pg_temp.login_as('bbbbbbbb-0000-0000-0000-000000000001');
select set_config('test.token', create_friend_invite(false), true);
select is((select status from friend_invite_status(current_setting('test.token'))), 'own',
          'the inviter opening her own link gets "own"');

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select status from friend_invite_status('nope')), 'invalid', 'an unknown token is invalid');
select is((select status from friend_invite_status(current_setting('test.token'))), 'ok', 'a fresh invite is ok');
select is((select names from friend_invite_status(current_setting('test.token'))), array['מאיה'],
          'ok shows who invites');
select is((select cellar_id from friend_invite_status(current_setting('test.token'))), null::uuid,
          'ok does not reveal the cellar id');

select accept_friend_invite(current_setting('test.token'));
select is((select status from friend_invite_status(current_setting('test.token'))), 'friends',
          'after accepting: "friends"');
select is((select cellar_id from friend_invite_status(current_setting('test.token'))), current_setting('test.maya')::uuid,
          'friends links to her cellar');

-- Expired: still "friends" (not "invalid") for someone who is already a friend.
reset role;
update friend_invites set expires_at = now() - interval '1 day';
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select status from friend_invite_status(current_setting('test.token'))), 'friends',
          'an expired link still says "friends" to a friend');

select * from finish();
rollback;

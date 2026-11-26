-- =====================================================================
-- readable_cellar_ids(): the set behind every "members and friends read"
-- policy (migration 33). Mine + cellars of friends who added me; never a
-- stranger's. Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.com'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@example.com');
select set_config('test.a', (select cellar_id::text from cellar_members where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), true);
select set_config('test.b', (select cellar_id::text from cellar_members where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), true);
select set_config('test.c', (select cellar_id::text from cellar_members where user_id = 'cccccccc-0000-0000-0000-00000000000c'), true);
-- B shared with A (one direction only).
insert into friend_links (owner_cellar_id, friend_cellar_id)
values (current_setting('test.b')::uuid, current_setting('test.a')::uuid);

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-00000000000a');
select set_eq('select public.readable_cellar_ids()',
  array[current_setting('test.a')::uuid, current_setting('test.b')::uuid],
  'A reads its own cellar and the friend that shares with it');

select pg_temp.login_as('bbbbbbbb-0000-0000-0000-00000000000b');
select set_eq('select public.readable_cellar_ids()', array[current_setting('test.b')::uuid],
  'B shared one way, so B reads only its own');

select pg_temp.login_as('cccccccc-0000-0000-0000-00000000000c');
select set_eq('select public.readable_cellar_ids()', array[current_setting('test.c')::uuid],
  'a stranger reads only its own cellar');

select set_config('role', 'anon', true);
select throws_ok('select public.readable_cellar_ids()', '42501', null, 'anon cannot call it');

select * from finish();
rollback;

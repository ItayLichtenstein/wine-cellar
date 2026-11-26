-- A cellar's own name: editors set it, viewers cannot, friends see it, others do not.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('abababab-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('abababab-0000-0000-0000-000000000002', 'v@example.com', '{"full_name":"V"}'),
  ('abababab-0000-0000-0000-000000000003', 'f@example.com', '{"full_name":"F"}'),
  ('abababab-0000-0000-0000-000000000004', 'x@example.com', '{"full_name":"X"}');
select set_config('test.a', (select cellar_id::text from cellar_members where user_id = 'abababab-0000-0000-0000-000000000001'), true);
select set_config('test.f', (select cellar_id::text from cellar_members where user_id = 'abababab-0000-0000-0000-000000000003'), true);
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'abababab-0000-0000-0000-000000000002');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.a')::uuid, 'abababab-0000-0000-0000-000000000002', 'viewer');
insert into friend_links (owner_cellar_id, friend_cellar_id) values
  (current_setting('test.a')::uuid, current_setting('test.f')::uuid),
  (current_setting('test.f')::uuid, current_setting('test.a')::uuid);

select pg_temp.login_as('abababab-0000-0000-0000-000000000001');
update cellars set custom_name = 'הבית ברחובות' where id = current_setting('test.a')::uuid;
select is((select custom_name from cellars where id = current_setting('test.a')::uuid), 'הבית ברחובות', 'an editor names the cellar');
select throws_ok($$ update cellars set custom_name = '   ' where id = current_setting('test.a')::uuid $$, '23514', null, 'a blank name is refused');

select pg_temp.login_as('abababab-0000-0000-0000-000000000002');
update cellars set custom_name = 'אחר' where id = current_setting('test.a')::uuid;
select pg_temp.login_as('abababab-0000-0000-0000-000000000001');
select is((select custom_name from cellars where id = current_setting('test.a')::uuid), 'הבית ברחובות', 'a viewer cannot rename it');

select pg_temp.login_as('abababab-0000-0000-0000-000000000003');
select is((select custom_name from friend_cellar_names() where cellar_id = current_setting('test.a')::uuid), 'הבית ברחובות', 'a friend sees the name');
select is((select count(*)::int from cellars where id = current_setting('test.a')::uuid), 0, 'but not the cellar row itself');

select pg_temp.login_as('abababab-0000-0000-0000-000000000004');
select is((select count(*)::int from friend_cellar_names()), 0, 'a stranger sees no names');

select * from finish();
rollback;

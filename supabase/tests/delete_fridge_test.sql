-- Deleting a fridge moves its bottles out (never deletes them); viewers cannot.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('ffffffff-0000-0000-0000-000000000002', 'v@example.com', '{"full_name":"V"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'ffffffff-0000-0000-0000-000000000001'), true);
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'ffffffff-0000-0000-0000-000000000002');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.cellar')::uuid, 'ffffffff-0000-0000-0000-000000000002', 'viewer');

select pg_temp.login_as('ffffffff-0000-0000-0000-000000000001');
select set_config('test.fridge', create_fridge('מקרר', '[{"zones":[{"kind":"row","capacity":3,"label":"שורה"}]}]')::text, true);
insert into wines (cellar_id, winery, name) values (current_setting('test.cellar')::uuid, 'Yatir', 'Forest');
insert into wine_vintages (cellar_id, wine_id, year) select current_setting('test.cellar')::uuid, id, 2019 from wines where winery = 'Yatir';
insert into bottles (cellar_id, vintage_id, status, zone_id, slot)
select current_setting('test.cellar')::uuid, v.id, 'stored', z.id, 1
  from wine_vintages v, shelf_zones z join shelves s on s.id = z.shelf_id
 where s.fridge_id = current_setting('test.fridge')::uuid;

select pg_temp.login_as('ffffffff-0000-0000-0000-000000000002');
delete from fridges where id = current_setting('test.fridge')::uuid;
select pg_temp.login_as('ffffffff-0000-0000-0000-000000000001');
select is((select count(*)::int from fridges where id = current_setting('test.fridge')::uuid), 1, 'a viewer cannot delete a fridge');

select lives_ok($$ delete from fridges where id = current_setting('test.fridge')::uuid $$, 'an editor deletes it');
select is((select count(*)::int from fridges where id = current_setting('test.fridge')::uuid), 0, 'the fridge is gone');
select is((select status::text from bottles where cellar_id = current_setting('test.cellar')::uuid), 'unplaced', 'its bottle moved out, not deleted');

select * from finish();
rollback;

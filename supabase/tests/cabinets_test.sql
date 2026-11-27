-- Cabinets (migration 45): a fridge row with kind 'cabinet'.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values ('e3000000-0000-0000-0000-000000000001', 'cab@example.com', '{"full_name":"ע"}');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', json_build_object('sub', 'e3000000-0000-0000-0000-000000000001')::text, true);

select set_config('test.fridge', create_fridge('Kitchen', '[{"zones":[{"kind":"row","capacity":6,"label":"שורה"}]}]')::text, true);
select is((select kind from fridges where id = current_setting('test.fridge')::uuid), 'fridge', 'a new one is a fridge by default');
update fridges set kind = 'cabinet' where id = current_setting('test.fridge')::uuid;
select is((select kind from fridges where id = current_setting('test.fridge')::uuid), 'cabinet', 'an editor can make it a cabinet');
select throws_ok($$ update fridges set kind = 'garage' where id = current_setting('test.fridge')::uuid $$, '23514', null, 'only fridge or cabinet');

select * from finish();
rollback;

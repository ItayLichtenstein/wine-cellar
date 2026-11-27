-- One cellar cannot fill the shared database: each table has a ceiling per cellar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'big@example.com', '{"full_name":"ג"}'),
  ('ffffffff-0000-0000-0000-000000000002', 'other@example.com', '{"full_name":"א"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'ffffffff-0000-0000-0000-000000000001'), true);
select set_config('test.other', (select cellar_id::text from cellar_members where user_id = 'ffffffff-0000-0000-0000-000000000002'), true);

insert into wines (id, cellar_id, winery, name) values ('ffffffff-1111-0000-0000-000000000001', current_setting('test.cellar')::uuid, 'Yatir', 'Forest');
insert into wine_vintages (id, wine_id, cellar_id, year) values ('ffffffff-2222-0000-0000-000000000001', 'ffffffff-1111-0000-0000-000000000001', current_setting('test.cellar')::uuid, 2019);

select lives_ok($$ insert into bottles (cellar_id, vintage_id) select current_setting('test.cellar')::uuid, 'ffffffff-2222-0000-0000-000000000001' from generate_series(1, 10000) $$,
                '10,000 bottles in one insert (a big import) are allowed');
select throws_ok($$ insert into bottles (cellar_id, vintage_id) values (current_setting('test.cellar')::uuid, 'ffffffff-2222-0000-0000-000000000001') $$,
                 '23514', null, 'the 10,001st bottle is refused');
select throws_ok($$ insert into fridges (cellar_id, name) select current_setting('test.cellar')::uuid, 'f' || g from generate_series(1, 21) g $$,
                 '23514', null, 'more than 20 fridges are refused, and nothing of that insert stays');
select lives_ok($$ insert into fridges (cellar_id, name) values (current_setting('test.other')::uuid, 'another cellar') $$,
                'another cellar is not affected');

select * from finish();
rollback;

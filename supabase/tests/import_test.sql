-- =====================================================================
-- Import from a file: import_cellar() (all or nothing, reuses wines,
-- RLS as the caller) and undo_last_import().
-- Runs in one transaction that is rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'noa@example.com', '{"full_name":"נועה"}'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'eve@example.com', '{"full_name":"איב"}');
select set_config('test.noa', (select cellar_id::text from cellar_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);

-- Noa already has Yatir Forest.
insert into wines (id, cellar_id, winery, name) values
  ('aaaaaaaa-1111-0000-0000-000000000001', current_setting('test.noa')::uuid, 'Yatir', 'Forest');

select has_table('public', 'imports', 'imports table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.imports'::regclass), 'imports has RLS');

-- ---------- Import ----------
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select import_cellar('csv', repeat('a', 64), '[
     {"winery":"yatir","name":"FOREST","year":2019,"status":"unplaced","paid":120},
     {"winery":"Tzora","name":"Misty Hills","year":2020,"type":"red","note":"x"},
     {"winery":"Tzora","name":"Misty Hills","year":2020},
     {"winery":"Castel","name":"Blanc","status":"consumed","added_on":"2024-01-01","consumed_on":"2025-02-02","is_gift":true}
   ]'::jsonb) - 'import_id'),
  '{"wines": 2, "bottles": 4}'::jsonb,
  'imports 4 bottles, creates 2 new wines'
);
select is((select count(*)::int from wines where cellar_id = current_setting('test.noa')::uuid and lower(winery) = 'yatir'), 1, 'an existing wine is reused, not duplicated');
select is((select count(*)::int from wine_vintages v join wines w on w.id = v.wine_id where w.name = 'Misty Hills'), 1, 'same wine and year → one vintage');
select is((select count(*)::int from bottles where import_id is not null and status = 'unplaced'), 3, 'bottles land outside the fridge');
select is((select consumed_on from bottles where status = 'consumed' and import_id is not null), '2025-02-02'::date, 'drunk bottles keep their date');
select is((select paid from bottle_prices p join bottles b on b.id = p.bottle_id join wine_vintages v on v.id = b.vintage_id where v.year = 2019 and b.import_id is not null), 120.00::numeric, 'price is imported');
select is((select bottles from imports), 4, 'the import is recorded with its counts');

-- All or nothing: a bad row (winery too long) leaves nothing behind.
select throws_ok(
  $$ select import_cellar('csv', null, ('[{"winery":"ok","name":"one"},{"winery":"' || repeat('x', 200) || '","name":"two"}]')::jsonb) $$,
  '23514', null, 'a bad row fails the whole import'
);
select is((select count(*)::int from wines where winery = 'ok'), 0, 'nothing from the failed import stays');

select throws_ok($$ select import_cellar('csv', null, '[]'::jsonb) $$, '22023', null, 'an empty import is refused');

-- ---------- Others ----------
select pg_temp.login_as('eeeeeeee-0000-0000-0000-000000000001');
select is((select count(*)::int from imports), 0, 'a stranger does not see the imports');
select throws_ok($$ select undo_last_import() $$, 'P0002', null, 'a stranger has nothing to undo');

-- ---------- Undo ----------
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select undo_last_import()), 4, 'undo removes the 4 imported bottles');
select ok(
  (select count(*) from wines where name in ('Misty Hills', 'Blanc')) = 0
  and (select count(*) from wines where name = 'Forest') = 1,
  'undo removes the wines it created and keeps the one that existed'
);

select pg_temp.logout();
select * from finish();
rollback;

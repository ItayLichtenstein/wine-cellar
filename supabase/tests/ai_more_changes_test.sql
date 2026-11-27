-- More AI changes (migration 44): a wine's details and the fridge, each undoable.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.request(p_claims jsonb, p_method text, p_path text) returns void language sql as $$
  select set_config('request.jwt.claims', p_claims::text, true),
         set_config('request.method', p_method, true),
         set_config('request.path', p_path, true);
$$;
create function pg_temp.logged(p_kind draft_kind, p_undo jsonb) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into drafts (cellar_id, kind, payload, source) values (my_cellar_id(), 'move', '{}', 'mcp') returning id into v_id;
  update drafts set kind = p_kind, status = 'approved', decided_at = now(), applied_by_ai = true, undo = p_undo where id = v_id;
  return v_id;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('e2000000-0000-0000-0000-000000000001', 'more@example.com', '{"full_name":"ע"}');
select pg_temp.login_as('e2000000-0000-0000-0000-000000000001');
insert into wines (id, cellar_id, winery, name, grape) values ('e2000000-1111-0000-0000-000000000001', my_cellar_id(), 'Yatir', 'Forest', 'Cabernet');
insert into wine_vintages (id, wine_id, cellar_id, year, drink_from, drink_to) values ('e2000000-2222-0000-0000-000000000001', 'e2000000-1111-0000-0000-000000000001', my_cellar_id(), 2019, 2022, 2030);
insert into bottles (id, cellar_id, vintage_id) values ('e2000000-3333-0000-0000-000000000001', my_cellar_id(), 'e2000000-2222-0000-0000-000000000001');

-- ---------- edit a wine, then undo ----------
select set_config('test.undo', ai_edit_wine('e2000000-2222-0000-0000-000000000001', array['e2000000-3333-0000-0000-000000000001']::uuid[],
  '{"drink_to": 2035, "grape": "Merlot", "price": 180}')::text, true);
select is((select drink_to from wine_vintages where id = 'e2000000-2222-0000-0000-000000000001'), 2035, 'the drinking window changed');
select is((select grape from wines where id = 'e2000000-1111-0000-0000-000000000001'), 'Merlot', 'the grape changed');
select is((select paid from bottle_prices where bottle_id = 'e2000000-3333-0000-0000-000000000001'), 180::numeric, 'the price was set');
select is((select drink_from from wine_vintages where id = 'e2000000-2222-0000-0000-000000000001'), 2022, 'what was not passed stays');

select undo_ai_change(pg_temp.logged('edit', current_setting('test.undo')::jsonb));
select is((select drink_to from wine_vintages where id = 'e2000000-2222-0000-0000-000000000001'), 2030, 'undo: the window is back');
select is((select grape from wines where id = 'e2000000-1111-0000-0000-000000000001'), 'Cabernet', 'undo: the grape is back');
select is((select count(*)::int from bottle_prices where bottle_id = 'e2000000-3333-0000-0000-000000000001'), 0, 'undo: no price, as before');

-- ---------- the fridge, then undo ----------
insert into fridges (id, cellar_id, name) values ('e2000000-4444-0000-0000-000000000001', my_cellar_id(), 'Kitchen');
select update_fridge('e2000000-4444-0000-0000-000000000001', 'Kitchen', '[{"zones":[{"kind":"row","capacity":5,"label":"שורה"}]}]');
select set_config('test.fridge', jsonb_build_object('fridge', 'e2000000-4444-0000-0000-000000000001', 'name', 'Kitchen',
  'shelves', (select jsonb_agg(jsonb_build_object('id', s.id, 'zones', (select jsonb_agg(jsonb_build_object('id', z.id, 'kind', z.kind, 'capacity', z.capacity, 'label', z.label)) from shelf_zones z where z.shelf_id = s.id))) from shelves s where s.fridge_id = 'e2000000-4444-0000-0000-000000000001'))::text, true);
update shelf_zones set capacity = 6 where cellar_id = my_cellar_id();
select undo_ai_change(pg_temp.logged('fridge', current_setting('test.fridge')::jsonb));
select is((select capacity from shelf_zones where cellar_id = my_cellar_id()), 5, 'undo: the fridge layout is back');

-- ---------- the guard ----------
insert into ai_edit_grants (client_id) values ('claude');
select pg_temp.request('{"sub":"e2000000-0000-0000-0000-000000000001","client_id":"claude"}', 'POST', '/rpc/update_fridge');
select lives_ok($$ select limit_oauth_clients() $$, 'with the grant an AI may change the fridge');

select * from finish();
rollback;

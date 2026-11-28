-- =====================================================================
-- The AI sets up a new fridge or cabinet (migration 46): only with the
-- user's grant, the kind is kept, and the undo removes it while empty.
-- Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.request(p_claims jsonb, p_method text, p_path text) returns void language sql as $$
  select set_config('request.jwt.claims', p_claims::text, true),
         set_config('request.method', p_method, true),
         set_config('request.path', p_path, true);
$$;
create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logged(p_undo jsonb) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into drafts (cellar_id, kind, payload, source) values (my_cellar_id(), 'move', '{}', 'mcp') returning id into v_id;
  update drafts set kind = 'fridge', status = 'approved', decided_at = now(), applied_by_ai = true, undo = p_undo where id = v_id;
  return v_id;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('e3000000-0000-0000-0000-000000000001', 'newfridge@example.com', '{"full_name":"מ"}');
select set_config('test.claims_ai', '{"sub":"e3000000-0000-0000-0000-000000000001","client_id":"claude"}', true);

-- ---------- The guard ----------
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/ai_create_fridge');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'without a grant an AI cannot create a fridge');
select pg_temp.login_as('e3000000-0000-0000-0000-000000000001');
insert into ai_edit_grants (client_id) values ('claude');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/ai_create_fridge');
select lives_ok($$ select limit_oauth_clients() $$, 'with the grant it may');
select pg_temp.login_as('e3000000-0000-0000-0000-000000000001');

-- ---------- Creating ----------
select set_config('test.cabinet', ai_create_fridge('ארון', '[{"zones":[{"kind":"row","capacity":4,"label":"שורה"}]}]', 'cabinet', 'Landers', 'X')::text, true);
select is((select kind from fridges where id = current_setting('test.cabinet')::uuid), 'cabinet', 'the kind is kept');
select is((select brand from fridges where id = current_setting('test.cabinet')::uuid), null, 'a cabinet has no brand');
select is((select count(*)::int from shelves where fridge_id = current_setting('test.cabinet')::uuid), 1, 'its shelves are built');
select throws_ok($$ select ai_create_fridge('x', '[{"zones":[{"kind":"row","capacity":4,"label":"שורה"}]}]', 'boat') $$, '23514', null, 'an unknown kind is refused');
select set_config('test.fridge', ai_create_fridge('מטבח', '[{"zones":[{"kind":"row","capacity":4,"label":"שורה"}]}]')::text, true);
select is((select kind from fridges where id = current_setting('test.fridge')::uuid), 'fridge', 'a fridge by default');

-- ---------- Undo ----------
select undo_ai_change(pg_temp.logged(jsonb_build_object('created', current_setting('test.cabinet'))));
select is((select count(*)::int from fridges where id = current_setting('test.cabinet')::uuid), 0, 'undo: the empty cabinet is gone');

insert into wines (cellar_id, winery, name) values (my_cellar_id(), 'Yatir', 'Forest');
insert into wine_vintages (cellar_id, wine_id, year) select my_cellar_id(), id, 2019 from wines where winery = 'Yatir';
insert into bottles (cellar_id, vintage_id, status, zone_id, slot)
select my_cellar_id(), v.id, 'stored', z.id, 1
  from wine_vintages v, shelf_zones z join shelves s on s.id = z.shelf_id
 where s.fridge_id = current_setting('test.fridge')::uuid;
select set_config('test.draft', pg_temp.logged(jsonb_build_object('created', current_setting('test.fridge')))::text, true);
select throws_ok($$ select undo_ai_change(current_setting('test.draft')::uuid) $$, '23514', null, 'undo is refused once a bottle is in it');
select is((select count(*)::int from fridges where id = current_setting('test.fridge')::uuid), 1, 'and the fridge stays');

select * from finish();
rollback;

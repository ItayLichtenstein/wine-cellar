-- =====================================================================
-- AI edit mode (ADR 0013): the guard lets an AI change bottles only with
-- the user's grant; an AI never grants itself; every change can be undone.
-- Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.request(p_claims jsonb, p_method text, p_path text) returns void language sql as $$
  select set_config('request.jwt.claims', p_claims::text, true),
         set_config('request.method', p_method, true),
         set_config('request.path', p_path, true);
$$;
create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('e1000000-0000-0000-0000-000000000001', 'edit@example.com', '{"full_name":"עורך"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'e1000000-0000-0000-0000-000000000001'), true);
select set_config('test.claims_ai', '{"sub":"e1000000-0000-0000-0000-000000000001","client_id":"claude"}', true);

-- ---------- The guard ----------
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/add_bottles');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'without a grant an AI cannot add bottles');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/ai_edit_grants');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'an AI cannot grant itself edit rights');

select pg_temp.login_as('e1000000-0000-0000-0000-000000000001');
insert into ai_edit_grants (client_id) values ('claude');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/add_bottles');
select lives_ok($$ select limit_oauth_clients() $$, 'with the grant an AI may add bottles');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/ai_delete_bottle');
select lives_ok($$ select limit_oauth_clients() $$, 'with the grant an AI may delete a bottle');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/undo_ai_change');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'an AI cannot undo (only the user)');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/delete_my_account');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'even with the grant: never the account');
select pg_temp.request('{"sub":"e1000000-0000-0000-0000-000000000001","client_id":"other-ai"}', 'POST', '/rpc/add_bottles');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'the grant is per AI client');

-- ---------- Delete and undo ----------
select pg_temp.login_as('e1000000-0000-0000-0000-000000000001');
select set_config('test.b1', (select (add_bottles('Yatir', 'Forest', 1, 'red', 2019))[1]::text), true);
insert into bottle_prices (bottle_id, cellar_id, paid) values (current_setting('test.b1')::uuid, current_setting('test.cellar')::uuid, 120);
select set_config('test.snap', ai_delete_bottle(current_setting('test.b1')::uuid)::text, true);
select is((select count(*)::int from bottles where id = current_setting('test.b1')::uuid), 0, 'deleted');
insert into drafts (id, cellar_id, kind, payload, source) values ('d1000000-0000-0000-0000-000000000001', current_setting('test.cellar')::uuid, 'delete', '{}', 'mcp');
update drafts set status = 'approved', decided_at = now(), applied_by_ai = true, undo = current_setting('test.snap')::jsonb where id = 'd1000000-0000-0000-0000-000000000001';
select lives_ok($$ select undo_ai_change('d1000000-0000-0000-0000-000000000001') $$, 'undo a delete');
select is((select paid::int from bottle_prices where bottle_id = current_setting('test.b1')::uuid), 120, 'the bottle and its price are back');
select throws_ok($$ select undo_ai_change('d1000000-0000-0000-0000-000000000001') $$, 'P0002', null, 'undo only once');

-- ---------- Drink and undo ----------
select set_config('test.t1', drink_bottle(current_setting('test.b1')::uuid)::text, true);
insert into drafts (id, cellar_id, kind, payload, source) values ('d1000000-0000-0000-0000-000000000002', current_setting('test.cellar')::uuid, 'drink', '{}', 'mcp');
update drafts set status = 'approved', decided_at = now(), applied_by_ai = true,
  undo = jsonb_build_object('bottle', current_setting('test.b1'), 'tasting', current_setting('test.t1'), 'status', 'unplaced', 'zone_id', null, 'slot', null)
  where id = 'd1000000-0000-0000-0000-000000000002';
select lives_ok($$ select undo_ai_change('d1000000-0000-0000-0000-000000000002') $$, 'undo a drink');
select is((select status::text from bottles where id = current_setting('test.b1')::uuid), 'unplaced', 'the bottle is back in the cellar, no tasting left');

-- ---------- Add and undo ----------
insert into drafts (id, cellar_id, kind, payload, source) values ('d1000000-0000-0000-0000-000000000003', current_setting('test.cellar')::uuid, 'add_bottles', '{}', 'mcp');
update drafts set status = 'approved', decided_at = now(), applied_by_ai = true, undo = jsonb_build_object('bottles', jsonb_build_array(current_setting('test.b1')))
  where id = 'd1000000-0000-0000-0000-000000000003';
select pg_temp.login_as('e1000000-0000-0000-0000-000000000001');
select undo_ai_change('d1000000-0000-0000-0000-000000000003');
select is((select count(*)::int from bottles where id = current_setting('test.b1')::uuid), 0, 'undo an add removes the bottles');

select * from finish();
rollback;

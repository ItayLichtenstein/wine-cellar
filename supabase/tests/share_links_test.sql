-- =====================================================================
-- View link without an account: the guest's only door is shared_cellar().
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.as_guest() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'owner@example.com', '{"full_name":"רון"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'viewer@example.com', '{"full_name":"צופה"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'cccccccc-0000-0000-0000-000000000001'), true);
delete from cellars where id = (select cellar_id from cellar_members where user_id = 'cccccccc-0000-0000-0000-000000000002');
insert into cellar_members (cellar_id, user_id, role) values (current_setting('test.cellar')::uuid, 'cccccccc-0000-0000-0000-000000000002', 'viewer');

insert into wines (id, cellar_id, winery, name, grape, body, label_thumb) values ('cccccccc-1111-0000-0000-000000000001', current_setting('test.cellar')::uuid, 'Yatir', 'Forest', 'Cabernet', 'full', 'data:image/webp;base64,AA');
insert into fridges (cellar_id, name, kind) values (current_setting('test.cellar')::uuid, 'Cabinet', 'cabinet');
insert into wine_vintages (id, wine_id, cellar_id, year) values ('cccccccc-2222-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000001', current_setting('test.cellar')::uuid, 2019);
insert into bottles (id, cellar_id, vintage_id, note) values ('cccccccc-3333-0000-0000-000000000001', current_setting('test.cellar')::uuid, 'cccccccc-2222-0000-0000-000000000001', 'secret note');
insert into critic_scores (vintage_id, cellar_id, critic, score) values ('cccccccc-2222-0000-0000-000000000001', current_setting('test.cellar')::uuid, 'Parker', 93);
insert into bottle_prices (bottle_id, cellar_id, paid) values ('cccccccc-3333-0000-0000-000000000001', current_setting('test.cellar')::uuid, 180);
insert into tastings (cellar_id, wine_id, notes) values (current_setting('test.cellar')::uuid, 'cccccccc-1111-0000-0000-000000000001', 'great');

-- ---------- Creating ----------
select pg_temp.login_as('cccccccc-0000-0000-0000-000000000002');
select throws_ok($$ select create_share_link() $$, '42501', null, 'a viewer cannot create a view link');

select pg_temp.login_as('cccccccc-0000-0000-0000-000000000001');
select set_config('test.t1', create_share_link(true), true);
select is((select count(*)::int from share_links where revoked_at is null), 1, 'the owner created a link');

-- ---------- The guest ----------
select pg_temp.as_guest();
select throws_ok($$ select count(*) from share_links $$, '42501', null, 'a guest cannot read the links table');
select throws_ok($$ select count(*) from bottles $$, '42501', null, 'a guest cannot read bottles directly');
select is(shared_cellar('nope'), null, 'an unknown token returns nothing');
select is(jsonb_array_length(shared_cellar(current_setting('test.t1')) -> 'bottles'), 1, 'the guest sees the bottles');
select is(shared_cellar(current_setting('test.t1')) -> 'bottles' -> 0 ->> 'price', null, 'prices hidden by default');
select is(shared_cellar(current_setting('test.t1')) ? 'history', false, 'the drinking history is never shared');
select is(shared_cellar(current_setting('test.t1')) -> 'bottles' -> 0 ->> 'thumb', 'data:image/webp;base64,AA', 'the guest sees the label photo');
select is(shared_cellar(current_setting('test.t1')) -> 'bottles' -> 0 ->> 'grape', 'Cabernet', 'the guest sees the grape');
select is(shared_cellar(current_setting('test.t1')) -> 'bottles' -> 0 ->> 'body', 'full', 'the guest sees the body');
select is(shared_cellar(current_setting('test.t1')) -> 'fridges' -> 0 ->> 'kind', 'cabinet', 'the guest sees a cabinet as a cabinet');
select is(shared_cellar(current_setting('test.t1')) -> 'bottles' -> 0 -> 'critics', '[{"critic": "Parker", "score": 93}]'::jsonb, 'the guest sees critic scores');
select is(shared_cellar(current_setting('test.t1'))::text ~ '(secret note|great)', false, 'no bottle notes or tasting notes for the guest');
select is(shared_cellar(current_setting('test.t1')) -> 'names', '["רון"]'::jsonb, 'only full members'' names, not the viewer');
select is(shared_cellar(current_setting('test.t1'))::text ~ 'example\.com', false, 'no email anywhere in the answer');

-- ---------- A new link cuts the old one ----------
select pg_temp.login_as('cccccccc-0000-0000-0000-000000000001');
select set_config('test.t2', create_share_link(false), true);
select is((select count(*)::int from share_links where revoked_at is null), 1, 'still one active link');
select pg_temp.as_guest();
select is(shared_cellar(current_setting('test.t1')), null, 'the old link stopped working');
select is((shared_cellar(current_setting('test.t2')) -> 'bottles' -> 0 ->> 'price')::numeric, 180::numeric, 'this link shows prices');
select is(shared_cellar(current_setting('test.t2'))::text ~ 'great', false, 'tasting notes never leak');

-- ---------- Revoking ----------
select pg_temp.login_as('cccccccc-0000-0000-0000-000000000001');
select lives_ok($$ select revoke_share_link() $$, 'the owner revokes the link');
select pg_temp.as_guest();
select is(shared_cellar(current_setting('test.t2')), null, 'a revoked link shows nothing');

select * from finish();
rollback;

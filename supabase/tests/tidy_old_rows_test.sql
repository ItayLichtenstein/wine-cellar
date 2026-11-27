-- Tables that only grow are kept small: old decided drafts and old invites go away.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'tidy@example.com', '{"full_name":"ת"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'eeeeeeee-0000-0000-0000-000000000001'), true);

-- Decided drafts: one 40 days old, 205 recent; one old waiting draft.
insert into drafts (cellar_id, kind, payload, source, status, decided_at, created_at)
  values (current_setting('test.cellar')::uuid, 'drink', '{}', 'mcp', 'approved', now() - interval '40 days', now() - interval '40 days');
insert into drafts (cellar_id, kind, payload, source, created_at)
  values (current_setting('test.cellar')::uuid, 'drink', '{"old":true}', 'mcp', now() - interval '90 days');
insert into drafts (cellar_id, kind, payload, source, status, decided_at)
  select current_setting('test.cellar')::uuid, 'move', '{}', 'mcp', 'approved', now() - (g || ' minutes')::interval from generate_series(1, 205) g;

select is((select count(*)::int from drafts where cellar_id = current_setting('test.cellar')::uuid and status <> 'pending' and decided_at < now() - interval '30 days'), 0,
          'a decided draft older than 30 days is deleted');
select is((select count(*)::int from drafts where cellar_id = current_setting('test.cellar')::uuid and status <> 'pending'), 200,
          'at most 200 decided drafts per cellar');
select is((select count(*)::int from drafts where cellar_id = current_setting('test.cellar')::uuid and status = 'pending'), 1,
          'a waiting draft is never deleted');

-- Invites: one expired long ago, then 20 open ones; the 21st is refused.
insert into cellar_invites (cellar_id, token_hash, expires_at, created_at)
  values (current_setting('test.cellar')::uuid, repeat('a', 64), now() - interval '40 days', now() - interval '47 days');
insert into cellar_invites (cellar_id, token_hash)
  select current_setting('test.cellar')::uuid, lpad(to_hex(g), 64, '0') from generate_series(1, 20) g;
select is((select count(*)::int from cellar_invites where cellar_id = current_setting('test.cellar')::uuid and expires_at < now()), 0,
          'an invite that expired long ago is deleted');
select throws_ok($$ insert into cellar_invites (cellar_id, token_hash) values (current_setting('test.cellar')::uuid, repeat('b', 64)) $$,
                 '23514', null, 'at most 20 open household invites');
select throws_ok($$ insert into friend_invites (cellar_id, token_hash) select current_setting('test.cellar')::uuid, lpad(to_hex(g), 64, 'c') from generate_series(1, 21) g $$,
                 '23514', null, 'at most 20 open friend invites');

select * from finish();
rollback;

-- AI clients (tokens with client_id) may only read and add drafts.
-- PostgREST calls limit_oauth_clients() before each request; here we set
-- the same request settings it would set, and call it directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.request(p_claims jsonb, p_method text, p_path text) returns void language sql as $$
  select set_config('request.jwt.claims', p_claims::text, true),
         set_config('request.method', p_method, true),
         set_config('request.path', p_path, true);
$$;

select is((select rolconfig::text from pg_roles where rolname = 'authenticator') ~ 'db_pre_request=public.limit_oauth_clients', true,
          'PostgREST runs the check before every request');

-- The user themself: anything (RLS decides).
select pg_temp.request('{"sub":"u1"}', 'DELETE', '/bottles');
select lives_ok($$ select limit_oauth_clients() $$, 'a normal sign-in token is not limited');

-- An AI client.
select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'GET', '/bottles');
select lives_ok($$ select limit_oauth_clients() $$, 'an AI client may read');
select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'POST', '/drafts');
select lives_ok($$ select limit_oauth_clients() $$, 'an AI client may add a draft');
select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'POST', '/rpc/my_friends');
select lives_ok($$ select limit_oauth_clients() $$, 'an AI client may call a read-only function');

select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'DELETE', '/bottles');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'an AI client cannot delete bottles');
select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'POST', '/rpc/add_bottles');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'an AI client cannot add bottles directly (only drafts)');
select pg_temp.request('{"sub":"u1","client_id":"c1"}', 'PATCH', '/drafts');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'an AI client cannot approve its own draft');

select * from finish();
rollback;

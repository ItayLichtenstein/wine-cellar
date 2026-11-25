-- =====================================================================
-- AI clients (OAuth, stage 7) may read and suggest, never change.
--
-- When the user connects an AI through our OAuth server (Supabase Auth's
-- OAuth 2.1 server), the AI receives a normal access token for that user,
-- plus a `client_id` claim. RLS alone would let it do whatever the user
-- can – including deleting bottles directly through the API, bypassing
-- our MCP tools. The consent screen promises "read, and suggest drafts".
--
-- One place enforces that promise: PostgREST's pre-request hook runs this
-- function before EVERY API request. For a token with client_id, only
-- reads (GET/HEAD), adding a draft, and a short list of read-only
-- functions are allowed. Everything else fails before it starts.
-- (Normal sign-in tokens have no client_id and are not affected.)
-- =====================================================================

create function public.limit_oauth_clients()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_client text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id';
  v_method text := current_setting('request.method', true);
  v_path   text := current_setting('request.path', true);
begin
  if v_client is null then
    return; -- the user themself (or anon): RLS as usual
  end if;
  if v_method in ('GET', 'HEAD') then
    return;
  end if;
  if v_method = 'POST' and v_path in (
    '/drafts',
    '/rpc/my_cellar_id', '/rpc/my_friends', '/rpc/is_cellar_editor', '/rpc/is_cellar_member', '/rpc/can_read_cellar'
  ) then
    return;
  end if;
  raise exception 'AI clients can only read and suggest drafts'
    using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
end;
$$;

grant execute on function public.limit_oauth_clients() to anon, authenticated;

-- Tell PostgREST to run it before every request, and to pick up the change.
alter role authenticator set pgrst.db_pre_request = 'public.limit_oauth_clients';
notify pgrst, 'reload config';

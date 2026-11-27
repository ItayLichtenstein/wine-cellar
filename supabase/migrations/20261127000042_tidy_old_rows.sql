-- =====================================================================
-- Tables that only grow are kept small, without a scheduled job: each new
-- row clears the cellar's own old ones (one indexed delete, cheap).
--   drafts: decided ones (approved, rejected, an AI's own changes) are
--     kept 30 days, the same window the AI page shows and can undo, and at
--     most 200 per cellar, so a runaway AI in edit mode cannot fill it.
--     Waiting drafts are never touched (already capped at 50).
--   invites: links that expired over 30 days ago are deleted, and a
--     cellar can hold at most 20 open links of each kind.
-- =====================================================================

create index if not exists drafts_cellar_decided on public.drafts (cellar_id, decided_at) where status <> 'pending';

create function public.tidy_drafts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.drafts
   where cellar_id = new.cellar_id
     and status <> 'pending'
     and coalesce(decided_at, created_at) < now() - interval '30 days';
  delete from public.drafts
   where id in (
     select id from public.drafts
      where cellar_id = new.cellar_id and status <> 'pending'
      order by coalesce(decided_at, created_at) desc
      offset 200
   );
  return null;
end;
$$;
revoke execute on function public.tidy_drafts() from public, anon, authenticated;
create trigger drafts_tidy after insert on public.drafts for each row execute function public.tidy_drafts();

create function public.tidy_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format('delete from public.%I where cellar_id = $1 and expires_at < now() - interval ''30 days''', tg_table_name)
    using new.cellar_id;
  if tg_table_name = 'cellar_invites' then
    if (select count(*) from public.cellar_invites where cellar_id = new.cellar_id and used_at is null and expires_at > now()) >= 20 then
      raise exception 'too many open invites' using errcode = 'check_violation', hint = 'too_many_invites';
    end if;
  elsif (select count(*) from public.friend_invites where cellar_id = new.cellar_id and use_count < max_uses and expires_at > now()) >= 20 then
    raise exception 'too many open invites' using errcode = 'check_violation', hint = 'too_many_invites';
  end if;
  return new;
end;
$$;
revoke execute on function public.tidy_invites() from public, anon, authenticated;
create trigger cellar_invites_tidy before insert on public.cellar_invites for each row execute function public.tidy_invites();
create trigger friend_invites_tidy before insert on public.friend_invites for each row execute function public.tidy_invites();

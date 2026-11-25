-- =====================================================================
-- AI drafts (stages 7–8, ADR 0001). Every AI write is a draft that a
-- person approves on the site (human in the loop). A draft comes from the
-- MCP server or from "paste the AI's answer".
--
-- The payload is JSON because each kind has its own shape. It is checked
-- in the shared service layer (src/lib/drafts.ts) when it is created and
-- again when it is approved, through the same add-bottles form as manual input.
-- Drafts are household-only: not viewers, not friends (permissions matrix).
-- =====================================================================

create type public.draft_kind   as enum ('add_bottles');
create type public.draft_status as enum ('pending', 'approved', 'rejected');
create type public.draft_source as enum ('mcp', 'paste');

create table public.drafts (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null references public.cellars (id) on delete cascade,
  kind        public.draft_kind not null,
  payload     jsonb not null check (jsonb_typeof(payload) = 'object' and char_length(payload::text) <= 4000),
  status      public.draft_status not null default 'pending',
  source      public.draft_source not null,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  check ((status = 'pending') = (decided_at is null))
);
create index on public.drafts (cellar_id, status);

alter table public.drafts enable row level security;

create policy "drafts: editors read"   on public.drafts for select to authenticated using (public.is_cellar_editor(cellar_id));
create policy "drafts: editors add"    on public.drafts for insert to authenticated
  with check (public.is_cellar_editor(cellar_id) and status = 'pending');
create policy "drafts: editors decide" on public.drafts for update to authenticated
  using (public.is_cellar_editor(cellar_id)) with check (public.is_cellar_editor(cellar_id));
create policy "drafts: editors delete" on public.drafts for delete to authenticated using (public.is_cellar_editor(cellar_id));

grant select, insert, update, delete on public.drafts to authenticated;

-- A runaway AI loop must not fill the table: at most 50 waiting drafts.
create function public.limit_pending_drafts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.drafts where cellar_id = new.cellar_id and status = 'pending') >= 50 then
    raise exception 'too many drafts' using errcode = 'check_violation', hint = 'too_many_drafts';
  end if;
  return new;
end;
$$;
create trigger drafts_limit before insert on public.drafts for each row execute function public.limit_pending_drafts();

alter publication supabase_realtime add table public.drafts;

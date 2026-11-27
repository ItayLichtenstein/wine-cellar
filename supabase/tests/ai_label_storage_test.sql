-- =====================================================================
-- AI tokens and label photos: may add a fetched web-*.webp photo to their
-- own cellar, never another name, never delete. Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.login_as(p_user uuid, p_client text default null) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
                    case when p_client is null then json_build_object('sub', p_user)::text
                         else json_build_object('sub', p_user, 'client_id', p_client)::text end, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('a1000000-0000-0000-0000-000000000001', 'cellar@example.com', '{"full_name":"בעלים"}');
select set_config('test.cellar', (select cellar_id::text from cellar_members where user_id = 'a1000000-0000-0000-0000-000000000001'), true);
insert into storage.objects (bucket_id, name, owner) values ('labels', current_setting('test.cellar') || '/own-photo.webp', 'a1000000-0000-0000-0000-000000000001');

select pg_temp.login_as('a1000000-0000-0000-0000-000000000001', 'ai-client');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('labels', %L) $$, current_setting('test.cellar') || '/web-11111111-2222-3333-4444-555555555555.webp'),
  'an AI client adds a fetched web photo');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('labels', %L) $$, current_setting('test.cellar') || '/anything.webp'),
  '42501', null, 'an AI client cannot add other files');
-- Storage forbids SQL deletes (the API does them), so the delete and update rules are checked as written.
select ok((select qual from pg_policies where policyname = 'labels: editors delete') like '%client_id%', 'an AI client cannot delete a photo');
select pg_temp.login_as('a1000000-0000-0000-0000-000000000001');

select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('labels', %L) $$, current_setting('test.cellar') || '/anything.webp'),
  'the user still adds any photo');
select ok((select qual from pg_policies where policyname = 'labels: editors update') like '%client_id%', 'an AI client cannot overwrite a photo');

select * from finish();
rollback;

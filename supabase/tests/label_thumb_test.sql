-- The fridge thumbnail on a wine: only a small WebP data URL is accepted,
-- and only the cellar's editors can set it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('acacacac-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"A"}'),
  ('acacacac-0000-0000-0000-000000000002', 'x@example.com', '{"full_name":"X"}');
select set_config('test.a', (select cellar_id::text from cellar_members where user_id = 'acacacac-0000-0000-0000-000000000001'), true);
insert into wines (id, cellar_id, winery, name) values ('acacacac-1111-0000-0000-000000000001', current_setting('test.a')::uuid, 'Yatir', 'Forest');

select pg_temp.login_as('acacacac-0000-0000-0000-000000000001');
select lives_ok($$ update wines set label_thumb = 'data:image/webp;base64,UklGRg==' where id = 'acacacac-1111-0000-0000-000000000001' $$, 'an editor saves a WebP thumbnail');
select throws_ok($$ update wines set label_thumb = 'https://evil.example/x.png' where id = 'acacacac-1111-0000-0000-000000000001' $$, '23514', null, 'a URL is refused');
select throws_ok($$ update wines set label_thumb = 'data:image/svg+xml;base64,PHN2Zz4=' where id = 'acacacac-1111-0000-0000-000000000001' $$, '23514', null, 'an SVG is refused');
select throws_ok($$ update wines set label_thumb = 'data:image/webp;base64,' || repeat('A', 20000) where id = 'acacacac-1111-0000-0000-000000000001' $$, '23514', null, 'a big image is refused');

select pg_temp.login_as('acacacac-0000-0000-0000-000000000002');
update wines set label_thumb = null where id = 'acacacac-1111-0000-0000-000000000001';
select pg_temp.login_as('acacacac-0000-0000-0000-000000000001');
select isnt((select label_thumb from wines where id = 'acacacac-1111-0000-0000-000000000001'), null, 'a stranger cannot change it');

select * from finish();
rollback;

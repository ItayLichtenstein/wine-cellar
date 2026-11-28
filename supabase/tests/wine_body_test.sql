-- =====================================================================
-- A wine's body (migration 48): saved by the details form, left alone by
-- an old call without it, set and undone by the AI, and imported. Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logged(p_undo jsonb) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into drafts (cellar_id, kind, payload, source) values (my_cellar_id(), 'move', '{}', 'mcp') returning id into v_id;
  update drafts set kind = 'edit', status = 'approved', decided_at = now(), applied_by_ai = true, undo = p_undo where id = v_id;
  return v_id;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('e5000000-0000-0000-0000-000000000001', 'body@example.com', '{"full_name":"ג"}');
select pg_temp.login_as('e5000000-0000-0000-0000-000000000001');
insert into wines (id, cellar_id, winery, name) values ('e5000000-1111-0000-0000-000000000001', my_cellar_id(), 'Yatir', 'Forest');
insert into wine_vintages (id, wine_id, cellar_id, year) values ('e5000000-2222-0000-0000-000000000001', 'e5000000-1111-0000-0000-000000000001', my_cellar_id(), 2019);

select is((select body from wines where id = 'e5000000-1111-0000-0000-000000000001'), null, 'no body until someone says');
select update_wine_details('e5000000-1111-0000-0000-000000000001', 'e5000000-2222-0000-0000-000000000001', 'Cabernet', null, null, 'unknown', 'standard', null, null, null, null, '[]', 'full');
select is((select body::text from wines where id = 'e5000000-1111-0000-0000-000000000001'), 'full', 'the details form saves it');
select update_wine_details('e5000000-1111-0000-0000-000000000001', 'e5000000-2222-0000-0000-000000000001', 'Cabernet', null, null, 'unknown', 'standard', null, null, null, null);
select is((select body::text from wines where id = 'e5000000-1111-0000-0000-000000000001'), 'full', 'a call without it leaves it');
select update_wine_details('e5000000-1111-0000-0000-000000000001', 'e5000000-2222-0000-0000-000000000001', 'Cabernet', null, null, 'unknown', 'standard', null, null, null, null, '[]', '');
select is((select body from wines where id = 'e5000000-1111-0000-0000-000000000001'), null, 'an empty one clears it');

select set_config('test.undo', ai_edit_wine('e5000000-2222-0000-0000-000000000001', '{}', '{"body": "medium_full"}')::text, true);
select is((select body::text from wines where id = 'e5000000-1111-0000-0000-000000000001'), 'medium_full', 'the AI sets it');
select undo_ai_change(pg_temp.logged(current_setting('test.undo')::jsonb));
select is((select body from wines where id = 'e5000000-1111-0000-0000-000000000001'), null, 'undo: back to not known');

select import_cellar('csv', repeat('b', 64), '[{"winery": "Tzora", "name": "Misty Hills", "status": "unplaced", "body": "light"}]');
select is((select body::text from wines where winery = 'Tzora' and cellar_id = my_cellar_id()), 'light', 'the import takes it');

select * from finish();
rollback;

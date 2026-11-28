-- =====================================================================
-- Migration 47: the AI removes a wish, corrects a past tasting, and sets
-- a wine's kosher, shape, alcohol and bottle notes; each one undoable,
-- and only with the user's grant. Rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create function pg_temp.request(p_claims jsonb, p_method text, p_path text) returns void language sql as $$
  select set_config('request.jwt.claims', p_claims::text, true),
         set_config('request.method', p_method, true),
         set_config('request.path', p_path, true);
$$;
create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logged(p_kind draft_kind, p_undo jsonb) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into drafts (cellar_id, kind, payload, source) values (my_cellar_id(), 'move', '{}', 'mcp') returning id into v_id;
  update drafts set kind = p_kind, status = 'approved', decided_at = now(), applied_by_ai = true, undo = p_undo where id = v_id;
  return v_id;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values ('e4000000-0000-0000-0000-000000000001', 'm47@example.com', '{"full_name":"מ"}');
select set_config('test.claims_ai', '{"sub":"e4000000-0000-0000-0000-000000000001","client_id":"claude"}', true);

-- ---------- The guard ----------
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/ai_edit_tasting');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'without a grant an AI cannot correct a tasting');
select pg_temp.login_as('e4000000-0000-0000-0000-000000000001');
insert into ai_edit_grants (client_id) values ('claude');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'POST', '/rpc/ai_remove_wishlist_item');
select lives_ok($$ select limit_oauth_clients() $$, 'with the grant it may remove a wish');
select pg_temp.request(current_setting('test.claims_ai')::jsonb, 'DELETE', '/fridges');
select throws_ok($$ select limit_oauth_clients() $$, '42501', null, 'never delete a fridge');
select pg_temp.login_as('e4000000-0000-0000-0000-000000000001');

-- ---------- Wishlist ----------
select set_config('test.wish', add_to_wishlist('Tzora', 'Misty Hills', 'red', 2020, 'from a friend')::text, true);
select set_config('test.removed', ai_remove_wishlist_item(current_setting('test.wish')::uuid)::text, true);
select is((select count(*)::int from wishlist_items where id = current_setting('test.wish')::uuid), 0, 'the wish is gone');
select undo_ai_change(pg_temp.logged('wishlist', jsonb_build_object('removed', current_setting('test.removed')::jsonb)));
select is((select note from wishlist_items where id = current_setting('test.wish')::uuid), 'from a friend', 'undo: the wish is back as it was');

-- ---------- A past tasting ----------
select set_config('test.tasting', log_tasting('Yatir', 'Forest', 'red', 2019, current_date - 7, 'Home', 'nice', 3.5)::text, true);
select set_config('test.edited', ai_edit_tasting(current_setting('test.tasting')::uuid, '{"score": 4.5, "notes": "great with lamb"}')::text, true);
select is((select notes from tastings where id = current_setting('test.tasting')::uuid), 'great with lamb', 'the notes changed');
select is((select score from ratings where cellar_id = my_cellar_id() and rater_id is null), 4.5, 'the score changed');
select is((select place from tastings where id = current_setting('test.tasting')::uuid), 'Home', 'what was not passed stays');
select throws_ok($$ select ai_edit_tasting(current_setting('test.tasting')::uuid, jsonb_build_object('tasted_on', current_date + 5)) $$, '23514', null, 'not in the future');
select undo_ai_change(pg_temp.logged('taste', jsonb_build_object('edited', current_setting('test.edited')::jsonb)));
select is((select notes from tastings where id = current_setting('test.tasting')::uuid), 'nice', 'undo: the notes are back');
select is((select score from ratings where cellar_id = my_cellar_id() and rater_id is null), 3.5, 'undo: the score is back');

-- ---------- Wine details ----------
insert into wines (id, cellar_id, winery, name) values ('e4000000-1111-0000-0000-000000000001', my_cellar_id(), 'Clos', 'Pinot');
insert into wine_vintages (id, wine_id, cellar_id, year) values ('e4000000-2222-0000-0000-000000000001', 'e4000000-1111-0000-0000-000000000001', my_cellar_id(), 2021);
insert into bottles (id, cellar_id, vintage_id, note) values ('e4000000-3333-0000-0000-000000000001', my_cellar_id(), 'e4000000-2222-0000-0000-000000000001', 'gift');
select set_config('test.undo', ai_edit_wine('e4000000-2222-0000-0000-000000000001', array['e4000000-3333-0000-0000-000000000001']::uuid[],
  '{"kosher": "yes", "shape": "burgundy", "alcohol": 13.5, "note": "for the anniversary"}')::text, true);
select is((select kosher::text || ' ' || shape::text from wines where id = 'e4000000-1111-0000-0000-000000000001'), 'yes burgundy', 'kosher and shape changed');
select is((select alcohol from wine_vintages where id = 'e4000000-2222-0000-0000-000000000001'), 13.5, 'the alcohol changed');
select is((select note from bottles where id = 'e4000000-3333-0000-0000-000000000001'), 'for the anniversary', 'the bottle note changed');
select undo_ai_change(pg_temp.logged('edit', current_setting('test.undo')::jsonb));
select is((select kosher::text || ' ' || shape::text || ' ' || coalesce(v.alcohol::text, '-') || ' ' || b.note
             from wines w join wine_vintages v on v.wine_id = w.id join bottles b on b.vintage_id = v.id
            where w.id = 'e4000000-1111-0000-0000-000000000001'), 'unknown standard - gift', 'undo: all of it is back');

select * from finish();
rollback;

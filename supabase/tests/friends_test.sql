-- =====================================================================
-- Friends (stage 4): invites, mutual links, read-only access, prices per
-- direction, and "add to my wishlist" from a friend's cellar.
-- Runs in one transaction that is rolled back.
-- =====================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

-- ---------- Setup ----------
-- Noa (member) + Dan (viewer) share a cellar. Maya has her own. Eve is a stranger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'noa@example.com',  '{"full_name":"נועה"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'dan@example.com',  '{"full_name":"דן"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'maya@example.com', '{"full_name":"מאיה"}'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'eve@example.com',  '{"full_name":"איב"}');

select set_config('test.noa',  (select cellar_id::text from cellar_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), true);
select set_config('test.maya', (select cellar_id::text from cellar_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'), true);

delete from cellars where id = (select cellar_id from cellar_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000002');
insert into cellar_members (cellar_id, user_id, role)
values (current_setting('test.noa')::uuid, 'aaaaaaaa-0000-0000-0000-000000000002', 'viewer');

-- Maya's cellar: one wine, one bottle with a price, one tasting.
insert into wines (id, cellar_id, winery, name, type, grape)
values ('bbbbbbbb-1111-0000-0000-000000000001', current_setting('test.maya')::uuid, 'Yatir', 'Forest', 'red', 'Cabernet');
insert into wine_vintages (id, wine_id, cellar_id, year)
values ('bbbbbbbb-2222-0000-0000-000000000001', 'bbbbbbbb-1111-0000-0000-000000000001', current_setting('test.maya')::uuid, 2019);
insert into bottles (id, cellar_id, vintage_id)
values ('bbbbbbbb-3333-0000-0000-000000000001', current_setting('test.maya')::uuid, 'bbbbbbbb-2222-0000-0000-000000000001');
insert into bottle_prices (bottle_id, cellar_id, paid)
values ('bbbbbbbb-3333-0000-0000-000000000001', current_setting('test.maya')::uuid, 180);
insert into tastings (cellar_id, wine_id, notes)
values (current_setting('test.maya')::uuid, 'bbbbbbbb-1111-0000-0000-000000000001', 'great');

-- ---------- Before the friendship ----------
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from bottles where cellar_id = current_setting('test.maya')::uuid), 0,
          'not friends yet: Noa sees none of Maya''s bottles');

-- ---------- Invites ----------
select pg_temp.login_as('bbbbbbbb-0000-0000-0000-000000000001');
select set_config('test.token', create_friend_invite(true), true);  -- Maya shares her prices
select is((select count(*)::int from friend_invites), 1, 'Maya created an invite');
select is((select token_hash from friend_invites) <> current_setting('test.token'), true,
          'only the hash of the token is stored');

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
select throws_ok($$ select accept_friend_invite(current_setting('test.token')) $$, '42501', null,
                 'a viewer cannot accept a friendship for the household');
select throws_ok($$ select create_friend_invite() $$, '42501', null, 'a viewer cannot invite friends');

select pg_temp.login_as('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$ select accept_friend_invite(current_setting('test.token')) $$, '23514', null,
                 'cannot befriend your own cellar');

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(peek_friend_invite(current_setting('test.token')), array['מאיה'], 'the invite shows who sent it');
select is(peek_friend_invite('nope'), null, 'an unknown token reveals nothing');
select throws_ok($$ select accept_friend_invite('nope') $$, 'P0002', null, 'an unknown token is refused');
select lives_ok($$ select accept_friend_invite(current_setting('test.token'), false) $$, 'Noa accepts (keeps her prices hidden)');
select throws_ok($$ select accept_friend_invite(current_setting('test.token')) $$, 'P0002', null, 'an invite works only once');
select is((select count(*)::int from friend_links), 2, 'the friendship is mutual: one row per direction');

-- ---------- What a friend sees ----------
select is((select count(*)::int from bottles where cellar_id = current_setting('test.maya')::uuid), 1, 'Noa sees Maya''s bottles');
select is((select count(*)::int from tastings where cellar_id = current_setting('test.maya')::uuid), 1, 'Noa sees Maya''s history');
select is((select paid from bottle_prices where bottle_id = 'bbbbbbbb-3333-0000-0000-000000000001'), 180::numeric,
          'Maya chose to share prices, so Noa sees them');
select is((select count(*)::int from profiles where display_name = 'מאיה'), 1, 'Noa sees Maya''s name');
select is((select count(*)::int from cellar_members where cellar_id = current_setting('test.maya')::uuid), 0,
          'but not Maya''s household list');
select is((select count(*)::int from friend_invites where cellar_id = current_setting('test.maya')::uuid), 0,
          'nor Maya''s invites');

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
select is((select count(*)::int from bottles where cellar_id = current_setting('test.maya')::uuid), 1,
          'the household viewer sees the friend too (friendship is between cellars)');

select pg_temp.login_as('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$ insert into wines (cellar_id, winery, name) values (current_setting('test.noa')::uuid, 'X', 'Y') $$,
                 '42501', null, 'a friend cannot write into Noa''s cellar');
select is((select count(*)::int from bottle_prices where cellar_id = current_setting('test.noa')::uuid), 0,
          'Noa kept her prices hidden from Maya');
select is((select names from my_friends()), array['נועה'], 'my_friends lists the friend by its members, not the viewer');

select pg_temp.login_as('eeeeeeee-0000-0000-0000-000000000001');
select is((select count(*)::int from bottles where cellar_id = current_setting('test.maya')::uuid), 0, 'a stranger sees nothing');
select is((select count(*)::int from friend_links), 0, 'a stranger sees no friendships');

-- ---------- Prices switch ----------
select pg_temp.login_as('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$ select set_friend_prices(current_setting('test.noa')::uuid, false) $$, 'Maya hides her prices');
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from bottle_prices where cellar_id = current_setting('test.maya')::uuid), 0,
          'Noa no longer sees Maya''s prices');
select is((select they_show_prices from my_friends()), false, 'my_friends shows Maya''s switch');
select lives_ok($$ select set_friend_prices(current_setting('test.maya')::uuid, true) $$, 'Noa can only flip her own switch');
select is((select count(*)::int from bottle_prices where cellar_id = current_setting('test.maya')::uuid), 0,
          '…which does not reveal Maya''s prices to Noa');

-- ---------- Add a friend's wine to my wishlist ----------
select lives_ok($$ select add_friend_wine_to_wishlist('bbbbbbbb-1111-0000-0000-000000000001', 2019) $$,
                'Noa adds Maya''s wine to her wishlist');
select is((select source_note from wishlist_items where cellar_id = current_setting('test.noa')::uuid), 'ראיתי אצל מאיה',
          'the source is filled in automatically');
select is((select grape from wines where cellar_id = current_setting('test.noa')::uuid and winery = 'Yatir'), 'Cabernet',
          'the wine is copied into Noa''s cellar with its details');
select pg_temp.login_as('eeeeeeee-0000-0000-0000-000000000001');
select throws_ok($$ select add_friend_wine_to_wishlist('bbbbbbbb-1111-0000-0000-000000000001') $$, 'P0002', null,
                 'a stranger cannot copy (or even detect) Maya''s wine');

-- ---------- Ending the friendship ----------
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select remove_friend(current_setting('test.maya')::uuid) $$, 'Noa ends the friendship');
select is((select count(*)::int from bottles where cellar_id = current_setting('test.maya')::uuid), 0,
          'and no longer sees Maya''s bottles (both directions removed)');

select pg_temp.logout();
select * from finish();
rollback;

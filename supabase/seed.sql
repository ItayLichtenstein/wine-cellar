-- =====================================================================
-- LOCAL DEVELOPMENT DATA ONLY.
-- `supabase db reset` loads this file into the local database.
-- It is never applied to the cloud project.
--
-- A test user, so screens can be checked without Google keys.
-- Sign in at http://localhost:3000/dev-login (works only in development).
-- A second, always-empty user: http://localhost:3000/dev-login?as=new
-- =====================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0d0d0d0-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'dev@example.com',
  extensions.crypt('local-dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"משתמש בדיקה"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0d0d0d0-0000-4000-8000-000000000001',
  'd0d0d0d0-0000-4000-8000-000000000001',
  '{"sub":"d0d0d0d0-0000-4000-8000-000000000001","email":"dev@example.com"}',
  'email', now(), now(), now()
);

-- ---------------------------------------------------------------------
-- A second test user that represents a brand-new sign-up: no name from
-- Google (gets the placeholder name), no fridge, no bottles.
-- /dev-login?as=new empties its cellar again on every sign-in, so every
-- change can be checked both on a full cellar and on an empty one.
-- ---------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0d0d0d0-0000-4000-8000-000000000002',
  'authenticated', 'authenticated',
  'new@example.com',
  extensions.crypt('local-dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0d0d0d0-0000-4000-8000-000000000002',
  'd0d0d0d0-0000-4000-8000-000000000002',
  '{"sub":"d0d0d0d0-0000-4000-8000-000000000002","email":"new@example.com"}',
  'email', now(), now(), now()
);

-- ---------------------------------------------------------------------
-- A third test user: a friend of the main test user, with a small cellar
-- of its own, so two users can be checked against each other (viewing a
-- friend's fridge, "I want this too", shared prices).
-- /dev-login?as=friend never resets it.
-- Tip: sign in as one user on localhost:3000 and as the other on
-- 127.0.0.1:3000 – each host keeps its own cookies, so both stay signed in.
-- ---------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0d0d0d0-0000-4000-8000-000000000003',
  'authenticated', 'authenticated',
  'friend@example.com',
  extensions.crypt('local-dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"חבר בדיקה"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0d0d0d0-0000-4000-8000-000000000003',
  'd0d0d0d0-0000-4000-8000-000000000003',
  '{"sub":"d0d0d0d0-0000-4000-8000-000000000003","email":"friend@example.com"}',
  'email', now(), now(), now()
);

-- Build the friend's cellar through the same functions the app uses,
-- signed in as the friend (so RLS and validation run as usual).
do $$
declare
  v_fridge uuid;
  v_back   uuid;
  v_front  uuid;
  y        int := extract(year from now())::int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"d0d0d0d0-0000-4000-8000-000000000003"}', true);

  update public.profiles set onboarded_at = now() where id = 'd0d0d0d0-0000-4000-8000-000000000003';

  v_fridge := public.create_fridge('מקרר קטן',
    '[{"zones":[{"kind":"row","capacity":4,"label":"אחורי"},{"kind":"row","capacity":4,"label":"קדמי"}]}]');
  select id into v_back  from public.shelf_zones where label = 'אחורי'
    and shelf_id in (select id from public.shelves where fridge_id = v_fridge);
  select id into v_front from public.shelf_zones where label = 'קדמי'
    and shelf_id in (select id from public.shelves where fridge_id = v_fridge);

  -- One bottle per drinking-window color.
  perform public.add_bottles('Domaine Test', 'Old Reserve', 1, 'red', y - 12,
    jsonb_build_array(jsonb_build_object('zone_id', v_back, 'slot', 1)), 'unplaced', 180, null, false, y - 6, y - 1);
  perform public.add_bottles('יקב בדיקה', 'אדום בשיא', 1, 'red', y - 6,
    jsonb_build_array(jsonb_build_object('zone_id', v_back, 'slot', 2)), 'unplaced', 120, null, false, y - 2, y);
  perform public.add_bottles('יקב בדיקה', 'לבן', 1, 'white', y - 3,
    jsonb_build_array(jsonb_build_object('zone_id', v_back, 'slot', 3)), 'unplaced', 90, null, false, y - 1, y + 1);
  perform public.add_bottles('Château Exemple', 'Grand Vin', 1, 'red', y - 4,
    jsonb_build_array(jsonb_build_object('zone_id', v_front, 'slot', 1)), 'unplaced', 350, null, false, y - 1, y + 8);
  perform public.add_bottles('יקב בדיקה', 'צעיר', 2, 'red', y - 1,
    jsonb_build_array(jsonb_build_object('zone_id', v_front, 'slot', 2), jsonb_build_object('zone_id', v_front, 'slot', 3)),
    'unplaced', 150, null, false, y + 3, y + 12);
  perform public.add_bottles('יקב בדיקה', 'רוזה', 1, 'rose', y,
    jsonb_build_array(jsonb_build_object('zone_id', v_front, 'slot', 4)), 'unplaced', 60, null, false, null, null);

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The two test users are already friends (both directions, like an
-- accepted invite). To test the invite flow itself, remove the friend
-- in the app first.
insert into public.friend_links (owner_cellar_id, friend_cellar_id)
select a.cellar_id, b.cellar_id
from public.cellar_members a, public.cellar_members b
where (a.user_id, b.user_id) in (
  ('d0d0d0d0-0000-4000-8000-000000000001'::uuid, 'd0d0d0d0-0000-4000-8000-000000000003'::uuid),
  ('d0d0d0d0-0000-4000-8000-000000000003'::uuid, 'd0d0d0d0-0000-4000-8000-000000000001'::uuid));

-- The local test user is an app admin, to check /admin (ADR 0011).
insert into public.app_admins (user_id) values ('d0d0d0d0-0000-4000-8000-000000000001');

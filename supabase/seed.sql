-- =====================================================================
-- LOCAL DEVELOPMENT DATA ONLY.
-- `supabase db reset` loads this file into the local database.
-- It is never applied to the cloud project.
--
-- A test user, so screens can be checked without Google keys.
-- Sign in at http://localhost:3000/dev-login (works only in development).
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

-- =====================================================================
-- LOAD TEST – LOCAL DATABASE ONLY. Never run against the cloud project.
--
-- Creates N fake users (loadtest-1@example.com ...), each with one fridge
-- of 100 slots, 85 wines and 100 bottles, and a ~7KB label thumbnail per
-- wine (random bytes, so it doesn't compress better than a real photo).
-- Everything goes through create_fridge/add_bottles as that user, the same
-- path the app uses.
--
--   docker exec -i supabase_db_Wine-Cellar psql -U postgres -v n=100 < scripts/load-test/seed.sql
--   ... then measure.sh, and cleanup.sql when done.
-- =====================================================================
\set ON_ERROR_STOP on
select set_config('loadtest.n', :'n', false);

do $$
declare
  n       int := current_setting('loadtest.n')::int;
  u       int;
  v_user  uuid;
  v_fridge uuid;
  zones   uuid[];
  w       int;
  qty     int;
  slot_i  int;
  places  jsonb;
  y       int := extract(year from now())::int;
  shelves jsonb := (select jsonb_agg(jsonb_build_object('zones', jsonb_build_array(
                       jsonb_build_object('kind','row','capacity',10,'label','אחורי'),
                       jsonb_build_object('kind','row','capacity',10,'label','קדמי'))))
                    from generate_series(1,5));
begin
  for u in 1..n loop
    v_user := gen_random_uuid();
    perform set_config('role', 'postgres', true);
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'loadtest-' || u || '@example.com',
      extensions.crypt('local-dev-password', extensions.gen_salt('bf', 4)), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'עומס ' || u),
      now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user, v_user,
      jsonb_build_object('sub', v_user, 'email', 'loadtest-' || u || '@example.com'), 'email', now(), now(), now());

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

    v_fridge := public.create_fridge('מקרר עומס', shelves);
    select array_agg(z.id order by s.position, z.position) into zones
      from public.shelf_zones z join public.shelves s on s.id = z.shelf_id where s.fridge_id = v_fridge;

    slot_i := 0;
    for w in 1..85 loop
      qty := case when w <= 15 then 2 else 1 end;   -- 15×2 + 70×1 = 100 bottles
      places := '[]';
      for k in 1..qty loop
        places := places || jsonb_build_array(jsonb_build_object(
          'zone_id', zones[slot_i / 10 + 1], 'slot', slot_i % 10 + 1));
        slot_i := slot_i + 1;
      end loop;
      perform public.add_bottles('Winery ' || (w % 30), 'Wine ' || w, qty,
        (array['red','white','rose','sparkling']::public.wine_type[])[w % 4 + 1], y - (w % 12),
        places, 'unplaced', 50 + w, null, false, y - (w % 12) + 2, y - (w % 12) + 2 + (w % 9));
    end loop;

    -- A random (incompressible) ~7KB thumbnail per wine, like a real WebP.
    update public.wines set label_thumb = 'data:image/webp;base64,' || replace(encode(
        extensions.gen_random_bytes(1024) || extensions.gen_random_bytes(1024) || extensions.gen_random_bytes(1024) ||
        extensions.gen_random_bytes(1024) || extensions.gen_random_bytes(1024) || extensions.gen_random_bytes(80),
        'base64'), E'\n', '')
      where cellar_id = public.my_cellar_id();
  end loop;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

analyze;
select count(*) as load_users from auth.users where email like 'loadtest-%';

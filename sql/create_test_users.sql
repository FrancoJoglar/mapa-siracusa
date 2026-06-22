DO $$
DECLARE
  id1 UUID := gen_random_uuid();
  id2 UUID := gen_random_uuid();
  id3 UUID := gen_random_uuid();
  inst UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, aud, role)
  VALUES
    (id1, inst, 'usuario1@test.com', crypt('Siracusa2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', 'authenticated', 'authenticated'),
    (id2, inst, 'usuario2@test.com', crypt('Siracusa2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', 'authenticated', 'authenticated'),
    (id3, inst, 'cm@auraoliveoil.com', crypt('Siracusa2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), id1, jsonb_build_object('sub', id1::text, 'email', 'usuario1@test.com'), 'email', id1::text, now(), now(), now()),
    (gen_random_uuid(), id2, jsonb_build_object('sub', id2::text, 'email', 'usuario2@test.com'), 'email', id2::text, now(), now(), now()),
    (gen_random_uuid(), id3, jsonb_build_object('sub', id3::text, 'email', 'cm@auraoliveoil.com'), 'email', id3::text, now(), now(), now());
END $$;

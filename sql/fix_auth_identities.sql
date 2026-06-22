UPDATE auth.identities i
SET provider_id = i.user_id::text,
    identity_data = jsonb_build_object('sub', i.user_id::text, 'email', u.email)
FROM auth.users u
WHERE i.user_id = u.id
  AND u.email != 'francojoglar@gmail.com';

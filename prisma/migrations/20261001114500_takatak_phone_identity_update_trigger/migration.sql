DROP TRIGGER IF EXISTS takatak_shared_auth_identity_update
  ON auth.users;

CREATE TRIGGER takatak_shared_auth_identity_update
AFTER UPDATE OF
  email,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_user_meta_data
ON auth.users
FOR EACH ROW
WHEN (
  OLD.email IS DISTINCT FROM NEW.email
  OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
  OR OLD.phone IS DISTINCT FROM NEW.phone
  OR OLD.phone_confirmed_at IS DISTINCT FROM NEW.phone_confirmed_at
  OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
)
EXECUTE FUNCTION public.handle_shared_auth_identity();

SELECT public.ensure_shared_identity_for_auth_user(u.id)
FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL
   OR u.phone_confirmed_at IS NOT NULL;

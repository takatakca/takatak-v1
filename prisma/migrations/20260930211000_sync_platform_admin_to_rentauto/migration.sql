-- Platform-level TAKATAK owner/admin roles administrate the Rentauto vertical.
-- This is intentionally one-way: Rentauto host/admin roles never grant access
-- to unrelated TAKATAK modules.

CREATE OR REPLACE FUNCTION public.sync_rentauto_platform_admin_role(
  p_auth_user_id uuid,
  p_platform_role "PlatformRole"
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
BEGIN
  IF p_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_platform_role IN ('owner'::"PlatformRole", 'admin'::"PlatformRole") THEN
    INSERT INTO rentauto.account_roles (auth_user_id, role)
    VALUES (p_auth_user_id, 'admin'::rentauto.app_role)
    ON CONFLICT (auth_user_id, role) DO NOTHING;
  ELSE
    DELETE FROM rentauto.account_roles
    WHERE auth_user_id = p_auth_user_id
      AND role = 'admin'::rentauto.app_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_rentauto_platform_admin_role(
  uuid, "PlatformRole"
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_rentauto_platform_admin_role(
  uuid, "PlatformRole"
) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_rentauto_platform_admin_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
BEGIN
  PERFORM public.sync_rentauto_platform_admin_role(NEW."authUserId", NEW.role);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_rentauto_platform_admin_sync()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rentauto_platform_admin_sync ON public.profiles;
CREATE TRIGGER rentauto_platform_admin_sync
AFTER INSERT OR UPDATE OF role, "authUserId"
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_rentauto_platform_admin_sync();

INSERT INTO rentauto.account_roles (auth_user_id, role)
SELECT p."authUserId", 'admin'::rentauto.app_role
FROM public.profiles p
WHERE p.role IN ('owner'::"PlatformRole", 'admin'::"PlatformRole")
ON CONFLICT (auth_user_id, role) DO NOTHING;

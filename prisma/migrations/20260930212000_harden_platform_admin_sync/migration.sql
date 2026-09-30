-- Harden platform-admin role synchronization against profile rows that
-- temporarily exist before a matching Supabase Auth user (including CI fixtures).

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

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id
  ) THEN
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

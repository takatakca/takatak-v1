-- Server-only Rentauto account bootstrap.
-- Shared Supabase Auth is authoritative; every new Rentauto user receives only
-- the least-privileged guest role until an explicit host/admin workflow grants more.

CREATE OR REPLACE FUNCTION public.bootstrap_rentauto_account(
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_identity_id uuid;
  v_legacy_user_id text;
  v_locale text;
  v_status rentauto.account_status;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_required' USING ERRCODE = '22023';
  END IF;

  v_identity_id := public.ensure_shared_identity_for_auth_user(p_auth_user_id);

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'verified_master_identity_required' USING ERRCODE = '42501';
  END IF;

  SELECT
    sp."externalUserId"
  INTO v_legacy_user_id
  FROM public.source_profiles sp
  WHERE sp."identityId" = v_identity_id
    AND sp."sourceApplication" = 'RENTAUTO'
  ORDER BY sp."lastSynchronizedAt" DESC
  LIMIT 1;

  SELECT
    CASE
      WHEN p.language IN ('fr','en','es') THEN p.language
      ELSE 'fr'
    END
  INTO v_locale
  FROM public.master_identities m
  JOIN public.profiles p
    ON p.id = m."profileId"
  WHERE m.id = v_identity_id
  LIMIT 1;

  v_status := 'active'::rentauto.account_status;

  INSERT INTO rentauto.accounts (
    auth_user_id,
    master_identity_id,
    legacy_user_id,
    status,
    preferred_locale
  )
  VALUES (
    p_auth_user_id,
    v_identity_id,
    v_legacy_user_id,
    v_status,
    COALESCE(v_locale, 'fr')
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    master_identity_id = EXCLUDED.master_identity_id,
    legacy_user_id = COALESCE(
      rentauto.accounts.legacy_user_id,
      EXCLUDED.legacy_user_id
    ),
    preferred_locale = EXCLUDED.preferred_locale,
    status = CASE
      WHEN rentauto.accounts.status IN (
        'suspended'::rentauto.account_status,
        'closed'::rentauto.account_status
      )
        THEN rentauto.accounts.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();

  INSERT INTO rentauto.account_roles (
    auth_user_id,
    role
  )
  VALUES (
    p_auth_user_id,
    'guest'::rentauto.app_role
  )
  ON CONFLICT (auth_user_id, role) DO NOTHING;

  INSERT INTO rentauto.identity_link_events (
    auth_user_id,
    master_identity_id,
    legacy_user_id,
    event_type,
    status,
    detail_code
  )
  VALUES (
    p_auth_user_id,
    v_identity_id,
    v_legacy_user_id,
    'rentauto_account_bootstrap',
    'linked',
    CASE
      WHEN v_legacy_user_id IS NULL
        THEN 'new_shared_auth_rentauto_account'
      ELSE 'legacy_rentauto_account_linked'
    END
  );

  RETURN jsonb_build_object(
    'authUserId', p_auth_user_id,
    'masterIdentityId', v_identity_id,
    'legacyUserId', v_legacy_user_id,
    'status', v_status::text,
    'role', 'guest',
    'preferredLocale', COALESCE(v_locale, 'fr')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_rentauto_account(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_rentauto_account(uuid)
  TO service_role;

-- Every shared-auth Rentauto account receives a canonical RENTAUTO source profile.
-- Existing legacy source profiles are preserved; new users use their shared auth UUID
-- as the Rentauto external user id.

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
  v_source_profile_id uuid;
  v_external_user_id text;
  v_locale text;
  v_status rentauto.account_status;
  v_profile public.profiles%ROWTYPE;
  v_identity public.master_identities%ROWTYPE;
  v_verified_fields text[] := ARRAY[]::text[];
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_required' USING ERRCODE = '22023';
  END IF;

  v_identity_id := public.ensure_shared_identity_for_auth_user(p_auth_user_id);

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'verified_master_identity_required' USING ERRCODE = '42501';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.master_identities m
  JOIN public.profiles p ON p.id = m."profileId"
  WHERE m.id = v_identity_id
  LIMIT 1;

  SELECT *
  INTO v_identity
  FROM public.master_identities
  WHERE id = v_identity_id;

  IF v_profile.id IS NULL OR v_identity.id IS NULL THEN
    RAISE EXCEPTION 'master_identity_profile_missing' USING ERRCODE = 'P0002';
  END IF;

  v_locale := CASE
    WHEN v_profile.language IN ('fr','en','es') THEN v_profile.language
    WHEN v_identity.locale IN ('fr','en','es') THEN v_identity.locale
    ELSE 'fr'
  END;

  IF v_identity."primaryEmailVerified" THEN
    v_verified_fields := array_append(v_verified_fields, 'email');
  END IF;

  IF v_identity."primaryPhoneVerified" THEN
    v_verified_fields := array_append(v_verified_fields, 'phone');
  END IF;

  SELECT sp.id, sp."externalUserId"
  INTO v_source_profile_id, v_external_user_id
  FROM public.source_profiles sp
  WHERE sp."identityId" = v_identity_id
    AND sp."sourceApplication" = 'RENTAUTO'
  ORDER BY sp."lastSynchronizedAt" DESC
  LIMIT 1;

  IF v_source_profile_id IS NULL THEN
    v_source_profile_id := gen_random_uuid();
    v_external_user_id := p_auth_user_id::text;

    INSERT INTO public.source_profiles (
      id,
      "identityId",
      "sourceApplication",
      "externalUserId",
      "collectedFields",
      "verifiedFields",
      "consentRecords",
      "accountStatus",
      "lastSynchronizedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      v_source_profile_id,
      v_identity_id,
      'RENTAUTO',
      v_external_user_id,
      jsonb_strip_nulls(
        jsonb_build_object(
          'firstName', v_profile."firstName",
          'lastName', v_profile."lastName",
          'email', v_profile.email,
          'phone', v_profile.phone,
          'locale', v_locale,
          'registeredAt', v_profile."createdAt",
          'updatedAt', now()
        )
      ),
      v_verified_fields,
      '[]'::jsonb,
      'active',
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE public.source_profiles
    SET
      "collectedFields" = jsonb_strip_nulls(
        COALESCE("collectedFields", '{}'::jsonb) ||
        jsonb_build_object(
          'firstName', v_profile."firstName",
          'lastName', v_profile."lastName",
          'email', v_profile.email,
          'phone', v_profile.phone,
          'locale', v_locale,
          'updatedAt', now()
        )
      ),
      "verifiedFields" = (
        SELECT ARRAY(
          SELECT DISTINCT x
          FROM unnest(
            COALESCE("verifiedFields", ARRAY[]::text[]) ||
            v_verified_fields
          ) AS x
          ORDER BY x
        )
      ),
      "accountStatus" = COALESCE("accountStatus", 'active'),
      "lastSynchronizedAt" = now(),
      "updatedAt" = now()
    WHERE id = v_source_profile_id;
  END IF;

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
    v_external_user_id,
    v_status,
    v_locale
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
    v_external_user_id,
    'rentauto_account_bootstrap',
    'linked',
    CASE
      WHEN v_external_user_id = p_auth_user_id::text
        THEN 'shared_auth_rentauto_source_profile'
      ELSE 'legacy_rentauto_source_profile_linked'
    END
  );

  RETURN jsonb_build_object(
    'authUserId', p_auth_user_id,
    'masterIdentityId', v_identity_id,
    'sourceProfileId', v_source_profile_id,
    'externalUserId', v_external_user_id,
    'status', v_status::text,
    'role', 'guest',
    'preferredLocale', v_locale
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_rentauto_account(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_rentauto_account(uuid)
  TO service_role;

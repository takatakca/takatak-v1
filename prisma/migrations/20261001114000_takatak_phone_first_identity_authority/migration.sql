CREATE OR REPLACE FUNCTION public.ensure_shared_identity_for_auth_user(
  p_auth_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_auth_email text;
  v_profile_email text;
  v_email_confirmed_at timestamptz;
  v_phone text;
  v_phone_confirmed_at timestamptz;
  v_created_at timestamptz;
  v_metadata jsonb;
  v_first_name text;
  v_last_name text;
  v_display_name text;
  v_profile_id uuid;
  v_conflict_profile_id uuid;
  v_conflict_profile_auth_id uuid;
  v_identity_id uuid;
  v_email_identity_id uuid;
  v_email_identity_profile_id uuid;
  v_phone_identity_id uuid;
  v_phone_identity_profile_id uuid;
  v_candidate_identity_id uuid;
  v_candidate_identity_profile_id uuid;
  v_rentauto_legacy_user_id text;
  v_account_status rentauto.account_status;
BEGIN
  SELECT
    lower(NULLIF(btrim(u.email), '')),
    u.email_confirmed_at,
    NULLIF(btrim(u.phone), ''),
    u.phone_confirmed_at,
    u.created_at,
    COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  INTO
    v_auth_email,
    v_email_confirmed_at,
    v_phone,
    v_phone_confirmed_at,
    v_created_at,
    v_metadata
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_profile_email := COALESCE(
    v_auth_email,
    lower(NULLIF(btrim(COALESCE(v_metadata->>'email', '')), ''))
  );

  IF v_profile_email IS NULL THEN
    RETURN NULL;
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(v_metadata->>'first_name', '')), '');
  v_last_name := NULLIF(btrim(COALESCE(v_metadata->>'last_name', '')), '');
  v_display_name := NULLIF(
    btrim(
      COALESCE(
        v_metadata->>'full_name',
        v_metadata->>'display_name',
        concat_ws(' ', v_first_name, v_last_name)
      )
    ),
    ''
  );

  IF v_display_name IS NULL THEN
    v_display_name := split_part(v_profile_email, '@', 1);
  END IF;

  SELECT p.id, p."authUserId"
  INTO v_conflict_profile_id, v_conflict_profile_auth_id
  FROM public.profiles p
  WHERE p."authUserId" <> p_auth_user_id
    AND (
      lower(p.email) = v_profile_email
      OR (v_phone IS NOT NULL AND p.phone = v_phone)
    )
  LIMIT 1;

  IF v_conflict_profile_id IS NOT NULL THEN
    INSERT INTO rentauto.identity_link_events (
      auth_user_id,
      event_type,
      status,
      detail_code
    )
    VALUES (
      p_auth_user_id,
      'shared_profile_link',
      'conflict',
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = v_conflict_profile_id
            AND v_phone IS NOT NULL
            AND p.phone = v_phone
        ) THEN 'profile_phone_bound_to_other_auth_user'
        ELSE 'profile_email_bound_to_other_auth_user'
      END
    );

    RETURN NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    "authUserId",
    email,
    "firstName",
    "lastName",
    "displayName",
    phone,
    status,
    "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    p_auth_user_id,
    v_profile_email,
    v_first_name,
    v_last_name,
    v_display_name,
    v_phone,
    CASE
      WHEN v_email_confirmed_at IS NOT NULL OR v_phone_confirmed_at IS NOT NULL
        THEN 'active'::"ProfileStatus"
      ELSE 'invited'::"ProfileStatus"
    END,
    now()
  )
  ON CONFLICT ("authUserId") DO UPDATE
  SET
    email = EXCLUDED.email,
    "firstName" = COALESCE(EXCLUDED."firstName", profiles."firstName"),
    "lastName" = COALESCE(EXCLUDED."lastName", profiles."lastName"),
    "displayName" = COALESCE(EXCLUDED."displayName", profiles."displayName"),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    status = CASE
      WHEN profiles.status = 'disabled'::"ProfileStatus"
        THEN profiles.status
      ELSE EXCLUDED.status
    END,
    "updatedAt" = now()
  RETURNING id INTO v_profile_id;

  IF v_email_confirmed_at IS NULL AND v_phone_confirmed_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id
  INTO v_identity_id
  FROM public.master_identities m
  WHERE m."profileId" = v_profile_id
  LIMIT 1
  FOR UPDATE;

  IF v_email_confirmed_at IS NOT NULL AND v_auth_email IS NOT NULL THEN
    SELECT m.id, m."profileId"
    INTO v_email_identity_id, v_email_identity_profile_id
    FROM public.master_identities m
    WHERE lower(m."primaryEmail") = v_auth_email
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_phone_confirmed_at IS NOT NULL AND v_phone IS NOT NULL THEN
    SELECT m.id, m."profileId"
    INTO v_phone_identity_id, v_phone_identity_profile_id
    FROM public.master_identities m
    WHERE m."primaryPhone" = v_phone
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF
    v_email_identity_id IS NOT NULL
    AND v_phone_identity_id IS NOT NULL
    AND v_email_identity_id <> v_phone_identity_id
  THEN
    INSERT INTO rentauto.identity_link_events (
      auth_user_id,
      event_type,
      status,
      detail_code
    )
    VALUES (
      p_auth_user_id,
      'shared_master_identity_link',
      'conflict',
      'verified_email_and_phone_match_different_master_identities'
    );
    RETURN NULL;
  END IF;

  IF v_identity_id IS NOT NULL THEN
    IF
      (v_email_identity_id IS NOT NULL AND v_email_identity_id <> v_identity_id)
      OR
      (v_phone_identity_id IS NOT NULL AND v_phone_identity_id <> v_identity_id)
    THEN
      INSERT INTO rentauto.identity_link_events (
        auth_user_id,
        master_identity_id,
        event_type,
        status,
        detail_code
      )
      VALUES (
        p_auth_user_id,
        v_identity_id,
        'shared_master_identity_link',
        'conflict',
        'verified_contact_matches_different_master_identity'
      );
      RETURN NULL;
    END IF;

    UPDATE public.master_identities
    SET
      "primaryEmail" = CASE
        WHEN v_email_confirmed_at IS NOT NULL THEN v_auth_email
        ELSE "primaryEmail"
      END,
      "primaryEmailVerified" = "primaryEmailVerified" OR v_email_confirmed_at IS NOT NULL,
      "primaryPhone" = CASE
        WHEN v_phone_confirmed_at IS NOT NULL THEN v_phone
        ELSE "primaryPhone"
      END,
      "primaryPhoneVerified" = "primaryPhoneVerified" OR v_phone_confirmed_at IS NOT NULL,
      "firstName" = COALESCE("firstName", v_first_name),
      "lastName" = COALESCE("lastName", v_last_name),
      "registeredAt" = COALESCE("registeredAt", v_created_at),
      "accountStatus" = COALESCE("accountStatus", 'active'),
      "updatedAt" = now()
    WHERE id = v_identity_id;
  ELSE
    v_candidate_identity_id := COALESCE(v_phone_identity_id, v_email_identity_id);
    v_candidate_identity_profile_id := CASE
      WHEN v_phone_identity_id IS NOT NULL THEN v_phone_identity_profile_id
      ELSE v_email_identity_profile_id
    END;

    IF v_candidate_identity_id IS NOT NULL THEN
      IF
        v_candidate_identity_profile_id IS NOT NULL
        AND v_candidate_identity_profile_id <> v_profile_id
      THEN
        INSERT INTO rentauto.identity_link_events (
          auth_user_id,
          master_identity_id,
          event_type,
          status,
          detail_code
        )
        VALUES (
          p_auth_user_id,
          v_candidate_identity_id,
          'shared_master_identity_link',
          'conflict',
          'master_identity_already_bound_to_other_profile'
        );
        RETURN NULL;
      END IF;

      UPDATE public.master_identities
      SET
        "profileId" = v_profile_id,
        "primaryEmail" = CASE
          WHEN v_email_confirmed_at IS NOT NULL THEN v_auth_email
          ELSE "primaryEmail"
        END,
        "primaryEmailVerified" = "primaryEmailVerified" OR v_email_confirmed_at IS NOT NULL,
        "primaryPhone" = CASE
          WHEN v_phone_confirmed_at IS NOT NULL THEN v_phone
          ELSE "primaryPhone"
        END,
        "primaryPhoneVerified" = "primaryPhoneVerified" OR v_phone_confirmed_at IS NOT NULL,
        "firstName" = COALESCE("firstName", v_first_name),
        "lastName" = COALESCE("lastName", v_last_name),
        "registeredAt" = COALESCE("registeredAt", v_created_at),
        "accountStatus" = COALESCE("accountStatus", 'active'),
        "updatedAt" = now()
      WHERE id = v_candidate_identity_id
      RETURNING id INTO v_identity_id;
    ELSE
      INSERT INTO public.master_identities (
        id,
        "profileId",
        "firstName",
        "lastName",
        "primaryEmail",
        "primaryEmailVerified",
        "primaryPhone",
        "primaryPhoneVerified",
        "accountStatus",
        "registeredAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        v_profile_id,
        v_first_name,
        v_last_name,
        CASE WHEN v_email_confirmed_at IS NOT NULL THEN v_auth_email ELSE NULL END,
        v_email_confirmed_at IS NOT NULL,
        CASE WHEN v_phone_confirmed_at IS NOT NULL THEN v_phone ELSE NULL END,
        v_phone_confirmed_at IS NOT NULL,
        'active',
        v_created_at,
        now()
      )
      RETURNING id INTO v_identity_id;
    END IF;
  END IF;

  SELECT sp."externalUserId"
  INTO v_rentauto_legacy_user_id
  FROM public.source_profiles sp
  WHERE sp."identityId" = v_identity_id
    AND sp."sourceApplication" = 'RENTAUTO'
  ORDER BY sp."lastSynchronizedAt" DESC
  LIMIT 1;

  IF v_rentauto_legacy_user_id IS NOT NULL THEN
    v_account_status := 'active'::rentauto.account_status;

    INSERT INTO rentauto.accounts (
      auth_user_id,
      master_identity_id,
      legacy_user_id,
      status
    )
    VALUES (
      p_auth_user_id,
      v_identity_id,
      v_rentauto_legacy_user_id,
      v_account_status
    )
    ON CONFLICT (auth_user_id) DO UPDATE
    SET
      master_identity_id = EXCLUDED.master_identity_id,
      legacy_user_id = COALESCE(rentauto.accounts.legacy_user_id, EXCLUDED.legacy_user_id),
      status = CASE
        WHEN rentauto.accounts.status IN (
          'suspended'::rentauto.account_status,
          'closed'::rentauto.account_status
        ) THEN rentauto.accounts.status
        ELSE EXCLUDED.status
      END,
      updated_at = now();

    INSERT INTO rentauto.account_roles (auth_user_id, role)
    VALUES (p_auth_user_id, 'guest'::rentauto.app_role)
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
      v_rentauto_legacy_user_id,
      'rentauto_account_link',
      'linked',
      CASE
        WHEN v_phone_confirmed_at IS NOT NULL
          THEN 'verified_phone_master_identity_match'
        ELSE 'verified_email_master_identity_match'
      END
    );
  END IF;

  RETURN v_identity_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_shared_identity_for_auth_user(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_shared_identity_for_auth_user(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_rentauto_account(
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_identity_id uuid;
  v_source_profile_id uuid;
  v_external_user_id text;
  v_locale text;
  v_status rentauto.account_status;
  v_profile public.profiles%ROWTYPE;
  v_identity public.master_identities%ROWTYPE;
  v_metadata jsonb := '{}'::jsonb;
  v_verified_fields text[] := ARRAY[]::text[];
  v_consent_records jsonb := '[]'::jsonb;
  v_host_intent text;
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

  SELECT COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  INTO v_metadata
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

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

  v_host_intent := NULLIF(btrim(COALESCE(v_metadata->>'host_intent', '')), '');

  IF
    NULLIF(v_metadata->>'rentauto_terms_accepted_at', '') IS NOT NULL
    OR NULLIF(v_metadata->>'rentauto_privacy_accepted_at', '') IS NOT NULL
  THEN
    v_consent_records := jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'sourceApplication', 'RENTAUTO',
          'termsAcceptedAt', NULLIF(v_metadata->>'rentauto_terms_accepted_at', ''),
          'privacyAcceptedAt', NULLIF(v_metadata->>'rentauto_privacy_accepted_at', ''),
          'capturedAt', COALESCE(
            NULLIF(v_metadata->>'rentauto_consent_captured_at', ''),
            now()::text
          )
        )
      )
    );
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
          'hostIntent', v_host_intent,
          'registeredAt', v_profile."createdAt",
          'updatedAt', now()
        )
      ),
      v_verified_fields,
      v_consent_records,
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
          'hostIntent', v_host_intent,
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
      "consentRecords" = CASE
        WHEN jsonb_array_length(COALESCE("consentRecords", '[]'::jsonb)) = 0
          THEN v_consent_records
        ELSE "consentRecords"
      END,
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
    legacy_user_id = COALESCE(rentauto.accounts.legacy_user_id, EXCLUDED.legacy_user_id),
    preferred_locale = EXCLUDED.preferred_locale,
    status = CASE
      WHEN rentauto.accounts.status IN (
        'suspended'::rentauto.account_status,
        'closed'::rentauto.account_status
      ) THEN rentauto.accounts.status
      ELSE EXCLUDED.status
    END,
    updated_at = now();

  INSERT INTO rentauto.account_roles (auth_user_id, role)
  VALUES (p_auth_user_id, 'guest'::rentauto.app_role)
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
      WHEN v_identity."primaryPhoneVerified"
        THEN 'shared_auth_verified_phone_rentauto_source_profile'
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
    'preferredLocale', v_locale,
    'emailVerified', v_identity."primaryEmailVerified",
    'phoneVerified', v_identity."primaryPhoneVerified"
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_rentauto_account(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_rentauto_account(uuid)
TO service_role;

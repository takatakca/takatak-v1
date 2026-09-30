-- Shared TAKATAK Auth -> Profile -> MasterIdentity bridge.
-- This makes the shared Supabase Auth project usable by every TAKATAK vertical,
-- including Rentauto, without trusting user_metadata for authorization.

CREATE OR REPLACE FUNCTION public.ensure_shared_identity_for_auth_user(
  p_auth_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_email text;
  v_email_confirmed_at timestamptz;
  v_created_at timestamptz;
  v_metadata jsonb;
  v_first_name text;
  v_last_name text;
  v_display_name text;
  v_profile_id uuid;
  v_existing_profile_auth_id uuid;
  v_identity_id uuid;
  v_email_identity_id uuid;
  v_email_identity_profile_id uuid;
  v_rentauto_legacy_user_id text;
  v_account_status rentauto.account_status;
BEGIN
  SELECT
    lower(u.email),
    u.email_confirmed_at,
    u.created_at,
    COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  INTO
    v_email,
    v_email_confirmed_at,
    v_created_at,
    v_metadata
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(v_metadata->>'first_name', '')), '');
  v_last_name := NULLIF(btrim(COALESCE(v_metadata->>'last_name', '')), '');
  v_display_name := NULLIF(
    btrim(
      COALESCE(
        v_metadata->>'full_name',
        concat_ws(' ', v_first_name, v_last_name)
      )
    ),
    ''
  );

  IF v_display_name IS NULL THEN
    v_display_name := split_part(v_email, '@', 1);
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      "authUserId",
      email,
      "firstName",
      "lastName",
      "displayName",
      status,
      "updatedAt"
    )
    VALUES (
      p_auth_user_id,
      v_email,
      v_first_name,
      v_last_name,
      v_display_name,
      CASE
        WHEN v_email_confirmed_at IS NULL
          THEN 'invited'::"ProfileStatus"
        ELSE 'active'::"ProfileStatus"
      END,
      now()
    )
    ON CONFLICT ("authUserId") DO UPDATE
    SET
      email = EXCLUDED.email,
      "firstName" = COALESCE(EXCLUDED."firstName", profiles."firstName"),
      "lastName" = COALESCE(EXCLUDED."lastName", profiles."lastName"),
      "displayName" = COALESCE(EXCLUDED."displayName", profiles."displayName"),
      status = CASE
        WHEN profiles.status = 'disabled'::"ProfileStatus"
          THEN profiles.status
        ELSE EXCLUDED.status
      END,
      "updatedAt" = now()
    RETURNING id INTO v_profile_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id, "authUserId"
      INTO v_profile_id, v_existing_profile_auth_id
      FROM public.profiles
      WHERE email = v_email
      LIMIT 1;

      IF
        v_profile_id IS NULL
        OR v_existing_profile_auth_id IS DISTINCT FROM p_auth_user_id
      THEN
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
          'profile_email_bound_to_other_auth_user'
        );

        RETURN NULL;
      END IF;
  END;

  IF v_email_confirmed_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id
  INTO v_identity_id
  FROM public.master_identities m
  WHERE m."profileId" = v_profile_id
  LIMIT 1
  FOR UPDATE;

  SELECT m.id, m."profileId"
  INTO v_email_identity_id, v_email_identity_profile_id
  FROM public.master_identities m
  WHERE lower(m."primaryEmail") = v_email
  LIMIT 1
  FOR UPDATE;

  IF v_identity_id IS NOT NULL THEN
    IF
      v_email_identity_id IS NOT NULL
      AND v_email_identity_id <> v_identity_id
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
        'verified_email_matches_different_master_identity'
      );

      RETURN v_identity_id;
    END IF;

    UPDATE public.master_identities
    SET
      "primaryEmail" = v_email,
      "primaryEmailVerified" = true,
      "firstName" = COALESCE("firstName", v_first_name),
      "lastName" = COALESCE("lastName", v_last_name),
      "registeredAt" = COALESCE("registeredAt", v_created_at),
      "accountStatus" = COALESCE("accountStatus", 'active'),
      "updatedAt" = now()
    WHERE id = v_identity_id;
  ELSIF v_email_identity_id IS NOT NULL THEN
    IF
      v_email_identity_profile_id IS NOT NULL
      AND v_email_identity_profile_id <> v_profile_id
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
        v_email_identity_id,
        'shared_master_identity_link',
        'conflict',
        'master_identity_already_bound_to_other_profile'
      );

      RETURN NULL;
    END IF;

    UPDATE public.master_identities
    SET
      "profileId" = v_profile_id,
      "primaryEmailVerified" = true,
      "firstName" = COALESCE("firstName", v_first_name),
      "lastName" = COALESCE("lastName", v_last_name),
      "registeredAt" = COALESCE("registeredAt", v_created_at),
      "accountStatus" = COALESCE("accountStatus", 'active'),
      "updatedAt" = now()
    WHERE id = v_email_identity_id
    RETURNING id INTO v_identity_id;
  ELSE
    INSERT INTO public.master_identities (
      "profileId",
      "firstName",
      "lastName",
      "primaryEmail",
      "primaryEmailVerified",
      "accountStatus",
      "registeredAt",
      "updatedAt"
    )
    VALUES (
      v_profile_id,
      v_first_name,
      v_last_name,
      v_email,
      true,
      'active',
      v_created_at,
      now()
    )
    RETURNING id INTO v_identity_id;
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
      legacy_user_id = COALESCE(
        rentauto.accounts.legacy_user_id,
        EXCLUDED.legacy_user_id
      ),
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
      v_rentauto_legacy_user_id,
      'rentauto_account_link',
      'linked',
      'verified_email_master_identity_match'
    );
  END IF;

  RETURN v_identity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_shared_identity_for_auth_user(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_shared_identity_for_auth_user(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.handle_shared_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
BEGIN
  PERFORM public.ensure_shared_identity_for_auth_user(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_shared_auth_identity()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS takatak_shared_auth_identity_insert
  ON auth.users;

CREATE TRIGGER takatak_shared_auth_identity_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_shared_auth_identity();

DROP TRIGGER IF EXISTS takatak_shared_auth_identity_update
  ON auth.users;

CREATE TRIGGER takatak_shared_auth_identity_update
AFTER UPDATE OF email, email_confirmed_at, raw_user_meta_data
ON auth.users
FOR EACH ROW
WHEN (
  OLD.email IS DISTINCT FROM NEW.email
  OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at
  OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
)
EXECUTE FUNCTION public.handle_shared_auth_identity();

CREATE OR REPLACE FUNCTION public.handle_rentauto_source_profile_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  IF NEW."sourceApplication" <> 'RENTAUTO' THEN
    RETURN NEW;
  END IF;

  SELECT p."authUserId"
  INTO v_auth_user_id
  FROM public.master_identities m
  JOIN public.profiles p
    ON p.id = m."profileId"
  WHERE m.id = NEW."identityId"
  LIMIT 1;

  IF v_auth_user_id IS NOT NULL THEN
    PERFORM public.ensure_shared_identity_for_auth_user(v_auth_user_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_rentauto_source_profile_link()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rentauto_source_profile_identity_link
  ON public.source_profiles;

CREATE TRIGGER rentauto_source_profile_identity_link
AFTER INSERT OR UPDATE OF "identityId", "externalUserId", "sourceApplication"
ON public.source_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_rentauto_source_profile_link();

-- Safe backfill for existing shared auth users. The helper is idempotent and
-- only attaches verified emails; conflicts are recorded instead of reassigned.
SELECT public.ensure_shared_identity_for_auth_user(u.id)
FROM auth.users u
WHERE u.email IS NOT NULL;

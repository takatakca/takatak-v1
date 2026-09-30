-- Rentauto client compatibility surface for the shared TAKATAK backend.
-- Keeps one shared identity while preserving the existing Rentauto frontend model.

ALTER TABLE rentauto.accounts
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text;

CREATE TABLE IF NOT EXISTS rentauto.provinces (
  code text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_supported boolean NOT NULL DEFAULT true
);

INSERT INTO rentauto.provinces (code, name, sort_order, is_supported)
VALUES
  ('AB','Alberta',1,true),
  ('BC','British Columbia',2,true),
  ('MB','Manitoba',3,true),
  ('NB','New Brunswick',4,true),
  ('NL','Newfoundland and Labrador',5,true),
  ('NS','Nova Scotia',6,true),
  ('NT','Northwest Territories',7,true),
  ('NU','Nunavut',8,true),
  ('ON','Ontario',9,true),
  ('PE','Prince Edward Island',10,true),
  ('QC','Quebec',11,true),
  ('SK','Saskatchewan',12,true),
  ('YT','Yukon',13,true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_supported = EXCLUDED.is_supported;

ALTER TABLE rentauto.provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_provinces_read
  ON rentauto.provinces;
CREATE POLICY rentauto_provinces_read
ON rentauto.provinces
FOR SELECT
TO anon, authenticated
USING (is_supported);

GRANT SELECT ON rentauto.provinces TO anon, authenticated;
GRANT ALL ON rentauto.provinces TO service_role;

DROP VIEW IF EXISTS rentauto.user_roles CASCADE;
CREATE VIEW rentauto.user_roles
WITH (security_invoker = false)
AS
SELECT
  ar.id,
  ar.auth_user_id AS user_id,
  ar.role,
  ar.created_at
FROM rentauto.account_roles ar
WHERE
  ar.auth_user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role);

REVOKE ALL ON rentauto.user_roles FROM PUBLIC, anon;
GRANT SELECT ON rentauto.user_roles TO authenticated, service_role;

DROP VIEW IF EXISTS rentauto.profiles CASCADE;
CREATE VIEW rentauto.profiles
WITH (security_invoker = false)
AS
SELECT
  p."authUserId" AS id,
  p."firstName" AS first_name,
  p."lastName" AS last_name,
  p.phone,
  a.avatar_url,
  COALESCE(m."primaryPhoneVerified", false) AS phone_verified,
  (a.driver_verification_status = 'approved') AS id_verified,
  a.province,
  a.city,
  a.postal_code,
  p."displayName" AS display_name,
  a.bio,
  a.is_all_star,
  a.rating_avg,
  a.trips_count,
  p."createdAt" AT TIME ZONE 'UTC' AS created_at,
  a.updated_at
FROM public.profiles p
JOIN rentauto.accounts a
  ON a.auth_user_id = p."authUserId"
LEFT JOIN public.master_identities m
  ON m."profileId" = p.id
WHERE
  p."authUserId" = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role);

REVOKE ALL ON rentauto.profiles FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON rentauto.profiles TO authenticated;
GRANT SELECT ON rentauto.profiles TO service_role;

CREATE OR REPLACE FUNCTION rentauto.update_profile_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := OLD.id;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF v_user_id <> auth.uid()
     AND NOT rentauto.has_role('admin'::rentauto.app_role) THEN
    RAISE EXCEPTION 'profile_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
     OR NEW.id_verified IS DISTINCT FROM OLD.id_verified
     OR NEW.is_all_star IS DISTINCT FROM OLD.is_all_star
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.trips_count IS DISTINCT FROM OLD.trips_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'protected_profile_field' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    "firstName" = NEW.first_name,
    "lastName" = NEW.last_name,
    phone = NEW.phone,
    "displayName" = NEW.display_name,
    "updatedAt" = now()
  WHERE "authUserId" = v_user_id;

  UPDATE rentauto.accounts
  SET
    avatar_url = NEW.avatar_url,
    bio = NEW.bio,
    province = NEW.province,
    city = NEW.city,
    postal_code = NEW.postal_code,
    updated_at = now()
  WHERE auth_user_id = v_user_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.update_profile_compat()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rentauto_profiles_update_compat
  ON rentauto.profiles;
CREATE TRIGGER rentauto_profiles_update_compat
INSTEAD OF UPDATE ON rentauto.profiles
FOR EACH ROW
EXECUTE FUNCTION rentauto.update_profile_compat();

DROP VIEW IF EXISTS rentauto.profiles_public CASCADE;
CREATE VIEW rentauto.profiles_public
WITH (security_invoker = false)
AS
SELECT
  p."authUserId" AS id,
  p."displayName" AS display_name,
  p."firstName" AS first_name,
  a.avatar_url,
  a.bio,
  a.is_all_star,
  a.rating_avg,
  a.trips_count,
  p."createdAt" AT TIME ZONE 'UTC' AS created_at
FROM public.profiles p
JOIN rentauto.accounts a
  ON a.auth_user_id = p."authUserId"
WHERE a.status = 'active'::rentauto.account_status;

REVOKE ALL ON rentauto.profiles_public FROM PUBLIC;
GRANT SELECT ON rentauto.profiles_public TO anon, authenticated, service_role;

-- Expose only public + GraphQL + Rentauto through PostgREST.
-- This explicit role setting is intentional and should be kept in source control.
ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public,graphql_public,rentauto';

NOTIFY pgrst, 'reload config';

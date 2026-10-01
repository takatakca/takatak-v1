-- Driver-license verification authority for guest booking eligibility.
CREATE TABLE rentauto.driver_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  license_front_url text,
  license_back_url text,
  selfie_url text,
  license_country text NOT NULL DEFAULT 'CA',
  license_region text,
  license_expires_on date,
  status text NOT NULL DEFAULT 'not_started',
  reviewer_notes text,
  reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_verifications_status_check
    CHECK (status IN ('not_started','pending','approved','rejected')),
  CONSTRAINT driver_verifications_country_check
    CHECK (license_country ~ '^[A-Z]{2}$'),
  CONSTRAINT driver_verifications_notes_length
    CHECK (reviewer_notes IS NULL OR char_length(reviewer_notes) <= 2000)
);

CREATE INDEX driver_verifications_status_submitted_idx
  ON rentauto.driver_verifications (status, submitted_at)
  WHERE status = 'pending';

ALTER TABLE rentauto.driver_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE rentauto.driver_verifications FROM PUBLIC, anon;
GRANT SELECT ON TABLE rentauto.driver_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rentauto.driver_verifications TO service_role;

CREATE POLICY rentauto_driver_verifications_read
ON rentauto.driver_verifications
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

CREATE OR REPLACE FUNCTION rentauto.validate_driver_verification_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'approved' THEN
    IF NEW.license_front_url IS NULL
       OR NEW.license_back_url IS NULL
       OR NEW.selfie_url IS NULL
       OR NEW.license_expires_on IS NULL
       OR NEW.license_expires_on < current_date THEN
      RAISE EXCEPTION 'driver_verification_cannot_approve' USING ERRCODE = '23514';
    END IF;

    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;

  IF NEW.status = 'pending' THEN
    IF NEW.license_front_url IS NULL
       OR NEW.license_back_url IS NULL
       OR NEW.selfie_url IS NULL
       OR NEW.license_expires_on IS NULL THEN
      RAISE EXCEPTION 'driver_verification_documents_incomplete' USING ERRCODE = '23514';
    END IF;

    IF NEW.license_expires_on < current_date THEN
      RAISE EXCEPTION 'driver_license_expired' USING ERRCODE = '23514';
    END IF;

    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
    NEW.reviewed_at := NULL;
    NEW.reviewer_user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.validate_driver_verification_row()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_driver_verification_row
BEFORE INSERT OR UPDATE ON rentauto.driver_verifications
FOR EACH ROW
EXECUTE FUNCTION rentauto.validate_driver_verification_row();

CREATE OR REPLACE FUNCTION rentauto.sync_driver_verification_account_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  UPDATE rentauto.accounts
  SET
    driver_verification_status = NEW.status,
    updated_at = now()
  WHERE auth_user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.sync_driver_verification_account_status()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_driver_verification_account_status
AFTER INSERT OR UPDATE OF status ON rentauto.driver_verifications
FOR EACH ROW
EXECUTE FUNCTION rentauto.sync_driver_verification_account_status();

CREATE OR REPLACE FUNCTION rentauto.enforce_trip_driver_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('draft','pending_payment') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.driver_verifications v
    WHERE v.user_id = NEW.guest_id
      AND v.status = 'approved'
      AND v.license_expires_on IS NOT NULL
      AND v.license_expires_on >= current_date
  ) THEN
    RAISE EXCEPTION 'driver_verification_required' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_trip_driver_verification()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_trip_driver_verification
BEFORE INSERT OR UPDATE OF status, guest_id ON rentauto.trips
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_trip_driver_verification();

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'rentauto-driver-documents',
  'rentauto-driver-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS rentauto_driver_docs_owner_select ON storage.objects;
CREATE POLICY rentauto_driver_docs_owner_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rentauto-driver-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_driver_docs_owner_insert ON storage.objects;
CREATE POLICY rentauto_driver_docs_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-driver-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (storage.foldername(name))[2] IN ('license_front','license_back','selfie')
);

DROP POLICY IF EXISTS rentauto_driver_docs_owner_update ON storage.objects;
CREATE POLICY rentauto_driver_docs_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'rentauto-driver-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
)
WITH CHECK (
  bucket_id = 'rentauto-driver-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_driver_docs_owner_delete ON storage.objects;
CREATE POLICY rentauto_driver_docs_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rentauto-driver-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);
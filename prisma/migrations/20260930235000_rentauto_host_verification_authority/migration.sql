-- Keep Rentauto identity verification documents scoped to their owner and
-- keep approval/rejection under trusted administrative authority.
CREATE OR REPLACE FUNCTION rentauto.enforce_host_verification_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_docs_changed boolean;
  v_all_docs boolean;
  v_prefix text;
BEGIN
  v_is_admin := COALESCE(rentauto.has_role('admin'::rentauto.app_role), false)
    OR COALESCE(auth.role() = 'service_role', false);

  v_prefix := NEW.user_id::text || '/';

  IF NEW.id_front_url IS NOT NULL AND NEW.id_front_url NOT LIKE v_prefix || '%' THEN
    RAISE EXCEPTION 'verification_document_owner_mismatch' USING ERRCODE = '42501';
  END IF;
  IF NEW.id_back_url IS NOT NULL AND NEW.id_back_url NOT LIKE v_prefix || '%' THEN
    RAISE EXCEPTION 'verification_document_owner_mismatch' USING ERRCODE = '42501';
  END IF;
  IF NEW.selfie_url IS NOT NULL AND NEW.selfie_url NOT LIKE v_prefix || '%' THEN
    RAISE EXCEPTION 'verification_document_owner_mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'verification_owner_required' USING ERRCODE = '42501';
  END IF;

  v_all_docs :=
    NULLIF(BTRIM(COALESCE(NEW.id_front_url, '')), '') IS NOT NULL
    AND NULLIF(BTRIM(COALESCE(NEW.id_back_url, '')), '') IS NOT NULL
    AND NULLIF(BTRIM(COALESCE(NEW.selfie_url, '')), '') IS NOT NULL;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := CASE WHEN v_all_docs THEN 'pending' ELSE 'not_started' END;
    NEW.reviewed_at := NULL;
    NEW.reviewer_notes := NULL;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'verification_owner_immutable' USING ERRCODE = '42501';
  END IF;

  v_docs_changed :=
    NEW.id_front_url IS DISTINCT FROM OLD.id_front_url
    OR NEW.id_back_url IS DISTINCT FROM OLD.id_back_url
    OR NEW.selfie_url IS DISTINCT FROM OLD.selfie_url;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status NOT IN ('not_started', 'pending') THEN
    RAISE EXCEPTION 'verification_decision_admin_only' USING ERRCODE = '42501';
  END IF;

  IF v_docs_changed THEN
    NEW.verification_status := CASE WHEN v_all_docs THEN 'pending' ELSE 'not_started' END;
    NEW.reviewed_at := NULL;
    NEW.reviewer_notes := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_host_verification_authority()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentauto_host_verification_authority
  ON rentauto.host_verifications;
CREATE TRIGGER trg_rentauto_host_verification_authority
BEFORE INSERT OR UPDATE OF user_id, id_front_url, id_back_url, selfie_url,
  verification_status, reviewed_at, reviewer_notes
ON rentauto.host_verifications
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_host_verification_authority();

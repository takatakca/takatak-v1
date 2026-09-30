-- Prevent hosts from publishing vehicles before required host and vehicle readiness checks.
CREATE OR REPLACE FUNCTION rentauto.enforce_car_activation_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active'
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'active') THEN
    RETURN NEW;
  END IF;

  v_is_admin := rentauto.has_role('admin'::rentauto.app_role);

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NOT rentauto.has_role('host'::rentauto.app_role) THEN
    RAISE EXCEPTION 'host_role_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rentauto.host_applications a
    WHERE a.user_id = NEW.host_id AND a.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'host_application_not_approved' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rentauto.host_verifications v
    WHERE v.user_id = NEW.host_id AND v.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'host_identity_not_verified' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rentauto.stripe_accounts s
    WHERE s.user_id = NEW.host_id
      AND s.charges_enabled = true
      AND s.payouts_enabled = true
  ) THEN
    RAISE EXCEPTION 'host_payouts_not_ready' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(NEW.title), '') IS NULL
     OR nullif(btrim(NEW.make), '') IS NULL
     OR nullif(btrim(NEW.model), '') IS NULL
     OR NEW.year < 1980
     OR NEW.base_daily_price_cents <= 0
     OR nullif(btrim(COALESCE(NEW.location_label, '')), '') IS NULL THEN
    RAISE EXCEPTION 'vehicle_core_details_incomplete' USING ERRCODE = '23514';
  END IF;

  IF nullif(btrim(COALESCE(NEW.vin, '')), '') IS NULL
     OR nullif(btrim(COALESCE(NEW.plate_number, '')), '') IS NULL
     OR nullif(btrim(COALESCE(NEW.registration_url, '')), '') IS NULL
     OR nullif(btrim(COALESCE(NEW.insurance_url, '')), '') IS NULL
     OR NEW.insurance_status <> 'verified' THEN
    RAISE EXCEPTION 'vehicle_documents_not_verified' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rentauto.car_photos p WHERE p.car_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'vehicle_photo_required' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rentauto.car_policies p WHERE p.car_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'vehicle_cancellation_policy_required' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_car_activation_readiness() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_car_activation_readiness ON rentauto.cars;
CREATE TRIGGER trg_enforce_car_activation_readiness
BEFORE INSERT OR UPDATE OF status ON rentauto.cars
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_car_activation_readiness();

-- Keep vehicle document verification under admin authority.
CREATE OR REPLACE FUNCTION rentauto.enforce_car_document_verification_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_documents_changed boolean;
BEGIN
  v_is_admin := rentauto.has_role('admin'::rentauto.app_role);

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF nullif(btrim(COALESCE(NEW.registration_url, '')), '') IS NOT NULL
       AND nullif(btrim(COALESCE(NEW.insurance_url, '')), '') IS NOT NULL THEN
      NEW.insurance_status := 'pending';
    ELSE
      NEW.insurance_status := 'not_provided';
    END IF;
    RETURN NEW;
  END IF;

  v_documents_changed :=
    NEW.registration_url IS DISTINCT FROM OLD.registration_url
    OR NEW.insurance_url IS DISTINCT FROM OLD.insurance_url
    OR NEW.vin IS DISTINCT FROM OLD.vin
    OR NEW.plate_number IS DISTINCT FROM OLD.plate_number;

  IF NEW.insurance_status IS DISTINCT FROM OLD.insurance_status
     AND NOT v_documents_changed THEN
    RAISE EXCEPTION 'vehicle_verification_admin_only' USING ERRCODE = '42501';
  END IF;

  IF v_documents_changed THEN
    IF nullif(btrim(COALESCE(NEW.registration_url, '')), '') IS NOT NULL
       AND nullif(btrim(COALESCE(NEW.insurance_url, '')), '') IS NOT NULL THEN
      NEW.insurance_status := 'pending';
    ELSE
      NEW.insurance_status := 'not_provided';
    END IF;

    IF OLD.status = 'active' THEN
      NEW.status := 'paused';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.enforce_car_document_verification_authority() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_car_document_verification_authority ON rentauto.cars;
CREATE TRIGGER trg_enforce_car_document_verification_authority
BEFORE INSERT OR UPDATE OF insurance_status, registration_url, insurance_url, vin, plate_number
ON rentauto.cars
FOR EACH ROW
EXECUTE FUNCTION rentauto.enforce_car_document_verification_authority();

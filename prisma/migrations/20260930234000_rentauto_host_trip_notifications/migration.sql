-- Notify Rentauto hosts about material trip lifecycle changes.
CREATE OR REPLACE FUNCTION rentauto.notify_host_on_trip_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
DECLARE
  v_host_id uuid;
  v_car_title text;
  v_type text;
  v_title text;
  v_body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT c.host_id, c.title
  INTO v_host_id, v_car_title
  FROM rentauto.cars c
  WHERE c.id = NEW.car_id;

  IF v_host_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' AND NEW.payment_status = 'paid' THEN
    v_type := 'host_booking_confirmed';
    v_title := 'New confirmed booking';
    v_body := 'A guest completed payment for ' || COALESCE(NULLIF(v_car_title,''), 'your vehicle') || '.';
  ELSIF NEW.status = 'active' THEN
    v_type := 'host_trip_started';
    v_title := 'Trip started';
    v_body := 'The guest completed check-in for ' || COALESCE(NULLIF(v_car_title,''), 'your vehicle') || '.';
  ELSIF NEW.status = 'completed' THEN
    v_type := 'host_trip_completed';
    v_title := 'Trip completed';
    v_body := 'The guest completed the return workflow for ' || COALESCE(NULLIF(v_car_title,''), 'your vehicle') || '.';
  ELSIF NEW.status = 'cancelled'
        AND OLD.status IN ('confirmed','check_in_pending','active','check_out_pending') THEN
    v_type := 'host_trip_cancelled';
    v_title := 'Booking cancelled';
    v_body := 'A confirmed Rentauto booking was cancelled.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO rentauto.notifications (
    user_id, type, title, body, link, payload
  )
  VALUES (
    v_host_id,
    v_type,
    v_title,
    v_body,
    '/host',
    jsonb_build_object(
      'tripId', NEW.id,
      'bookingReference', NEW.booking_reference,
      'carId', NEW.car_id,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION rentauto.notify_host_on_trip_status_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rentauto_notify_host_trip_status
  ON rentauto.trips;
CREATE TRIGGER trg_rentauto_notify_host_trip_status
AFTER UPDATE OF status ON rentauto.trips
FOR EACH ROW
EXECUTE FUNCTION rentauto.notify_host_on_trip_status_change();

-- Rentauto shared-backend end-to-end database smoke test.
-- Runs inside a transaction and always rolls back synthetic identities/data.
BEGIN;

DO $$
DECLARE
  v_guest uuid := gen_random_uuid();
  v_host uuid := gen_random_uuid();
  v_car uuid;
  v_protection uuid;
  v_quote jsonb;
  v_draft jsonb;
  v_trip uuid;
  v_total integer;
  v_second_blocked boolean := false;
  v_active jsonb;
  v_completed jsonb;
  v_location jsonb;
  v_booking_ref text;
BEGIN
  INSERT INTO auth.users (
    id, email, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at, aud, role
  )
  VALUES
    (
      v_guest,
      'rentauto-smoke-guest-' || v_guest::text || '@example.test',
      now(),
      jsonb_build_object('first_name','Smoke','last_name','Guest'),
      '{"provider":"email","providers":["email"]}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    ),
    (
      v_host,
      'rentauto-smoke-host-' || v_host::text || '@example.test',
      now(),
      jsonb_build_object('first_name','Smoke','last_name','Host'),
      '{"provider":"email","providers":["email"]}'::jsonb,
      now(), now(), 'authenticated', 'authenticated'
    );

  PERFORM public.bootstrap_rentauto_account(v_guest);
  PERFORM public.bootstrap_rentauto_account(v_host);

  INSERT INTO rentauto.account_roles(auth_user_id, role)
  VALUES (v_host, 'host'::rentauto.app_role)
  ON CONFLICT DO NOTHING;

  -- The smoke test isolates booking/trip lifecycle. Use the trusted service-role
  -- claim only for synthetic fixture creation so publication readiness does not
  -- obscure the lifecycle assertions below.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  INSERT INTO rentauto.cars (
    host_id, status, title, make, model, year,
    base_daily_price_cents, currency, included_km_per_day,
    extra_km_price_cents, location_label, tracking_consent_required
  )
  VALUES (
    v_host, 'active', 'Smoke Test Vehicle', 'Test', 'Model', 2026,
    10000, 'CAD', 200, 25, 'Montréal, QC', true
  )
  RETURNING id INTO v_car;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT id INTO v_protection
  FROM rentauto.protection_plans
  WHERE tier = 'silver' AND is_active = true
  LIMIT 1;

  IF v_protection IS NULL THEN
    RAISE EXCEPTION 'rentauto_smoke_missing_silver_plan';
  END IF;

  v_quote := public.rentauto_quote_trip(
    v_car,
    now() + interval '2 days',
    now() + interval '5 days',
    ARRAY[]::uuid[],
    v_protection
  );

  IF (v_quote->>'total_after_tax')::integer <= 0 THEN
    RAISE EXCEPTION 'rentauto_smoke_quote_total_invalid';
  END IF;

  v_draft := public.rentauto_create_booking_draft(
    v_guest,
    v_car,
    now() + interval '2 days',
    now() + interval '5 days',
    ARRAY[]::uuid[],
    v_protection,
    'Montréal, QC',
    'Montréal, QC'
  );

  v_trip := (v_draft->>'tripId')::uuid;
  v_total := (v_draft->'quote'->>'total_after_tax')::integer;
  v_booking_ref := v_draft->>'bookingReference';

  IF v_trip IS NULL OR v_booking_ref NOT LIKE 'RA-%' THEN
    RAISE EXCEPTION 'rentauto_smoke_draft_invalid';
  END IF;

  BEGIN
    PERFORM public.rentauto_create_booking_draft(
      v_guest,
      v_car,
      now() + interval '3 days',
      now() + interval '4 days',
      ARRAY[]::uuid[],
      v_protection,
      'Montréal, QC',
      'Montréal, QC'
    );
  EXCEPTION
    WHEN exclusion_violation THEN
      v_second_blocked := true;
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%dates_temporarily_held%'
         OR SQLERRM LIKE '%dates_not_available%' THEN
        v_second_blocked := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF NOT v_second_blocked THEN
    RAISE EXCEPTION 'rentauto_smoke_overlap_hold_not_enforced';
  END IF;

  PERFORM public.rentauto_prepare_checkout(
    v_trip,
    v_guest,
    now() + interval '30 minutes'
  );

  PERFORM public.rentauto_record_checkout_session(
    v_trip,
    v_guest,
    'cs_smoke_' || replace(v_trip::text, '-', '')
  );

  PERFORM public.rentauto_finalize_paid_booking(
    v_trip,
    'cs_smoke_' || replace(v_trip::text, '-', ''),
    'pi_smoke_' || replace(v_trip::text, '-', ''),
    v_total,
    'CAD',
    'evt_smoke_' || replace(v_trip::text, '-', ''),
    now()
  );

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.trips
    WHERE id = v_trip
      AND status = 'confirmed'
      AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_payment_not_confirmed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.availability_blocks
    WHERE trip_id = v_trip
      AND type = 'booking_self'
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_availability_not_converted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.notifications
    WHERE user_id = v_host
      AND type = 'host_booking_confirmed'
      AND payload->>'tripId' = v_trip::text
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_host_booking_notification_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.source_payment_summaries
    WHERE "sourceApplication" = 'RENTAUTO'
      AND "bookingNumber" = v_booking_ref
      AND status = 'PAID'
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_takatak_payment_projection_missing';
  END IF;

  v_active := public.rentauto_transition_trip(
    v_guest,
    v_trip,
    'complete_check_in',
    jsonb_build_object(
      'pickup_confirmed', true,
      'odometer_km', 10000,
      'fuel_level', 'full',
      'exterior_photos', jsonb_build_array(v_trip::text || '/check-in/front.jpg'),
      'interior_photos', jsonb_build_array(v_trip::text || '/check-in/cabin.jpg'),
      'consent_accepted_at', now()
    )
  );

  IF v_active->>'status' <> 'active' THEN
    RAISE EXCEPTION 'rentauto_smoke_checkin_failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.notifications
    WHERE user_id = v_host
      AND type = 'host_trip_started'
      AND payload->>'tripId' = v_trip::text
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_host_trip_started_notification_missing';
  END IF;

  INSERT INTO rentauto.vehicle_tracking_devices (
    car_id, provider, device_identifier, status
  )
  VALUES (
    v_car,
    'smoke-provider',
    'smoke-device-' || replace(v_car::text,'-',''),
    'active'
  );

  v_location := public.rentauto_ingest_location(
    'smoke-provider',
    'smoke-device-' || replace(v_car::text,'-',''),
    45.5017,
    -73.5673,
    42,
    180,
    8,
    now()
  );

  IF COALESCE((v_location->>'recorded')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'rentauto_smoke_tracking_not_recorded';
  END IF;

  v_completed := public.rentauto_transition_trip(
    v_guest,
    v_trip,
    'complete_check_out',
    jsonb_build_object(
      'return_confirmed', true,
      'odometer_km', 10450,
      'fuel_level', '3/4',
      'exterior_photos', jsonb_build_array(v_trip::text || '/check-out/front.jpg'),
      'interior_photos', jsonb_build_array(v_trip::text || '/check-out/cabin.jpg')
    )
  );

  IF v_completed->>'status' <> 'completed' THEN
    RAISE EXCEPTION 'rentauto_smoke_checkout_failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.notifications
    WHERE user_id = v_host
      AND type = 'host_trip_completed'
      AND payload->>'tripId' = v_trip::text
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_host_trip_completed_notification_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rentauto.trip_tracking_sessions
    WHERE trip_id = v_trip
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'rentauto_smoke_tracking_session_not_closed';
  END IF;
END
$$;

ROLLBACK;

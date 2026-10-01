-- Host approval workflow for non-instant Rentauto listings.
-- Instant-book vehicles keep the existing draft -> checkout path.
-- Request-only vehicles use requested -> approved -> pending_payment.

CREATE OR REPLACE FUNCTION rentauto.enforce_trip_driver_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rentauto, public, auth, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('draft','requested','approved','pending_payment') THEN
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

CREATE OR REPLACE FUNCTION public.rentauto_create_booking_draft(
  p_user_id uuid,
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_selected_extras uuid[] DEFAULT ARRAY[]::uuid[],
  p_protection_plan_id uuid DEFAULT NULL::uuid,
  p_pickup_location text DEFAULT NULL::text,
  p_return_location text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $$
DECLARE
  v_account rentauto.accounts%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_quote jsonb;
  v_trip rentauto.trips%ROWTYPE;
  v_hold_expires_at timestamptz := now() + interval '10 minutes';
  v_request_expires_at timestamptz := now() + interval '24 hours';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'auth_user_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.bootstrap_rentauto_account(p_user_id);

  SELECT *
  INTO v_account
  FROM rentauto.accounts
  WHERE auth_user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_account.status <> 'active'::rentauto.account_status THEN
    RAISE EXCEPTION 'rentauto_account_not_active' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.driver_verifications v
    WHERE v.user_id = p_user_id
      AND v.status = 'approved'
      AND v.license_expires_on IS NOT NULL
      AND v.license_expires_on >= current_date
  ) THEN
    RAISE EXCEPTION 'driver_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_car
  FROM rentauto.cars
  WHERE id = p_car_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = 'P0002';
  END IF;

  IF v_car.host_id = p_user_id THEN
    RAISE EXCEPTION 'host_cannot_book_own_vehicle' USING ERRCODE = '42501';
  END IF;

  UPDATE rentauto.booking_holds
  SET status = 'expired',
      updated_at = now()
  WHERE car_id = p_car_id
    AND status = 'active'
    AND expires_at <= now();

  v_quote := rentauto.compute_trip_quote(
    p_car_id,
    p_start_at,
    p_end_at,
    COALESCE(p_selected_extras, ARRAY[]::uuid[]),
    p_protection_plan_id,
    NULL
  );

  INSERT INTO rentauto.trips (
    car_id,
    guest_id,
    start_at,
    end_at,
    pickup_location,
    return_location,
    status,
    pricing_breakdown,
    total_cents,
    currency,
    payment_status
  )
  VALUES (
    p_car_id,
    p_user_id,
    p_start_at,
    p_end_at,
    COALESCE(NULLIF(btrim(p_pickup_location), ''), v_car.location_label),
    COALESCE(NULLIF(btrim(p_return_location), ''), v_car.location_label),
    CASE WHEN v_car.instant_book THEN 'draft' ELSE 'requested' END,
    v_quote,
    (v_quote->>'total_after_tax')::integer,
    COALESCE(NULLIF(v_quote->>'currency', ''), 'CAD'),
    'unpaid'
  )
  RETURNING * INTO v_trip;

  IF v_car.instant_book THEN
    INSERT INTO rentauto.booking_holds (
      trip_id,
      car_id,
      guest_id,
      start_at,
      end_at,
      expires_at,
      status
    )
    VALUES (
      v_trip.id,
      p_car_id,
      p_user_id,
      p_start_at,
      p_end_at,
      v_hold_expires_at,
      'active'
    );

    INSERT INTO rentauto.trip_events (
      trip_id,
      actor_user_id,
      event_type,
      payload_json
    )
    VALUES (
      v_trip.id,
      p_user_id,
      'booking_hold_created',
      jsonb_build_object(
        'expires_at', v_hold_expires_at,
        'start_at', p_start_at,
        'end_at', p_end_at,
        'booking_mode', 'instant'
      )
    );

    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'bookingMode', 'instant',
      'nextAction', 'checkout',
      'holdExpiresAt', v_hold_expires_at,
      'quote', v_quote
    );
  END IF;

  INSERT INTO rentauto.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    v_trip.id,
    p_user_id,
    'booking_requested',
    jsonb_build_object(
      'request_expires_at', v_request_expires_at,
      'start_at', p_start_at,
      'end_at', p_end_at,
      'booking_mode', 'request'
    )
  );

  INSERT INTO rentauto.notifications (
    user_id,
    type,
    title,
    body,
    link,
    payload
  )
  VALUES (
    v_car.host_id,
    'booking_request',
    'New booking request',
    'A verified driver requested ' ||
      concat_ws(' ', v_car.year::text, v_car.make, v_car.model) ||
      '. Review the request within 24 hours.',
    '/host?request=' || v_trip.id::text,
    jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'requestExpiresAt', v_request_expires_at
    )
  );

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'bookingMode', 'request',
    'nextAction', 'await_host',
    'requestExpiresAt', v_request_expires_at,
    'holdExpiresAt', NULL,
    'quote', v_quote
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_create_booking_draft(
  uuid,uuid,timestamptz,timestamptz,uuid[],uuid,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_create_booking_draft(
  uuid,uuid,timestamptz,timestamptz,uuid[],uuid,text,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_review_booking_request(
  p_host_user_id uuid,
  p_trip_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_quote jsonb;
  v_selected_extras uuid[] := ARRAY[]::uuid[];
  v_protection_plan_id uuid := NULL;
  v_hold_expires_at timestamptz := now() + interval '60 minutes';
BEGIN
  IF p_host_user_id IS NULL OR p_trip_id IS NULL THEN
    RAISE EXCEPTION 'invalid_booking_request_review' USING ERRCODE = '22023';
  END IF;

  IF p_decision NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'invalid_booking_request_decision' USING ERRCODE = '22023';
  END IF;

  SELECT t.*
  INTO v_trip
  FROM rentauto.trips t
  WHERE t.id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_request_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.*
  INTO v_car
  FROM rentauto.cars c
  WHERE c.id = v_trip.car_id
  FOR UPDATE;

  IF NOT FOUND OR v_car.host_id <> p_host_user_id THEN
    RAISE EXCEPTION 'booking_request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_car.instant_book THEN
    RAISE EXCEPTION 'instant_booking_does_not_require_review' USING ERRCODE = '22023';
  END IF;

  IF v_trip.status <> 'requested' THEN
    RAISE EXCEPTION 'booking_request_not_pending' USING ERRCODE = '22023';
  END IF;

  IF v_trip.created_at + interval '24 hours' <= now() THEN
    UPDATE rentauto.trips
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_trip.id;

    INSERT INTO rentauto.trip_events (
      trip_id, actor_user_id, event_type, payload_json
    )
    VALUES (
      v_trip.id, p_host_user_id, 'booking_request_expired',
      jsonb_build_object('expired_at', now())
    );

    INSERT INTO rentauto.notifications (
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_trip.guest_id,
      'booking_request_expired',
      'Booking request expired',
      'The host did not approve your booking request within the request window.',
      '/trips/' || v_trip.id::text,
      jsonb_build_object('tripId', v_trip.id)
    );

    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'status', 'cancelled',
      'decision', 'expired'
    );
  END IF;

  IF p_decision = 'declined' THEN
    UPDATE rentauto.trips
    SET status = 'declined',
        updated_at = now()
    WHERE id = v_trip.id
    RETURNING * INTO v_trip;

    INSERT INTO rentauto.trip_events (
      trip_id, actor_user_id, event_type, payload_json
    )
    VALUES (
      v_trip.id, p_host_user_id, 'booking_request_declined',
      jsonb_build_object('declined_at', now())
    );

    INSERT INTO rentauto.notifications (
      user_id, type, title, body, link, payload
    )
    VALUES (
      v_trip.guest_id,
      'booking_request_declined',
      'Booking request declined',
      'The host could not accept this booking request. You can choose another vehicle or dates.',
      '/trips/' || v_trip.id::text,
      jsonb_build_object('tripId', v_trip.id)
    );

    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'status', v_trip.status,
      'decision', 'declined'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.driver_verifications v
    WHERE v.user_id = v_trip.guest_id
      AND v.status = 'approved'
      AND v.license_expires_on IS NOT NULL
      AND v.license_expires_on >= current_date
  ) THEN
    RAISE EXCEPTION 'driver_verification_required' USING ERRCODE = '42501';
  END IF;

  UPDATE rentauto.booking_holds
  SET status = 'expired',
      updated_at = now()
  WHERE car_id = v_car.id
    AND status = 'active'
    AND expires_at <= now();

  BEGIN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
    INTO v_selected_extras
    FROM jsonb_array_elements_text(
      COALESCE(v_trip.pricing_breakdown->'selected_extra_ids', '[]'::jsonb)
    ) AS value;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_stored_pricing_snapshot' USING ERRCODE = '22023';
  END;

  IF NULLIF(v_trip.pricing_breakdown->>'protection_plan_id', '') IS NOT NULL THEN
    BEGIN
      v_protection_plan_id :=
        (v_trip.pricing_breakdown->>'protection_plan_id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_stored_pricing_snapshot' USING ERRCODE = '22023';
    END;
  END IF;

  v_quote := rentauto.compute_trip_quote(
    v_trip.car_id,
    v_trip.start_at,
    v_trip.end_at,
    v_selected_extras,
    v_protection_plan_id,
    NULL
  );

  INSERT INTO rentauto.booking_holds (
    trip_id,
    car_id,
    guest_id,
    start_at,
    end_at,
    expires_at,
    status
  )
  VALUES (
    v_trip.id,
    v_trip.car_id,
    v_trip.guest_id,
    v_trip.start_at,
    v_trip.end_at,
    v_hold_expires_at,
    'active'
  );

  UPDATE rentauto.trips
  SET
    status = 'approved',
    pricing_breakdown = v_quote,
    total_cents = (v_quote->>'total_after_tax')::integer,
    currency = upper(COALESCE(NULLIF(v_quote->>'currency',''), 'CAD')),
    updated_at = now()
  WHERE id = v_trip.id
  RETURNING * INTO v_trip;

  INSERT INTO rentauto.trip_events (
    trip_id, actor_user_id, event_type, payload_json
  )
  VALUES (
    v_trip.id,
    p_host_user_id,
    'booking_request_approved',
    jsonb_build_object(
      'approved_at', now(),
      'hold_expires_at', v_hold_expires_at
    )
  );

  INSERT INTO rentauto.notifications (
    user_id, type, title, body, link, payload
  )
  VALUES (
    v_trip.guest_id,
    'booking_request_approved',
    'Booking request approved',
    'Your host approved the trip. Complete payment within 60 minutes to secure the vehicle.',
    '/checkout/' || v_trip.id::text,
    jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'holdExpiresAt', v_hold_expires_at
    )
  );

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'status', v_trip.status,
    'decision', 'approved',
    'holdExpiresAt', v_hold_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_review_booking_request(uuid,uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_review_booking_request(uuid,uuid,text)
TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_prepare_checkout(
  p_trip_id uuid,
  p_user_id uuid,
  p_hold_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'auth', 'pg_temp'
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_hold rentauto.booking_holds%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_quote jsonb;
  v_selected_extras uuid[] := ARRAY[]::uuid[];
  v_protection_plan_id uuid := NULL;
  v_photo_url text := NULL;
BEGIN
  IF p_user_id IS NULL OR p_trip_id IS NULL THEN
    RAISE EXCEPTION 'invalid_checkout_request' USING ERRCODE = '22023';
  END IF;

  IF p_hold_expires_at <= now()
     OR p_hold_expires_at > now() + interval '40 minutes' THEN
    RAISE EXCEPTION 'invalid_hold_expiry' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND OR v_trip.guest_id <> p_user_id THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.status NOT IN ('draft','approved','pending_payment') THEN
    RAISE EXCEPTION 'trip_not_payable' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.driver_verifications v
    WHERE v.user_id = p_user_id
      AND v.status = 'approved'
      AND v.license_expires_on IS NOT NULL
      AND v.license_expires_on >= current_date
  ) THEN
    RAISE EXCEPTION 'driver_verification_required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_hold
  FROM rentauto.booking_holds
  WHERE trip_id = p_trip_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR v_hold.expires_at <= now() THEN
    RAISE EXCEPTION 'booking_hold_expired' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_car
  FROM rentauto.cars
  WHERE id = v_trip.car_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
    INTO v_selected_extras
    FROM jsonb_array_elements_text(
      COALESCE(v_trip.pricing_breakdown->'selected_extra_ids', '[]'::jsonb)
    ) AS value;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_stored_pricing_snapshot' USING ERRCODE = '22023';
  END;

  IF NULLIF(v_trip.pricing_breakdown->>'protection_plan_id', '') IS NOT NULL THEN
    BEGIN
      v_protection_plan_id :=
        (v_trip.pricing_breakdown->>'protection_plan_id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_stored_pricing_snapshot' USING ERRCODE = '22023';
    END;
  END IF;

  v_quote := rentauto.compute_trip_quote(
    v_trip.car_id,
    v_trip.start_at,
    v_trip.end_at,
    v_selected_extras,
    v_protection_plan_id,
    v_trip.id
  );

  UPDATE rentauto.trips
  SET
    total_cents = (v_quote->>'total_after_tax')::integer,
    currency = upper(COALESCE(NULLIF(v_quote->>'currency',''), 'CAD')),
    pricing_breakdown = v_quote,
    updated_at = now()
  WHERE id = v_trip.id
  RETURNING * INTO v_trip;

  UPDATE rentauto.booking_holds
  SET
    expires_at = p_hold_expires_at,
    updated_at = now()
  WHERE id = v_hold.id
  RETURNING * INTO v_hold;

  SELECT cp.url
  INTO v_photo_url
  FROM rentauto.car_photos cp
  WHERE cp.car_id = v_car.id
  ORDER BY cp.sort_order, cp.created_at, cp.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'guestId', v_trip.guest_id,
    'carId', v_car.id,
    'vehicleName', concat_ws(' ', v_car.year::text, v_car.make, v_car.model),
    'photoUrl', v_photo_url,
    'startAt', v_trip.start_at,
    'endAt', v_trip.end_at,
    'totalCents', v_trip.total_cents,
    'currency', v_trip.currency,
    'stripeSessionId', v_trip.stripe_session_id,
    'holdId', v_hold.id,
    'holdExpiresAt', v_hold.expires_at,
    'quote', v_quote
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_prepare_checkout(uuid,uuid,timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_prepare_checkout(uuid,uuid,timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_record_checkout_session(
  p_trip_id uuid,
  p_user_id uuid,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'rentauto', 'pg_temp'
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR btrim(p_session_id) = '' OR char_length(p_session_id) > 255 THEN
    RAISE EXCEPTION 'invalid_stripe_session_id' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND OR v_trip.guest_id <> p_user_id THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.status NOT IN ('draft','approved','pending_payment') THEN
    RAISE EXCEPTION 'trip_not_payable' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.driver_verifications v
    WHERE v.user_id = p_user_id
      AND v.status = 'approved'
      AND v.license_expires_on IS NOT NULL
      AND v.license_expires_on >= current_date
  ) THEN
    RAISE EXCEPTION 'driver_verification_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rentauto.booking_holds h
    WHERE h.trip_id = p_trip_id
      AND h.status = 'active'
      AND h.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'booking_hold_expired' USING ERRCODE = 'P0002';
  END IF;

  UPDATE rentauto.trips
  SET
    stripe_session_id = p_session_id,
    status = 'pending_payment',
    payment_status = 'pending',
    updated_at = now()
  WHERE id = p_trip_id
  RETURNING * INTO v_trip;

  INSERT INTO rentauto.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    p_trip_id,
    p_user_id,
    'checkout_session_created',
    jsonb_build_object('status', 'pending_payment')
  );

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'status', v_trip.status,
    'paymentStatus', v_trip.payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_record_checkout_session(uuid,uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_record_checkout_session(uuid,uuid,text)
TO service_role;

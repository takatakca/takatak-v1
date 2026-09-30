-- Rentauto Stripe checkout authority on the shared TAKATAK backend.
-- All functions are service-role only and are intended to be called by verified
-- Edge Functions, never directly by browser roles.

CREATE OR REPLACE FUNCTION public.rentauto_prepare_checkout(
  p_trip_id uuid,
  p_user_id uuid,
  p_hold_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
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

  IF v_trip.status NOT IN ('draft','pending_payment') THEN
    RAISE EXCEPTION 'trip_not_payable' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.rentauto_prepare_checkout(
  uuid, uuid, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_prepare_checkout(
  uuid, uuid, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_record_checkout_session(
  p_trip_id uuid,
  p_user_id uuid,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
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

  IF v_trip.status NOT IN ('draft','pending_payment') THEN
    RAISE EXCEPTION 'trip_not_payable' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.rentauto_record_checkout_session(
  uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_record_checkout_session(
  uuid, uuid, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_claim_stripe_event(
  p_event_id text,
  p_event_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
DECLARE
  v_row rentauto.stripe_webhook_events%ROWTYPE;
BEGIN
  IF p_event_id IS NULL OR btrim(p_event_id) = '' OR char_length(p_event_id) > 255 THEN
    RAISE EXCEPTION 'stripe_event_id_required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_row
  FROM rentauto.stripe_webhook_events
  WHERE stripe_event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rentauto.stripe_webhook_events (
      stripe_event_id,
      event_type,
      status,
      attempt_count,
      processing_started_at
    )
    VALUES (
      p_event_id,
      left(COALESCE(p_event_type, 'unknown'), 200),
      'processing',
      1,
      now()
    );

    RETURN jsonb_build_object(
      'shouldProcess', true,
      'status', 'processing'
    );
  END IF;

  IF v_row.status = 'processed' THEN
    RETURN jsonb_build_object(
      'shouldProcess', false,
      'status', 'processed'
    );
  END IF;

  IF
    v_row.status = 'processing'
    AND v_row.processing_started_at IS NOT NULL
    AND v_row.processing_started_at > now() - interval '10 minutes'
  THEN
    RETURN jsonb_build_object(
      'shouldProcess', false,
      'status', 'processing'
    );
  END IF;

  UPDATE rentauto.stripe_webhook_events
  SET
    status = 'processing',
    event_type = left(COALESCE(p_event_type, event_type), 200),
    attempt_count = attempt_count + 1,
    processing_started_at = now(),
    last_error = NULL
  WHERE stripe_event_id = p_event_id;

  RETURN jsonb_build_object(
    'shouldProcess', true,
    'status', 'processing'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_claim_stripe_event(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_claim_stripe_event(text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_mark_stripe_event_processed(
  p_event_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
  UPDATE rentauto.stripe_webhook_events
  SET
    status = 'processed',
    processed_at = now(),
    last_error = NULL
  WHERE stripe_event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.rentauto_mark_stripe_event_processed(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_mark_stripe_event_processed(text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_mark_stripe_event_failed(
  p_event_id text,
  p_error text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
  UPDATE rentauto.stripe_webhook_events
  SET
    status = 'failed',
    last_error = left(COALESCE(p_error, 'unknown_error'), 1000)
  WHERE stripe_event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.rentauto_mark_stripe_event_failed(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_mark_stripe_event_failed(text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_finalize_paid_booking(
  p_trip_id uuid,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text,
  p_event_id text,
  p_event_created_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_hold rentauto.booking_holds%ROWTYPE;
  v_account rentauto.accounts%ROWTYPE;
  v_source_profile_id uuid;
  v_payment_summary_id uuid;
  v_sync_event_id text;
BEGIN
  IF p_amount_total IS NULL OR p_amount_total < 0 THEN
    RAISE EXCEPTION 'invalid_payment_amount' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_trip.payment_status = 'paid' AND v_trip.status = 'confirmed' THEN
    IF v_trip.stripe_session_id IS DISTINCT FROM p_stripe_session_id THEN
      RAISE EXCEPTION 'stripe_session_mismatch' USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference,
      'status', v_trip.status,
      'paymentStatus', v_trip.payment_status,
      'duplicate', true
    );
  END IF;

  IF v_trip.status NOT IN ('draft','pending_payment') THEN
    RAISE EXCEPTION 'invalid_trip_status_for_payment' USING ERRCODE = '22023';
  END IF;

  IF v_trip.stripe_session_id IS DISTINCT FROM p_stripe_session_id THEN
    RAISE EXCEPTION 'stripe_session_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_trip.total_cents IS NULL OR v_trip.total_cents <> p_amount_total THEN
    RAISE EXCEPTION 'payment_amount_mismatch' USING ERRCODE = '22023';
  END IF;

  IF upper(v_trip.currency) <> upper(COALESCE(p_currency, '')) THEN
    RAISE EXCEPTION 'payment_currency_mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_hold
  FROM rentauto.booking_holds
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND OR v_hold.status <> 'active' THEN
    RAISE EXCEPTION 'booking_hold_not_active' USING ERRCODE = 'P0002';
  END IF;

  IF p_event_created_at IS NULL OR p_event_created_at > v_hold.expires_at THEN
    RAISE EXCEPTION 'payment_completed_after_hold_expiry' USING ERRCODE = '22023';
  END IF;

  INSERT INTO rentauto.availability_blocks (
    car_id,
    trip_id,
    start_at,
    end_at,
    type
  )
  VALUES (
    v_trip.car_id,
    v_trip.id,
    v_trip.start_at,
    v_trip.end_at,
    'booking_self'
  )
  ON CONFLICT (trip_id)
    WHERE type = 'booking_self' AND trip_id IS NOT NULL
  DO NOTHING;

  UPDATE rentauto.booking_holds
  SET
    status = 'converted',
    updated_at = now()
  WHERE id = v_hold.id;

  UPDATE rentauto.trips
  SET
    status = 'confirmed',
    payment_status = 'paid',
    stripe_payment_intent_id = p_payment_intent_id,
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
    NULL,
    'payment_confirmed',
    jsonb_build_object(
      'from', 'pending_payment',
      'to', 'confirmed',
      'amount_total', p_amount_total,
      'currency', upper(p_currency)
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
    v_trip.guest_id,
    'booking_confirmed',
    'Booking confirmed',
    'Your Rentauto booking is confirmed.',
    '/trips/' || v_trip.id::text,
    jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference
    )
  );

  SELECT *
  INTO v_account
  FROM rentauto.accounts
  WHERE auth_user_id = v_trip.guest_id;

  IF v_account.master_identity_id IS NOT NULL THEN
    SELECT sp.id
    INTO v_source_profile_id
    FROM public.source_profiles sp
    WHERE sp."identityId" = v_account.master_identity_id
      AND sp."sourceApplication" = 'RENTAUTO'
    ORDER BY sp."lastSynchronizedAt" DESC
    LIMIT 1;

    IF v_source_profile_id IS NOT NULL THEN
      SELECT s.id
      INTO v_payment_summary_id
      FROM public.source_payment_summaries s
      WHERE s."sourceApplication" = 'RENTAUTO'
        AND s."bookingNumber" = v_trip.booking_reference
      LIMIT 1
      FOR UPDATE;

      IF v_payment_summary_id IS NULL THEN
        v_payment_summary_id := gen_random_uuid();

        INSERT INTO public.source_payment_summaries (
          id,
          "identityId",
          "sourceProfileId",
          "sourceApplication",
          "bookingNumber",
          status,
          "amountMinor",
          "refundedAmountMinor",
          currency,
          "transactionDate",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          v_payment_summary_id,
          v_account.master_identity_id,
          v_source_profile_id,
          'RENTAUTO',
          v_trip.booking_reference,
          'PAID',
          p_amount_total,
          NULL,
          upper(p_currency),
          COALESCE(p_event_created_at, now()),
          now(),
          now()
        );
      ELSE
        UPDATE public.source_payment_summaries
        SET
          status = 'PAID',
          "amountMinor" = p_amount_total,
          currency = upper(p_currency),
          "transactionDate" = COALESCE(p_event_created_at, now()),
          "updatedAt" = now()
        WHERE id = v_payment_summary_id;
      END IF;

      v_sync_event_id := 'rentauto-stripe-' || left(COALESCE(p_event_id, gen_random_uuid()::text), 220);

      INSERT INTO public.source_synchronization_events (
        id,
        "eventId",
        "eventType",
        "sourceApplication",
        "sourceProfileId",
        "identityId",
        "payloadHash",
        "responsePayload",
        status,
        "processedAt",
        "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        v_sync_event_id,
        'PAYMENT_SUMMARY_UPDATED',
        'RENTAUTO',
        v_source_profile_id,
        v_account.master_identity_id,
        md5(v_trip.booking_reference || ':' || p_amount_total::text || ':' || upper(p_currency)),
        jsonb_build_object(
          'bookingNumber', v_trip.booking_reference,
          'status', 'PAID',
          'amountMinor', p_amount_total,
          'currency', upper(p_currency)
        ),
        'PROCESSED',
        now(),
        now()
      )
      ON CONFLICT ("eventId") DO NOTHING;

      UPDATE public.source_profiles
      SET
        "lastSynchronizedAt" = now(),
        "updatedAt" = now()
      WHERE id = v_source_profile_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'status', v_trip.status,
    'paymentStatus', v_trip.payment_status,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_finalize_paid_booking(
  uuid, text, text, integer, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_finalize_paid_booking(
  uuid, text, text, integer, text, text, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_fail_checkout_session(
  p_trip_id uuid,
  p_stripe_session_id text,
  p_event_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
BEGIN
  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'trip_not_found');
  END IF;

  IF v_trip.stripe_session_id IS DISTINCT FROM p_stripe_session_id THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'session_mismatch');
  END IF;

  IF v_trip.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'status_changed');
  END IF;

  UPDATE rentauto.trips
  SET
    status = 'cancelled',
    payment_status = 'failed',
    updated_at = now()
  WHERE id = p_trip_id
  RETURNING * INTO v_trip;

  UPDATE rentauto.booking_holds
  SET
    status = 'released',
    updated_at = now()
  WHERE trip_id = p_trip_id
    AND status = 'active';

  INSERT INTO rentauto.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    p_trip_id,
    NULL,
    'checkout_failed',
    jsonb_build_object('provider_event_type', left(COALESCE(p_event_type,'unknown'), 100))
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
    v_trip.guest_id,
    'payment_issue',
    'Payment not completed',
    'Your Rentauto payment was not completed. You can review the trip for next steps.',
    '/trips/' || v_trip.id::text,
    jsonb_build_object(
      'tripId', v_trip.id,
      'bookingReference', v_trip.booking_reference
    )
  );

  RETURN jsonb_build_object(
    'updated', true,
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'status', v_trip.status,
    'paymentStatus', v_trip.payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_fail_checkout_session(
  uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_fail_checkout_session(
  uuid, text, text
) TO service_role;

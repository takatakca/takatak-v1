-- Route Rentauto quote/booking mutations through Edge Functions.
-- Database SECURITY DEFINER RPCs become service-role only so browser roles
-- cannot execute privileged booking functions directly.

REVOKE ALL ON FUNCTION public.rentauto_quote_trip(
  uuid, timestamptz, timestamptz, uuid[], uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_quote_trip(
  uuid, timestamptz, timestamptz, uuid[], uuid
) TO service_role;

DROP FUNCTION IF EXISTS public.rentauto_create_booking_draft(
  uuid, timestamptz, timestamptz, uuid[], uuid, text, text
);

CREATE OR REPLACE FUNCTION public.rentauto_create_booking_draft(
  p_user_id uuid,
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_selected_extras uuid[] DEFAULT ARRAY[]::uuid[],
  p_protection_plan_id uuid DEFAULT NULL,
  p_pickup_location text DEFAULT NULL,
  p_return_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_account rentauto.accounts%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_quote jsonb;
  v_trip rentauto.trips%ROWTYPE;
  v_hold_expires_at timestamptz := now() + interval '10 minutes';
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
    'draft',
    v_quote,
    (v_quote->>'total_after_tax')::integer,
    COALESCE(NULLIF(v_quote->>'currency', ''), 'CAD'),
    'unpaid'
  )
  RETURNING * INTO v_trip;

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
      'end_at', p_end_at
    )
  );

  RETURN jsonb_build_object(
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'holdExpiresAt', v_hold_expires_at,
    'quote', v_quote
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_create_booking_draft(
  uuid, uuid, timestamptz, timestamptz, uuid[], uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_create_booking_draft(
  uuid, uuid, timestamptz, timestamptz, uuid[], uuid, text, text
) TO service_role;

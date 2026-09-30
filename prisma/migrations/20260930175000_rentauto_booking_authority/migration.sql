-- Authoritative Rentauto booking/quote functions on the shared TAKATAK backend.
-- The rentauto schema stays isolated; public RPCs expose only narrowly scoped operations.

CREATE TABLE IF NOT EXISTS rentauto.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_trip_events_trip_idx
  ON rentauto.trip_events(trip_id, created_at DESC);

ALTER TABLE rentauto.trip_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_trip_events_participants_read
  ON rentauto.trip_events;
CREATE POLICY rentauto_trip_events_participants_read
ON rentauto.trip_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (
        t.guest_id = auth.uid()
        OR c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

GRANT SELECT ON rentauto.trip_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.trip_events FROM anon, authenticated;
GRANT ALL ON rentauto.trip_events TO service_role;

CREATE OR REPLACE FUNCTION rentauto.compute_trip_quote(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_selected_extras uuid[] DEFAULT ARRAY[]::uuid[],
  p_protection_plan_id uuid DEFAULT NULL,
  p_ignore_hold_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = rentauto, public, pg_temp
AS $$
DECLARE
  v_car rentauto.cars%ROWTYPE;
  v_days integer;
  v_base_price integer;
  v_discount_percent integer := 0;
  v_discounts integer := 0;
  v_extras_total integer := 0;
  v_protection_total integer := 0;
  v_subtotal integer;
  v_gst integer;
  v_qst integer;
  v_taxes integer;
  v_total integer;
  v_selected_extra_ids uuid[] := ARRAY[]::uuid[];
  v_extras_breakdown jsonb := '[]'::jsonb;
  v_protection_snapshot jsonb := NULL;
  v_cancellation_snapshot jsonb := NULL;
  v_extra record;
  v_plan rentauto.protection_plans%ROWTYPE;
  v_requested_extra_count integer := 0;
  v_found_extra_count integer := 0;
BEGIN
  IF p_car_id IS NULL OR p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'invalid_trip_dates' USING ERRCODE = '22023';
  END IF;

  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'invalid_trip_dates' USING ERRCODE = '22023';
  END IF;

  IF p_end_at > p_start_at + interval '365 days' THEN
    RAISE EXCEPTION 'trip_duration_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_car
  FROM rentauto.cars
  WHERE id = p_car_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_available' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rentauto.availability_blocks b
    WHERE b.car_id = p_car_id
      AND b.start_at < p_end_at
      AND b.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'dates_not_available' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rentauto.booking_holds h
    WHERE h.car_id = p_car_id
      AND h.status = 'active'
      AND h.expires_at > now()
      AND h.start_at < p_end_at
      AND h.end_at > p_start_at
      AND (
        p_ignore_hold_trip_id IS NULL
        OR h.trip_id <> p_ignore_hold_trip_id
      )
  ) THEN
    RAISE EXCEPTION 'dates_temporarily_held' USING ERRCODE = '23P01';
  END IF;

  v_days := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 86400.0)::integer
  );

  v_base_price := v_car.base_daily_price_cents * v_days;

  IF v_days >= 7 THEN
    v_discount_percent := 10;
  ELSIF v_days >= 3 THEN
    v_discount_percent := 5;
  END IF;

  v_discounts := ROUND(v_base_price * v_discount_percent / 100.0)::integer;

  SELECT COUNT(DISTINCT x)
  INTO v_requested_extra_count
  FROM unnest(COALESCE(p_selected_extras, ARRAY[]::uuid[])) AS x;

  FOR v_extra IN
    SELECT
      e.id,
      e.name,
      e.price_cents,
      e.pricing_type
    FROM rentauto.car_extras e
    WHERE e.car_id = p_car_id
      AND e.is_active = true
      AND e.id = ANY(COALESCE(p_selected_extras, ARRAY[]::uuid[]))
    ORDER BY e.name, e.id
  LOOP
    v_found_extra_count := v_found_extra_count + 1;
    v_selected_extra_ids := array_append(v_selected_extra_ids, v_extra.id);

    IF v_extra.pricing_type = 'per_day' THEN
      v_extras_total := v_extras_total + (v_extra.price_cents * v_days);
      v_extras_breakdown := v_extras_breakdown || jsonb_build_array(
        jsonb_build_object(
          'id', v_extra.id,
          'name', v_extra.name,
          'price_cents', v_extra.price_cents * v_days
        )
      );
    ELSE
      v_extras_total := v_extras_total + v_extra.price_cents;
      v_extras_breakdown := v_extras_breakdown || jsonb_build_array(
        jsonb_build_object(
          'id', v_extra.id,
          'name', v_extra.name,
          'price_cents', v_extra.price_cents
        )
      );
    END IF;
  END LOOP;

  IF v_found_extra_count <> v_requested_extra_count THEN
    RAISE EXCEPTION 'invalid_extra_selection' USING ERRCODE = '22023';
  END IF;

  IF p_protection_plan_id IS NOT NULL THEN
    SELECT *
    INTO v_plan
    FROM rentauto.protection_plans
    WHERE id = p_protection_plan_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_protection_plan' USING ERRCODE = '22023';
    END IF;

    v_protection_total := v_plan.price_per_day_cents * v_days;
    v_protection_snapshot := jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'tier', v_plan.tier,
      'price_per_day_cents', v_plan.price_per_day_cents,
      'deductible_cents', v_plan.deductible_cents,
      'total_cents', v_protection_total
    );
  END IF;

  SELECT jsonb_build_object(
    'id', cp.id,
    'name', cp.name,
    'summary', cp.summary,
    'rules', cp.rules
  )
  INTO v_cancellation_snapshot
  FROM rentauto.car_policies link
  JOIN rentauto.cancellation_policies cp
    ON cp.id = link.cancellation_policy_id
  WHERE link.car_id = p_car_id
  ORDER BY cp.name, cp.id
  LIMIT 1;

  v_subtotal :=
    v_base_price +
    v_extras_total +
    v_protection_total -
    v_discounts;

  IF v_subtotal < 0 THEN
    RAISE EXCEPTION 'invalid_price_result';
  END IF;

  v_gst := ROUND(v_subtotal * 0.05)::integer;
  v_qst := ROUND(v_subtotal * 0.09975)::integer;
  v_taxes := v_gst + v_qst;
  v_total := v_subtotal + v_taxes;

  RETURN jsonb_build_object(
    'pricing_version', 'qc-v1',
    'quoted_at', now(),
    'tax_jurisdiction', 'QC',
    'days', v_days,
    'base_price', v_base_price,
    'extras_total', v_extras_total,
    'extras_breakdown', v_extras_breakdown,
    'selected_extra_ids', to_jsonb(v_selected_extra_ids),
    'protection_plan_id', p_protection_plan_id,
    'protection_total', v_protection_total,
    'protection_snapshot', v_protection_snapshot,
    'discounts', v_discounts,
    'discount_percent', v_discount_percent,
    'gst', v_gst,
    'gst_rate', 0.05,
    'qst', v_qst,
    'qst_rate', 0.09975,
    'taxes', v_taxes,
    'total_before_tax', v_subtotal,
    'total_after_tax', v_total,
    'included_km_total', v_car.included_km_per_day * v_days,
    'extra_km_price', v_car.extra_km_price_cents,
    'currency', upper(v_car.currency),
    'cancellation_policy_snapshot', v_cancellation_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION rentauto.compute_trip_quote(
  uuid, timestamptz, timestamptz, uuid[], uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION rentauto.compute_trip_quote(
  uuid, timestamptz, timestamptz, uuid[], uuid, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_quote_trip(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_selected_extras uuid[] DEFAULT ARRAY[]::uuid[],
  p_protection_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
  SELECT rentauto.compute_trip_quote(
    p_car_id,
    p_start_at,
    p_end_at,
    COALESCE(p_selected_extras, ARRAY[]::uuid[]),
    p_protection_plan_id,
    NULL
  );
$$;

REVOKE ALL ON FUNCTION public.rentauto_quote_trip(
  uuid, timestamptz, timestamptz, uuid[], uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rentauto_quote_trip(
  uuid, timestamptz, timestamptz, uuid[], uuid
) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rentauto_create_booking_draft(
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
  v_user_id uuid := auth.uid();
  v_account rentauto.accounts%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_quote jsonb;
  v_trip rentauto.trips%ROWTYPE;
  v_hold_expires_at timestamptz := now() + interval '10 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  PERFORM public.bootstrap_rentauto_account(v_user_id);

  SELECT *
  INTO v_account
  FROM rentauto.accounts
  WHERE auth_user_id = v_user_id
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

  IF v_car.host_id = v_user_id THEN
    RAISE EXCEPTION 'host_cannot_book_own_vehicle' USING ERRCODE = '42501';
  END IF;

  UPDATE rentauto.booking_holds
  SET
    status = 'expired',
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
    v_user_id,
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
    v_user_id,
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
    v_user_id,
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
  uuid, timestamptz, timestamptz, uuid[], uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rentauto_create_booking_draft(
  uuid, timestamptz, timestamptz, uuid[], uuid, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rentauto_extend_booking_hold_for_checkout(
  p_trip_id uuid,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
DECLARE
  v_hold rentauto.booking_holds%ROWTYPE;
BEGIN
  IF p_expires_at <= now()
     OR p_expires_at > now() + interval '40 minutes' THEN
    RAISE EXCEPTION 'invalid_hold_expiry' USING ERRCODE = '22023';
  END IF;

  SELECT h.*
  INTO v_hold
  FROM rentauto.booking_holds h
  JOIN rentauto.trips t ON t.id = h.trip_id
  WHERE h.trip_id = p_trip_id
    AND h.status = 'active'
    AND h.expires_at > now()
    AND t.status IN ('draft','pending_payment')
  FOR UPDATE OF h;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_hold_not_active' USING ERRCODE = 'P0002';
  END IF;

  UPDATE rentauto.booking_holds
  SET
    expires_at = p_expires_at,
    updated_at = now()
  WHERE id = v_hold.id
  RETURNING * INTO v_hold;

  RETURN jsonb_build_object(
    'holdId', v_hold.id,
    'tripId', v_hold.trip_id,
    'expiresAt', v_hold.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_extend_booking_hold_for_checkout(
  uuid, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_extend_booking_hold_for_checkout(
  uuid, timestamptz
) TO service_role;

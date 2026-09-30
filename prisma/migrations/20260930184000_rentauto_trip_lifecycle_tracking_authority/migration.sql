-- Atomic Rentauto trip lifecycle and privacy-preserving GPS ingestion.

CREATE OR REPLACE FUNCTION public.rentauto_transition_trip(
  p_user_id uuid,
  p_trip_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, auth, pg_temp
AS $$
DECLARE
  v_trip rentauto.trips%ROWTYPE;
  v_car rentauto.cars%ROWTYPE;
  v_is_guest boolean;
  v_is_host boolean;
  v_is_admin boolean;
  v_next_status text;
  v_breakdown jsonb;
  v_now timestamptz := now();
  v_odometer numeric;
  v_checkin_odometer numeric;
  v_included_km numeric;
  v_driven_km numeric;
  v_overage_km numeric;
  v_extra_km_price integer;
  v_overage_cents integer;
  v_consent_at timestamptz;
  v_fuel_level text;
  v_photo text;
BEGIN
  IF p_user_id IS NULL OR p_trip_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF p_action NOT IN (
    'start_check_in',
    'complete_check_in',
    'start_check_out',
    'complete_check_out'
  ) THEN
    RAISE EXCEPTION 'invalid_trip_action' USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_trip_payload' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_car
  FROM rentauto.cars
  WHERE id = v_trip.car_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_is_guest := v_trip.guest_id = p_user_id;
  v_is_host := v_car.host_id = p_user_id;
  v_is_admin := rentauto.has_role('admin'::rentauto.app_role, p_user_id);

  IF NOT (v_is_guest OR v_is_host OR v_is_admin) THEN
    RAISE EXCEPTION 'trip_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_action IN ('start_check_in','complete_check_in')
     AND NOT (v_is_guest OR v_is_admin) THEN
    RAISE EXCEPTION 'guest_check_in_required' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'start_check_in' THEN
    IF v_trip.status <> 'confirmed' THEN
      RAISE EXCEPTION 'invalid_trip_transition' USING ERRCODE = '22023';
    END IF;
    v_next_status := 'check_in_pending';

  ELSIF p_action = 'complete_check_in' THEN
    IF v_trip.status NOT IN ('confirmed','check_in_pending') THEN
      RAISE EXCEPTION 'invalid_trip_transition' USING ERRCODE = '22023';
    END IF;

    IF COALESCE((p_payload->>'pickup_confirmed')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'pickup_confirmation_required' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_odometer := (p_payload->>'odometer_km')::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_odometer' USING ERRCODE = '22023';
    END;

    IF v_odometer IS NULL OR v_odometer < 0 OR v_odometer > 10000000 THEN
      RAISE EXCEPTION 'invalid_odometer' USING ERRCODE = '22023';
    END IF;

    v_fuel_level := p_payload->>'fuel_level';
    IF v_fuel_level NOT IN ('full','3/4','1/2','1/4','empty') THEN
      RAISE EXCEPTION 'invalid_fuel_level' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(COALESCE(p_payload->'exterior_photos', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(p_payload->'exterior_photos', '[]'::jsonb)) > 20
       OR jsonb_typeof(COALESCE(p_payload->'interior_photos', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(p_payload->'interior_photos', '[]'::jsonb)) > 20 THEN
      RAISE EXCEPTION 'invalid_photo_list' USING ERRCODE = '22023';
    END IF;

    FOR v_photo IN
      SELECT value
      FROM jsonb_array_elements_text(
        COALESCE(p_payload->'exterior_photos', '[]'::jsonb)
      )
      UNION ALL
      SELECT value
      FROM jsonb_array_elements_text(
        COALESCE(p_payload->'interior_photos', '[]'::jsonb)
      )
    LOOP
      IF char_length(v_photo) > 1024
         OR v_photo NOT LIKE p_trip_id::text || '/check-in/%' THEN
        RAISE EXCEPTION 'invalid_photo_path' USING ERRCODE = '22023';
      END IF;
    END LOOP;

    IF v_car.tracking_consent_required THEN
      BEGIN
        v_consent_at := (p_payload->>'consent_accepted_at')::timestamptz;
      EXCEPTION
        WHEN invalid_datetime_format THEN
          RAISE EXCEPTION 'tracking_consent_required' USING ERRCODE = '22023';
      END;

      IF v_consent_at IS NULL
         OR v_consent_at > v_now + interval '5 minutes'
         OR v_consent_at < v_now - interval '24 hours' THEN
        RAISE EXCEPTION 'tracking_consent_required' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_consent_at := NULLIF(p_payload->>'consent_accepted_at','')::timestamptz;
    END IF;

    v_breakdown := COALESCE(v_trip.pricing_breakdown, '{}'::jsonb);
    v_breakdown := jsonb_set(
      v_breakdown,
      '{check_in}',
      p_payload || jsonb_build_object(
        'at', v_now,
        'by', p_user_id
      ),
      true
    );

    UPDATE rentauto.trips
    SET
      status = 'active',
      pricing_breakdown = v_breakdown,
      updated_at = v_now
    WHERE id = p_trip_id
    RETURNING * INTO v_trip;

    INSERT INTO rentauto.trip_tracking_sessions (
      trip_id,
      car_id,
      guest_id,
      host_id,
      status,
      started_at,
      consent_accepted_at
    )
    VALUES (
      v_trip.id,
      v_trip.car_id,
      v_trip.guest_id,
      v_car.host_id,
      'active',
      v_now,
      v_consent_at
    )
    ON CONFLICT (trip_id)
      WHERE status = 'active'
    DO NOTHING;

    v_next_status := 'active';

  ELSIF p_action = 'start_check_out' THEN
    IF v_trip.status <> 'active' THEN
      RAISE EXCEPTION 'invalid_trip_transition' USING ERRCODE = '22023';
    END IF;
    v_next_status := 'check_out_pending';

  ELSIF p_action = 'complete_check_out' THEN
    IF v_trip.status NOT IN ('active','check_out_pending') THEN
      RAISE EXCEPTION 'invalid_trip_transition' USING ERRCODE = '22023';
    END IF;

    IF COALESCE((p_payload->>'return_confirmed')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'return_confirmation_required' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_odometer := (p_payload->>'odometer_km')::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_odometer' USING ERRCODE = '22023';
    END;

    IF v_odometer IS NULL OR v_odometer < 0 OR v_odometer > 10000000 THEN
      RAISE EXCEPTION 'invalid_odometer' USING ERRCODE = '22023';
    END IF;

    v_fuel_level := p_payload->>'fuel_level';
    IF v_fuel_level NOT IN ('full','3/4','1/2','1/4','empty') THEN
      RAISE EXCEPTION 'invalid_fuel_level' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(COALESCE(p_payload->'exterior_photos', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(p_payload->'exterior_photos', '[]'::jsonb)) > 20
       OR jsonb_typeof(COALESCE(p_payload->'interior_photos', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(p_payload->'interior_photos', '[]'::jsonb)) > 20 THEN
      RAISE EXCEPTION 'invalid_photo_list' USING ERRCODE = '22023';
    END IF;

    FOR v_photo IN
      SELECT value
      FROM jsonb_array_elements_text(
        COALESCE(p_payload->'exterior_photos', '[]'::jsonb)
      )
      UNION ALL
      SELECT value
      FROM jsonb_array_elements_text(
        COALESCE(p_payload->'interior_photos', '[]'::jsonb)
      )
    LOOP
      IF char_length(v_photo) > 1024
         OR v_photo NOT LIKE p_trip_id::text || '/check-out/%' THEN
        RAISE EXCEPTION 'invalid_photo_path' USING ERRCODE = '22023';
      END IF;
    END LOOP;

    v_breakdown := COALESCE(v_trip.pricing_breakdown, '{}'::jsonb);

    BEGIN
      v_checkin_odometer :=
        (v_breakdown->'check_in'->>'odometer_km')::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_checkin_odometer := NULL;
    END;

    IF v_checkin_odometer IS NOT NULL AND v_odometer < v_checkin_odometer THEN
      RAISE EXCEPTION 'checkout_odometer_before_checkin' USING ERRCODE = '22023';
    END IF;

    v_breakdown := jsonb_set(
      v_breakdown,
      '{check_out}',
      p_payload || jsonb_build_object(
        'at', v_now,
        'by', p_user_id
      ),
      true
    );

    IF v_checkin_odometer IS NOT NULL THEN
      v_driven_km := v_odometer - v_checkin_odometer;
      v_included_km := COALESCE(
        NULLIF(v_breakdown->>'included_km_total','')::numeric,
        0
      );
      v_extra_km_price := COALESCE(
        NULLIF(v_breakdown->>'extra_km_price','')::integer,
        0
      );
      v_overage_km := GREATEST(0, v_driven_km - v_included_km);
      v_overage_cents := ROUND(v_overage_km * v_extra_km_price)::integer;

      v_breakdown := jsonb_set(
        v_breakdown,
        '{mileage_summary}',
        jsonb_build_object(
          'driven_km', v_driven_km,
          'included_km', v_included_km,
          'overage_km', v_overage_km,
          'overage_cents', v_overage_cents
        ),
        true
      );
    END IF;

    UPDATE rentauto.trips
    SET
      status = 'completed',
      pricing_breakdown = v_breakdown,
      updated_at = v_now
    WHERE id = p_trip_id
    RETURNING * INTO v_trip;

    UPDATE rentauto.trip_tracking_sessions
    SET
      status = 'ended',
      ended_at = v_now,
      updated_at = v_now
    WHERE trip_id = p_trip_id
      AND status = 'active';

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
      'trip_completed',
      'Trip completed',
      'Your Rentauto trip has been completed.',
      '/trips/' || v_trip.id::text,
      jsonb_build_object(
        'tripId', v_trip.id,
        'bookingReference', v_trip.booking_reference
      )
    );

    v_next_status := 'completed';
  END IF;

  IF p_action IN ('start_check_in','start_check_out') THEN
    UPDATE rentauto.trips
    SET
      status = v_next_status,
      updated_at = v_now
    WHERE id = p_trip_id
    RETURNING * INTO v_trip;
  END IF;

  INSERT INTO rentauto.trip_events (
    trip_id,
    actor_user_id,
    event_type,
    payload_json
  )
  VALUES (
    p_trip_id,
    p_user_id,
    p_action,
    jsonb_build_object(
      'to', v_next_status,
      'payload', p_payload
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tripId', v_trip.id,
    'bookingReference', v_trip.booking_reference,
    'status', v_next_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_transition_trip(
  uuid, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_transition_trip(
  uuid, uuid, text, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.rentauto_ingest_location(
  p_provider text,
  p_device_identifier text,
  p_lat numeric,
  p_lng numeric,
  p_speed_kmh numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_accuracy_meters numeric DEFAULT NULL,
  p_recorded_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rentauto, pg_temp
AS $$
DECLARE
  v_device rentauto.vehicle_tracking_devices%ROWTYPE;
  v_session rentauto.trip_tracking_sessions%ROWTYPE;
  v_trip rentauto.trips%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_provider IS NULL OR btrim(p_provider) = ''
     OR char_length(p_provider) > 100
     OR p_device_identifier IS NULL
     OR btrim(p_device_identifier) = ''
     OR char_length(p_device_identifier) > 128 THEN
    RAISE EXCEPTION 'invalid_tracking_device' USING ERRCODE = '22023';
  END IF;

  IF p_lat IS NULL OR p_lat < -90 OR p_lat > 90
     OR p_lng IS NULL OR p_lng < -180 OR p_lng > 180
     OR (p_speed_kmh IS NOT NULL AND (p_speed_kmh < 0 OR p_speed_kmh >= 400))
     OR (p_heading IS NOT NULL AND (p_heading < 0 OR p_heading >= 360))
     OR (p_accuracy_meters IS NOT NULL AND (p_accuracy_meters < 0 OR p_accuracy_meters > 100000)) THEN
    RAISE EXCEPTION 'invalid_tracking_payload' USING ERRCODE = '22023';
  END IF;

  IF p_recorded_at IS NULL
     OR p_recorded_at > v_now + interval '5 minutes'
     OR p_recorded_at < v_now - interval '24 hours' THEN
    RAISE EXCEPTION 'invalid_tracking_timestamp' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_device
  FROM rentauto.vehicle_tracking_devices
  WHERE provider = p_provider
    AND device_identifier = p_device_identifier
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tracking_device_not_registered' USING ERRCODE = 'P0002';
  END IF;

  UPDATE rentauto.vehicle_tracking_devices
  SET
    last_seen_at = GREATEST(COALESCE(last_seen_at, p_recorded_at), p_recorded_at),
    updated_at = v_now
  WHERE id = v_device.id;

  SELECT *
  INTO v_session
  FROM rentauto.trip_tracking_sessions
  WHERE car_id = v_device.car_id
    AND status = 'active'
  ORDER BY started_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'no_active_session'
    );
  END IF;

  SELECT *
  INTO v_trip
  FROM rentauto.trips
  WHERE id = v_session.trip_id;

  IF NOT FOUND OR v_trip.status <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'trip_not_active'
    );
  END IF;

  IF v_session.started_at IS NULL
     OR p_recorded_at < v_session.started_at - interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'recorded', false,
      'reason', 'outside_active_window'
    );
  END IF;

  INSERT INTO rentauto.vehicle_location_events (
    trip_id,
    car_id,
    lat,
    lng,
    speed_kmh,
    heading,
    accuracy_meters,
    source,
    recorded_at
  )
  VALUES (
    v_session.trip_id,
    v_device.car_id,
    p_lat,
    p_lng,
    p_speed_kmh,
    p_heading,
    p_accuracy_meters,
    p_provider,
    p_recorded_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'recorded', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rentauto_ingest_location(
  text, text, numeric, numeric, numeric, numeric, numeric, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rentauto_ingest_location(
  text, text, numeric, numeric, numeric, numeric, numeric, timestamptz
) TO service_role;

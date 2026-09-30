-- Rentauto marketplace + booking core in the isolated shared-backend schema.
-- No existing Rentauto production traffic is switched by this migration.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE rentauto.accounts
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS is_all_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2),
  ADD COLUMN IF NOT EXISTS trips_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rentauto.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active','disabled','paused','draft')),
  title text NOT NULL DEFAULT '',
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 2020 CHECK (year >= 1900 AND year <= 2200),
  trim text,
  description text,
  body_type text,
  seats integer NOT NULL DEFAULT 5 CHECK (seats > 0 AND seats <= 50),
  doors integer NOT NULL DEFAULT 4 CHECK (doors > 0 AND doors <= 12),
  fuel_type text NOT NULL DEFAULT 'regular'
    CHECK (fuel_type IN ('regular','premium','diesel','electric','hybrid')),
  consumption_l_per_100km numeric(5,1),
  transmission text NOT NULL DEFAULT 'automatic'
    CHECK (transmission IN ('automatic','manual')),
  features jsonb NOT NULL DEFAULT '{"safety":[],"connectivity":[]}'::jsonb,
  rules jsonb NOT NULL DEFAULT '{"no_smoking":true,"keep_tidy":true,"refuel":true,"no_offroad":true,"smoking_fee_cents":15000,"tidy_fee_cents":15000,"telematics_disclosure":"Vehicle may have a device that collects driving and location data."}'::jsonb,
  base_daily_price_cents integer NOT NULL DEFAULT 5000 CHECK (base_daily_price_cents >= 0),
  currency text NOT NULL DEFAULT 'CAD' CHECK (char_length(currency) = 3),
  included_km_per_day integer NOT NULL DEFAULT 300 CHECK (included_km_per_day >= 0),
  extra_km_price_cents integer NOT NULL DEFAULT 29 CHECK (extra_km_price_cents >= 0),
  location_label text,
  lat numeric(10,7) CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng numeric(10,7) CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  plate_number text,
  vin text,
  insurance_status text NOT NULL DEFAULT 'not_provided',
  registration_url text,
  insurance_url text,
  airport_pickup_enabled boolean NOT NULL DEFAULT false,
  monthly_enabled boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'other',
  instant_book boolean NOT NULL DEFAULT false,
  tracking_consent_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_cars_host_idx ON rentauto.cars(host_id);
CREATE INDEX IF NOT EXISTS rentauto_cars_status_idx ON rentauto.cars(status);
CREATE INDEX IF NOT EXISTS rentauto_cars_location_idx ON rentauto.cars(location_label);
CREATE INDEX IF NOT EXISTS rentauto_cars_category_idx ON rentauto.cars(category);

DROP TRIGGER IF EXISTS rentauto_cars_set_updated_at ON rentauto.cars;
CREATE TRIGGER rentauto_cars_set_updated_at
BEFORE UPDATE ON rentauto.cars
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.car_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_car_photos_car_idx
  ON rentauto.car_photos(car_id, sort_order);

CREATE TABLE IF NOT EXISTS rentauto.car_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  pricing_type text NOT NULL DEFAULT 'per_trip'
    CHECK (pricing_type IN ('per_trip','per_day')),
  max_qty integer NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_car_extras_car_idx
  ON rentauto.car_extras(car_id);

CREATE TABLE IF NOT EXISTS rentauto.cancellation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  summary text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rentauto.car_policies (
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  cancellation_policy_id uuid NOT NULL
    REFERENCES rentauto.cancellation_policies(id) ON DELETE CASCADE,
  PRIMARY KEY (car_id, cancellation_policy_id)
);

CREATE TABLE IF NOT EXISTS rentauto.protection_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL UNIQUE CHECK (tier IN ('basic','standard','premium','silver','gold')),
  description text,
  coverage_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_per_day_cents integer NOT NULL DEFAULT 0 CHECK (price_per_day_cents >= 0),
  deductible_cents integer NOT NULL DEFAULT 0 CHECK (deductible_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS rentauto.booking_reference_seq
  START WITH 100 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION rentauto.generate_booking_reference()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = rentauto, pg_temp
AS $$
  SELECT 'RA-' ||
    to_char(now() AT TIME ZONE 'UTC', 'YYYY') ||
    '-' ||
    lpad(nextval('rentauto.booking_reference_seq')::text, 6, '0');
$$;

REVOKE ALL ON FUNCTION rentauto.generate_booking_reference()
  FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS rentauto.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE RESTRICT,
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  pickup_location text,
  return_location text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'quote','requested','approved','declined','booked',
        'draft','pending_payment','confirmed','check_in_pending',
        'active','check_out_pending','completed','cancelled','disputed'
      )
    ),
  pricing_breakdown jsonb,
  total_cents integer CHECK (total_cents IS NULL OR total_cents >= 0),
  currency text NOT NULL DEFAULT 'CAD' CHECK (char_length(currency) = 3),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','failed','refunded','partially_refunded')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  booking_reference text NOT NULL DEFAULT rentauto.generate_booking_reference(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  UNIQUE (booking_reference)
);

CREATE INDEX IF NOT EXISTS rentauto_trips_car_idx ON rentauto.trips(car_id);
CREATE INDEX IF NOT EXISTS rentauto_trips_guest_idx ON rentauto.trips(guest_id);
CREATE INDEX IF NOT EXISTS rentauto_trips_status_idx ON rentauto.trips(status);
CREATE UNIQUE INDEX IF NOT EXISTS rentauto_trips_stripe_session_uidx
  ON rentauto.trips(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rentauto_trips_payment_intent_uidx
  ON rentauto.trips(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

DROP TRIGGER IF EXISTS rentauto_trips_set_updated_at ON rentauto.trips;
CREATE TRIGGER rentauto_trips_set_updated_at
BEFORE UPDATE ON rentauto.trips
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'blocked'
    CHECK (type IN ('booking','booking_self','maintenance','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS rentauto_availability_car_window_idx
  ON rentauto.availability_blocks(car_id, start_at, end_at);

CREATE UNIQUE INDEX IF NOT EXISTS rentauto_availability_booking_trip_uidx
  ON rentauto.availability_blocks(trip_id)
  WHERE type = 'booking_self' AND trip_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rentauto_availability_booking_no_overlap'
  ) THEN
    ALTER TABLE rentauto.availability_blocks
      ADD CONSTRAINT rentauto_availability_booking_no_overlap
      EXCLUDE USING gist (
        car_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (type IN ('booking','booking_self'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS rentauto.booking_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','converted','released','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS rentauto_booking_holds_car_window_idx
  ON rentauto.booking_holds(car_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS rentauto_booking_holds_expiry_idx
  ON rentauto.booking_holds(status, expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rentauto_booking_holds_active_no_overlap'
  ) THEN
    ALTER TABLE rentauto.booking_holds
      ADD CONSTRAINT rentauto_booking_holds_active_no_overlap
      EXCLUDE USING gist (
        car_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status = 'active');
  END IF;
END
$$;

DROP TRIGGER IF EXISTS rentauto_booking_holds_set_updated_at
  ON rentauto.booking_holds;
CREATE TRIGGER rentauto_booking_holds_set_updated_at
BEFORE UPDATE ON rentauto.booking_holds
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, car_id)
);

CREATE INDEX IF NOT EXISTS rentauto_favorites_user_idx
  ON rentauto.favorites(user_id);
CREATE INDEX IF NOT EXISTS rentauto_favorites_car_idx
  ON rentauto.favorites(car_id);

CREATE TABLE IF NOT EXISTS rentauto.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES rentauto.trips(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rating_overall numeric(2,1) NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_cleanliness numeric(2,1) CHECK (rating_cleanliness IS NULL OR rating_cleanliness BETWEEN 1 AND 5),
  rating_maintenance numeric(2,1) CHECK (rating_maintenance IS NULL OR rating_maintenance BETWEEN 1 AND 5),
  rating_communication numeric(2,1) CHECK (rating_communication IS NULL OR rating_communication BETWEEN 1 AND 5),
  rating_convenience numeric(2,1) CHECK (rating_convenience IS NULL OR rating_convenience BETWEEN 1 AND 5),
  rating_accuracy numeric(2,1) CHECK (rating_accuracy IS NULL OR rating_accuracy BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_reviews_car_idx
  ON rentauto.reviews(car_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS rentauto_reviews_trip_reviewer_uidx
  ON rentauto.reviews(trip_id, reviewer_id)
  WHERE trip_id IS NOT NULL;

ALTER TABLE rentauto.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.car_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.car_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.car_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.protection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_cars_read ON rentauto.cars;
CREATE POLICY rentauto_cars_read
ON rentauto.cars FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  OR host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_cars_host_insert ON rentauto.cars;
CREATE POLICY rentauto_cars_host_insert
ON rentauto.cars FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND (
    rentauto.has_role('host'::rentauto.app_role)
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_cars_host_update ON rentauto.cars;
CREATE POLICY rentauto_cars_host_update
ON rentauto.cars FOR UPDATE
TO authenticated
USING (
  host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
)
WITH CHECK (
  host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_cars_host_delete ON rentauto.cars;
CREATE POLICY rentauto_cars_host_delete
ON rentauto.cars FOR DELETE
TO authenticated
USING (
  host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_car_photos_read ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_read
ON rentauto.car_photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.status = 'active'
        OR c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_photos_host_insert ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_host_insert
ON rentauto.car_photos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_photos_host_delete ON rentauto.car_photos;
CREATE POLICY rentauto_car_photos_host_delete
ON rentauto.car_photos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_extras_read ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_read
ON rentauto.car_extras FOR SELECT
TO anon, authenticated
USING (
  is_active
  OR EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_extras_host_manage ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_host_manage
ON rentauto.car_extras FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_cancellation_read ON rentauto.cancellation_policies;
CREATE POLICY rentauto_cancellation_read
ON rentauto.cancellation_policies FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS rentauto_car_policies_read ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_read
ON rentauto.car_policies FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS rentauto_car_policies_host_manage ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_host_manage
ON rentauto.car_policies FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_protection_read ON rentauto.protection_plans;
CREATE POLICY rentauto_protection_read
ON rentauto.protection_plans FOR SELECT
TO anon, authenticated
USING (is_active OR rentauto.has_role('admin'::rentauto.app_role));

DROP POLICY IF EXISTS rentauto_trips_participants_read ON rentauto.trips;
CREATE POLICY rentauto_trips_participants_read
ON rentauto.trips FOR SELECT
TO authenticated
USING (
  guest_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id AND c.host_id = auth.uid()
  )
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_availability_read ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_read
ON rentauto.availability_blocks FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS rentauto_availability_host_manage ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_manage
ON rentauto.availability_blocks FOR ALL
TO authenticated
USING (
  type <> 'booking_self'
  AND EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  type <> 'booking_self'
  AND EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_favorites_self ON rentauto.favorites;
CREATE POLICY rentauto_favorites_self
ON rentauto.favorites FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_reviews_read ON rentauto.reviews;
CREATE POLICY rentauto_reviews_read
ON rentauto.reviews FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS rentauto_reviews_completed_trip_insert ON rentauto.reviews;
CREATE POLICY rentauto_reviews_completed_trip_insert
ON rentauto.reviews FOR INSERT
TO authenticated
WITH CHECK (
  reviewer_id = auth.uid()
  AND trip_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM rentauto.trips t
    WHERE t.id = trip_id
      AND t.guest_id = auth.uid()
      AND t.car_id = car_id
      AND t.status = 'completed'
  )
);

REVOKE ALL ON rentauto.booking_holds FROM anon, authenticated;
GRANT ALL ON rentauto.booking_holds TO service_role;

GRANT SELECT (
  id, host_id, status, title, make, model, year, trim, description, body_type,
  seats, doors, fuel_type, consumption_l_per_100km, transmission, features,
  rules, base_daily_price_cents, currency, included_km_per_day,
  extra_km_price_cents, location_label, lat, lng, airport_pickup_enabled,
  monthly_enabled, category, instant_book, tracking_consent_required,
  created_at, updated_at
) ON rentauto.cars TO anon, authenticated;

GRANT INSERT (
  host_id, status, title, make, model, year, trim, description, body_type,
  seats, doors, fuel_type, consumption_l_per_100km, transmission, features,
  rules, base_daily_price_cents, currency, included_km_per_day,
  extra_km_price_cents, location_label, lat, lng, airport_pickup_enabled,
  monthly_enabled, category, instant_book, tracking_consent_required
) ON rentauto.cars TO authenticated;

GRANT UPDATE (
  status, title, make, model, year, trim, description, body_type,
  seats, doors, fuel_type, consumption_l_per_100km, transmission, features,
  rules, base_daily_price_cents, currency, included_km_per_day,
  extra_km_price_cents, location_label, lat, lng, airport_pickup_enabled,
  monthly_enabled, category, instant_book, tracking_consent_required
) ON rentauto.cars TO authenticated;

GRANT DELETE ON rentauto.cars TO authenticated;

GRANT SELECT ON rentauto.car_photos, rentauto.car_extras,
  rentauto.cancellation_policies, rentauto.car_policies,
  rentauto.protection_plans, rentauto.availability_blocks,
  rentauto.reviews TO anon, authenticated;

GRANT INSERT, DELETE ON rentauto.car_photos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON rentauto.car_extras TO authenticated;
GRANT INSERT, UPDATE, DELETE ON rentauto.car_policies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON rentauto.availability_blocks TO authenticated;
GRANT SELECT, INSERT, DELETE ON rentauto.favorites TO authenticated;
GRANT SELECT ON rentauto.trips TO authenticated;
GRANT INSERT ON rentauto.reviews TO authenticated;

GRANT ALL ON rentauto.cars, rentauto.car_photos, rentauto.car_extras,
  rentauto.cancellation_policies, rentauto.car_policies,
  rentauto.protection_plans, rentauto.trips, rentauto.availability_blocks,
  rentauto.favorites, rentauto.reviews TO service_role;

GRANT USAGE, SELECT ON SEQUENCE rentauto.booking_reference_seq TO service_role;

INSERT INTO rentauto.cancellation_policies (name, summary, rules)
VALUES (
  'Free cancellation',
  'Full refund within 24 hours of booking. More flexible options may apply at checkout.',
  '{"refund_window_hours":24,"refund_percentage":100}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO rentauto.protection_plans
  (name, tier, description, coverage_details, price_per_day_cents, deductible_cents, sort_order)
VALUES
  (
    'Basic',
    'basic',
    'Liability-focused baseline protection.',
    '[{"label":"Third-party liability","included":true},{"label":"Collision/comprehensive","included":false},{"label":"Roadside assistance","included":false}]'::jsonb,
    0,
    500000,
    1
  ),
  (
    'Silver',
    'silver',
    'Collision and comprehensive protection with roadside assistance.',
    '[{"label":"Third-party liability","included":true},{"label":"Collision/comprehensive","included":true},{"label":"Roadside assistance","included":true}]'::jsonb,
    2500,
    100000,
    2
  ),
  (
    'Gold',
    'gold',
    'Expanded protection with the lowest deductible in the Rentauto catalog.',
    '[{"label":"Third-party liability","included":true},{"label":"Collision/comprehensive","included":true},{"label":"Roadside assistance","included":true},{"label":"Personal effects","included":true}]'::jsonb,
    4500,
    25000,
    3
  )
ON CONFLICT (tier) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  coverage_details = EXCLUDED.coverage_details,
  price_per_day_cents = EXCLUDED.price_per_day_cents,
  deductible_cents = EXCLUDED.deductible_cents,
  sort_order = EXCLUDED.sort_order;

-- Rentauto operational lifecycle: host readiness, tracking, incidents, support,
-- notifications, Stripe Connect state, and namespaced Storage buckets.
-- Shared TAKATAK Auth remains the identity authority.

CREATE TABLE IF NOT EXISTS rentauto.host_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  verification_status text NOT NULL DEFAULT 'not_started'
    CHECK (verification_status IN ('not_started','pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS rentauto_host_verifications_updated_at
  ON rentauto.host_verifications;
CREATE TRIGGER rentauto_host_verifications_updated_at
BEFORE UPDATE ON rentauto.host_verifications
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.host_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  min_trip_days integer NOT NULL DEFAULT 1 CHECK (min_trip_days >= 1),
  max_trip_days integer NOT NULL DEFAULT 30 CHECK (max_trip_days >= min_trip_days),
  advance_notice_hours integer NOT NULL DEFAULT 24 CHECK (advance_notice_hours >= 0),
  buffer_hours integer NOT NULL DEFAULT 4 CHECK (buffer_hours >= 0),
  delivery_available boolean NOT NULL DEFAULT false,
  delivery_radius_km integer CHECK (delivery_radius_km IS NULL OR delivery_radius_km >= 0),
  delivery_fee_cents integer CHECK (delivery_fee_cents IS NULL OR delivery_fee_cents >= 0),
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS rentauto_host_preferences_updated_at
  ON rentauto.host_preferences;
CREATE TRIGGER rentauto_host_preferences_updated_at
BEFORE UPDATE ON rentauto.host_preferences
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS rentauto_stripe_accounts_updated_at
  ON rentauto.stripe_accounts;
CREATE TRIGGER rentauto_stripe_accounts_updated_at
BEFORE UPDATE ON rentauto.stripe_accounts
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','processed','failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  last_error text,
  processing_started_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_stripe_webhook_status_idx
  ON rentauto.stripe_webhook_events(status, created_at);

CREATE TABLE IF NOT EXISTS rentauto.vehicle_tracking_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'unconfigured',
  device_identifier text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','maintenance','removed')),
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, device_identifier)
);

CREATE INDEX IF NOT EXISTS rentauto_tracking_devices_car_idx
  ON rentauto.vehicle_tracking_devices(car_id);

DROP TRIGGER IF EXISTS rentauto_tracking_devices_updated_at
  ON rentauto.vehicle_tracking_devices;
CREATE TRIGGER rentauto_tracking_devices_updated_at
BEFORE UPDATE ON rentauto.vehicle_tracking_devices
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.trip_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','ended','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  consent_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_tracking_sessions_trip_idx
  ON rentauto.trip_tracking_sessions(trip_id);
CREATE INDEX IF NOT EXISTS rentauto_tracking_sessions_car_active_idx
  ON rentauto.trip_tracking_sessions(car_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS rentauto_tracking_sessions_trip_active_uidx
  ON rentauto.trip_tracking_sessions(trip_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS rentauto_tracking_sessions_updated_at
  ON rentauto.trip_tracking_sessions;
CREATE TRIGGER rentauto_tracking_sessions_updated_at
BEFORE UPDATE ON rentauto.trip_tracking_sessions
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.vehicle_location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES rentauto.cars(id) ON DELETE CASCADE,
  lat numeric NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric NOT NULL CHECK (lng BETWEEN -180 AND 180),
  speed_kmh numeric CHECK (speed_kmh IS NULL OR (speed_kmh >= 0 AND speed_kmh < 400)),
  heading numeric CHECK (heading IS NULL OR (heading >= 0 AND heading < 360)),
  accuracy_meters numeric CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  source text NOT NULL DEFAULT 'gps',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_location_trip_time_idx
  ON rentauto.vehicle_location_events(trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS rentauto_location_car_time_idx
  ON rentauto.vehicle_location_events(car_id, recorded_at DESC);

ALTER TABLE rentauto.vehicle_location_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'rentauto'
      AND tablename = 'vehicle_location_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE rentauto.vehicle_location_events;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS rentauto.trip_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES rentauto.trips(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  type text NOT NULL,
  description text,
  photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_incidents_trip_idx
  ON rentauto.trip_incidents(trip_id);
CREATE INDEX IF NOT EXISTS rentauto_incidents_reporter_created_idx
  ON rentauto.trip_incidents(reporter_user_id, created_at DESC);

DROP TRIGGER IF EXISTS rentauto_trip_incidents_updated_at
  ON rentauto.trip_incidents;
CREATE TRIGGER rentauto_trip_incidents_updated_at
BEFORE UPDATE ON rentauto.trip_incidents
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

CREATE TABLE IF NOT EXISTS rentauto.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_notifications_user_created_idx
  ON rentauto.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rentauto_notifications_unread_idx
  ON rentauto.notifications(user_id)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS rentauto.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES rentauto.trips(id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  last_response_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_support_user_created_idx
  ON rentauto.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rentauto_support_status_idx
  ON rentauto.support_tickets(status, created_at DESC);

DROP TRIGGER IF EXISTS rentauto_support_updated_at
  ON rentauto.support_tickets;
CREATE TRIGGER rentauto_support_updated_at
BEFORE UPDATE ON rentauto.support_tickets
FOR EACH ROW EXECUTE FUNCTION rentauto.set_updated_at();

ALTER TABLE rentauto.host_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.host_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.vehicle_tracking_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.trip_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.vehicle_location_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.trip_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_host_verifications_read
  ON rentauto.host_verifications;
CREATE POLICY rentauto_host_verifications_read
ON rentauto.host_verifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_host_preferences_own
  ON rentauto.host_preferences;
CREATE POLICY rentauto_host_preferences_own
ON rentauto.host_preferences
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
)
WITH CHECK (
  user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_stripe_accounts_read
  ON rentauto.stripe_accounts;
CREATE POLICY rentauto_stripe_accounts_read
ON rentauto.stripe_accounts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_tracking_devices_read
  ON rentauto.vehicle_tracking_devices;
CREATE POLICY rentauto_tracking_devices_read
ON rentauto.vehicle_tracking_devices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_tracking_sessions_read
  ON rentauto.trip_tracking_sessions;
CREATE POLICY rentauto_tracking_sessions_read
ON rentauto.trip_tracking_sessions
FOR SELECT
TO authenticated
USING (
  guest_id = auth.uid()
  OR host_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_location_events_read
  ON rentauto.vehicle_location_events;
CREATE POLICY rentauto_location_events_read
ON rentauto.vehicle_location_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND t.status = 'active'
      AND (
        t.guest_id = auth.uid()
        OR c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_incidents_read
  ON rentauto.trip_incidents;
CREATE POLICY rentauto_incidents_read
ON rentauto.trip_incidents
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

DROP POLICY IF EXISTS rentauto_incidents_insert
  ON rentauto.trip_incidents;
CREATE POLICY rentauto_incidents_insert
ON rentauto.trip_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (
        t.guest_id = auth.uid()
        OR c.host_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS rentauto_notifications_read
  ON rentauto.notifications;
CREATE POLICY rentauto_notifications_read
ON rentauto.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_notifications_mark_read
  ON rentauto.notifications;
CREATE POLICY rentauto_notifications_mark_read
ON rentauto.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_support_read
  ON rentauto.support_tickets;
CREATE POLICY rentauto_support_read
ON rentauto.support_tickets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_support_insert
  ON rentauto.support_tickets;
CREATE POLICY rentauto_support_insert
ON rentauto.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'open'
  AND (
    trip_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM rentauto.trips t
      WHERE t.id = trip_id
        AND t.guest_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS rentauto_support_admin_update
  ON rentauto.support_tickets;
CREATE POLICY rentauto_support_admin_update
ON rentauto.support_tickets
FOR UPDATE
TO authenticated
USING (rentauto.has_role('admin'::rentauto.app_role))
WITH CHECK (rentauto.has_role('admin'::rentauto.app_role));

GRANT SELECT ON rentauto.host_verifications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.host_verifications FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON rentauto.host_preferences TO authenticated;
REVOKE DELETE ON rentauto.host_preferences FROM anon, authenticated;

GRANT SELECT ON rentauto.stripe_accounts TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.stripe_accounts FROM anon, authenticated;

REVOKE ALL ON rentauto.stripe_webhook_events FROM anon, authenticated;

GRANT SELECT ON rentauto.vehicle_tracking_devices,
  rentauto.trip_tracking_sessions,
  rentauto.vehicle_location_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.vehicle_tracking_devices,
  rentauto.trip_tracking_sessions,
  rentauto.vehicle_location_events FROM anon, authenticated;

GRANT SELECT, INSERT ON rentauto.trip_incidents TO authenticated;
REVOKE UPDATE, DELETE ON rentauto.trip_incidents FROM anon, authenticated;

GRANT SELECT ON rentauto.notifications TO authenticated;
GRANT UPDATE (read_at) ON rentauto.notifications TO authenticated;
REVOKE INSERT, DELETE ON rentauto.notifications FROM anon, authenticated;

GRANT SELECT ON rentauto.support_tickets TO authenticated;
GRANT INSERT (user_id, trip_id, category, subject, body)
  ON rentauto.support_tickets TO authenticated;
GRANT UPDATE (status, priority, last_response_at)
  ON rentauto.support_tickets TO authenticated;

GRANT ALL ON rentauto.host_verifications, rentauto.host_preferences,
  rentauto.stripe_accounts, rentauto.stripe_webhook_events,
  rentauto.vehicle_tracking_devices, rentauto.trip_tracking_sessions,
  rentauto.vehicle_location_events, rentauto.trip_incidents,
  rentauto.notifications, rentauto.support_tickets TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('rentauto-profile-photos', 'rentauto-profile-photos', true),
  ('rentauto-vehicle-photos', 'rentauto-vehicle-photos', true),
  ('rentauto-ids-private', 'rentauto-ids-private', false),
  ('rentauto-trip-photos', 'rentauto-trip-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rentauto_profile_photos_upload ON storage.objects;
CREATE POLICY rentauto_profile_photos_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS rentauto_profile_photos_update ON storage.objects;
CREATE POLICY rentauto_profile_photos_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rentauto-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'rentauto-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS rentauto_profile_photos_delete ON storage.objects;
CREATE POLICY rentauto_profile_photos_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rentauto-profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS rentauto_vehicle_photos_upload ON storage.objects;
CREATE POLICY rentauto_vehicle_photos_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_vehicle_photos_update ON storage.objects;
CREATE POLICY rentauto_vehicle_photos_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rentauto-vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  bucket_id = 'rentauto-vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_vehicle_photos_delete ON storage.objects;
CREATE POLICY rentauto_vehicle_photos_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rentauto-vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_ids_private_read ON storage.objects;
CREATE POLICY rentauto_ids_private_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rentauto-ids-private'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_ids_private_upload ON storage.objects;
CREATE POLICY rentauto_ids_private_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-ids-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS rentauto_trip_photos_read ON storage.objects;
CREATE POLICY rentauto_trip_photos_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rentauto-trip-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (
        t.guest_id = auth.uid()
        OR c.host_id = auth.uid()
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_trip_photos_upload ON storage.objects;
CREATE POLICY rentauto_trip_photos_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-trip-photos'
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (
        t.guest_id = auth.uid()
        OR c.host_id = auth.uid()
      )
  )
);

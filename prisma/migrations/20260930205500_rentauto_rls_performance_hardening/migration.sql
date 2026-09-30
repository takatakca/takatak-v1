-- Rentauto RLS correctness/performance hardening and FK indexes.
-- This migration does not broaden access; it removes duplicate permissive
-- policies, fixes one review-car correlation bug, and caches auth.uid() per query.

CREATE INDEX IF NOT EXISTS rentauto_booking_holds_guest_idx
  ON rentauto.booking_holds(guest_id);
CREATE INDEX IF NOT EXISTS rentauto_car_policies_cancellation_idx
  ON rentauto.car_policies(cancellation_policy_id);
CREATE INDEX IF NOT EXISTS rentauto_concierge_messages_user_idx
  ON rentauto.concierge_messages(user_id);
CREATE INDEX IF NOT EXISTS rentauto_concierge_threads_user_idx
  ON rentauto.concierge_threads(user_id);
CREATE INDEX IF NOT EXISTS rentauto_host_applications_reviewer_idx
  ON rentauto.host_applications(reviewer_user_id)
  WHERE reviewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rentauto_reviews_reviewer_idx
  ON rentauto.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS rentauto_support_trip_idx
  ON rentauto.support_tickets(trip_id)
  WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rentauto_travel_itineraries_user_idx
  ON rentauto.travel_itineraries(user_id);
CREATE INDEX IF NOT EXISTS rentauto_trip_events_actor_idx
  ON rentauto.trip_events(actor_user_id)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rentauto_tracking_sessions_guest_idx
  ON rentauto.trip_tracking_sessions(guest_id);
CREATE INDEX IF NOT EXISTS rentauto_tracking_sessions_host_idx
  ON rentauto.trip_tracking_sessions(host_id);

CREATE INDEX IF NOT EXISTS source_payment_summaries_source_profile_idx
  ON public.source_payment_summaries("sourceProfileId");
CREATE INDEX IF NOT EXISTS source_sync_events_identity_idx
  ON public.source_synchronization_events("identityId");
CREATE INDEX IF NOT EXISTS source_sync_events_source_profile_idx
  ON public.source_synchronization_events("sourceProfileId");

DROP POLICY IF EXISTS rentauto_accounts_admin_select ON rentauto.accounts;
DROP POLICY IF EXISTS rentauto_accounts_self_select ON rentauto.accounts;
CREATE POLICY rentauto_accounts_select
ON rentauto.accounts
FOR SELECT TO authenticated
USING (
  auth_user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_roles_admin_select ON rentauto.account_roles;
DROP POLICY IF EXISTS rentauto_roles_self_select ON rentauto.account_roles;
CREATE POLICY rentauto_roles_select
ON rentauto.account_roles
FOR SELECT TO authenticated
USING (
  auth_user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_host_applications_admin_read
  ON rentauto.host_applications;
DROP POLICY IF EXISTS rentauto_host_applications_self_read
  ON rentauto.host_applications;
CREATE POLICY rentauto_host_applications_read
ON rentauto.host_applications
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

DROP POLICY IF EXISTS rentauto_availability_host_manage
  ON rentauto.availability_blocks;
CREATE POLICY rentauto_availability_host_insert
ON rentauto.availability_blocks
FOR INSERT TO authenticated
WITH CHECK (
  type <> 'booking_self'
  AND EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_availability_host_update
ON rentauto.availability_blocks
FOR UPDATE TO authenticated
USING (
  type <> 'booking_self'
  AND EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
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
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_availability_host_delete
ON rentauto.availability_blocks
FOR DELETE TO authenticated
USING (
  type <> 'booking_self'
  AND EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_extras_host_manage ON rentauto.car_extras;
CREATE POLICY rentauto_car_extras_host_insert
ON rentauto.car_extras
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_car_extras_host_update
ON rentauto.car_extras
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_car_extras_host_delete
ON rentauto.car_extras
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

DROP POLICY IF EXISTS rentauto_car_policies_host_manage ON rentauto.car_policies;
CREATE POLICY rentauto_car_policies_host_insert
ON rentauto.car_policies
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_car_policies_host_update
ON rentauto.car_policies
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);
CREATE POLICY rentauto_car_policies_host_delete
ON rentauto.car_policies
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_cars_read ON rentauto.cars
USING (
  status = 'active'
  OR host_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_cars_host_insert ON rentauto.cars
WITH CHECK (
  host_id = (select auth.uid())
  AND (
    rentauto.has_role('host'::rentauto.app_role)
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

ALTER POLICY rentauto_cars_host_update ON rentauto.cars
USING (
  host_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
)
WITH CHECK (
  host_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_cars_host_delete ON rentauto.cars
USING (
  host_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_car_photos_read ON rentauto.car_photos
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.status = 'active'
        OR c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_car_photos_host_insert ON rentauto.car_photos
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_car_photos_host_delete ON rentauto.car_photos
USING (
  EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_car_extras_read ON rentauto.car_extras
USING (
  is_active
  OR EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_favorites_self ON rentauto.favorites
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY rentauto_host_preferences_own ON rentauto.host_preferences
USING (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
)
WITH CHECK (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_host_verifications_read ON rentauto.host_verifications
USING (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_host_verifications_submit ON rentauto.host_verifications
WITH CHECK (
  user_id = (select auth.uid())
  AND verification_status IN ('not_started','pending')
);

ALTER POLICY rentauto_host_verifications_resubmit ON rentauto.host_verifications
USING (user_id = (select auth.uid()))
WITH CHECK (
  user_id = (select auth.uid())
  AND verification_status IN ('not_started','pending')
);

ALTER POLICY rentauto_notifications_read ON rentauto.notifications
USING (user_id = (select auth.uid()));

ALTER POLICY rentauto_notifications_mark_read ON rentauto.notifications
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY rentauto_reviews_completed_trip_insert ON rentauto.reviews
WITH CHECK (
  reviewer_id = (select auth.uid())
  AND trip_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    WHERE t.id = trip_id
      AND t.guest_id = (select auth.uid())
      AND t.car_id = car_id
      AND t.status = 'completed'
  )
);

ALTER POLICY rentauto_stripe_accounts_read ON rentauto.stripe_accounts
USING (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_support_read ON rentauto.support_tickets
USING (
  user_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_support_insert ON rentauto.support_tickets
WITH CHECK (
  user_id = (select auth.uid())
  AND status = 'open'
  AND (
    trip_id IS NULL
    OR EXISTS (
      SELECT 1 FROM rentauto.trips t
      WHERE t.id = trip_id
        AND t.guest_id = (select auth.uid())
    )
  )
);

ALTER POLICY rentauto_travel_itineraries_self ON rentauto.travel_itineraries
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY rentauto_concierge_threads_self ON rentauto.concierge_threads
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY rentauto_concierge_messages_select ON rentauto.concierge_messages
USING (user_id = (select auth.uid()));

ALTER POLICY rentauto_concierge_messages_insert ON rentauto.concierge_messages
WITH CHECK (
  user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM rentauto.concierge_threads t
    WHERE t.id = thread_id
      AND t.user_id = (select auth.uid())
  )
);

ALTER POLICY rentauto_concierge_messages_delete ON rentauto.concierge_messages
USING (user_id = (select auth.uid()));

ALTER POLICY rentauto_trips_participants_read ON rentauto.trips
USING (
  guest_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM rentauto.cars c
    WHERE c.id = car_id
      AND c.host_id = (select auth.uid())
  )
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_trip_events_participants_read ON rentauto.trip_events
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (
        t.guest_id = (select auth.uid())
        OR c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_incidents_read ON rentauto.trip_incidents
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (
        t.guest_id = (select auth.uid())
        OR c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_incidents_insert ON rentauto.trip_incidents
WITH CHECK (
  reporter_user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND (
        t.guest_id = (select auth.uid())
        OR c.host_id = (select auth.uid())
      )
  )
);

ALTER POLICY rentauto_tracking_sessions_read ON rentauto.trip_tracking_sessions
USING (
  guest_id = (select auth.uid())
  OR host_id = (select auth.uid())
  OR rentauto.has_role('admin'::rentauto.app_role)
);

ALTER POLICY rentauto_tracking_devices_read ON rentauto.vehicle_tracking_devices
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id = car_id
      AND (
        c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

ALTER POLICY rentauto_location_events_read ON rentauto.vehicle_location_events
USING (
  EXISTS (
    SELECT 1
    FROM rentauto.trips t
    JOIN rentauto.cars c ON c.id = t.car_id
    WHERE t.id = trip_id
      AND t.status = 'active'
      AND (
        t.guest_id = (select auth.uid())
        OR c.host_id = (select auth.uid())
        OR rentauto.has_role('admin'::rentauto.app_role)
      )
  )
);

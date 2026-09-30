-- Correct the outer-row correlation in Rentauto review creation.
-- A review may only be created for the same vehicle as the completed trip.

ALTER POLICY rentauto_reviews_completed_trip_insert ON rentauto.reviews
WITH CHECK (
  reviewer_id = (select auth.uid())
  AND trip_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM rentauto.trips t
    WHERE t.id = reviews.trip_id
      AND t.guest_id = (select auth.uid())
      AND t.car_id = reviews.car_id
      AND t.status = 'completed'
  )
);

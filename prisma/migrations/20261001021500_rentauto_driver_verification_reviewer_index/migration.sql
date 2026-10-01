CREATE INDEX IF NOT EXISTS driver_verifications_reviewer_user_id_idx
ON rentauto.driver_verifications (reviewer_user_id)
WHERE reviewer_user_id IS NOT NULL;

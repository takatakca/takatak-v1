-- Allow Rentauto users to submit host-verification documents without
-- allowing them to approve themselves or alter reviewer-only fields.

DROP POLICY IF EXISTS rentauto_host_verifications_submit
  ON rentauto.host_verifications;

CREATE POLICY rentauto_host_verifications_submit
ON rentauto.host_verifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verification_status IN ('not_started','pending')
);

DROP POLICY IF EXISTS rentauto_host_verifications_resubmit
  ON rentauto.host_verifications;

CREATE POLICY rentauto_host_verifications_resubmit
ON rentauto.host_verifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND verification_status IN ('not_started','pending')
);

GRANT INSERT (
  user_id,
  id_front_url,
  id_back_url,
  selfie_url,
  verification_status
) ON rentauto.host_verifications TO authenticated;

GRANT UPDATE (
  id_front_url,
  id_back_url,
  selfie_url,
  verification_status
) ON rentauto.host_verifications TO authenticated;

DROP POLICY IF EXISTS rentauto_ids_private_update ON storage.objects;
CREATE POLICY rentauto_ids_private_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rentauto-ids-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'rentauto-ids-private'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

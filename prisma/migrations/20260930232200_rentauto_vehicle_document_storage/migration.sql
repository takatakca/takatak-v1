-- Private vehicle documents for registration and proof of insurance.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rentauto-vehicle-documents',
  'rentauto-vehicle-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS rentauto_vehicle_docs_owner_select ON storage.objects;
CREATE POLICY rentauto_vehicle_docs_owner_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rentauto-vehicle-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_vehicle_docs_owner_insert ON storage.objects;
CREATE POLICY rentauto_vehicle_docs_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rentauto-vehicle-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM rentauto.cars c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.host_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS rentauto_vehicle_docs_owner_update ON storage.objects;
CREATE POLICY rentauto_vehicle_docs_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'rentauto-vehicle-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
)
WITH CHECK (
  bucket_id = 'rentauto-vehicle-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

DROP POLICY IF EXISTS rentauto_vehicle_docs_owner_delete ON storage.objects;
CREATE POLICY rentauto_vehicle_docs_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rentauto-vehicle-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR rentauto.has_role('admin'::rentauto.app_role)
  )
);

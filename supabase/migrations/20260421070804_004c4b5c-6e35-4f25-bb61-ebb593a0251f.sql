UPDATE storage.buckets
SET public = false
WHERE id = 'host-logos';

DROP POLICY IF EXISTS "Hosts can view logo files" ON storage.objects;

CREATE POLICY "Hosts can view their own logo files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Hosts can view their own host profile"
ON public.host_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
-- Add optional logo_url column to clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url text;

-- Ensure storage policies exist for host-logos bucket scoped to the user's own folder.
-- These are idempotent via DROP ... IF EXISTS then CREATE.
DROP POLICY IF EXISTS "Hosts can read own host-logos objects" ON storage.objects;
CREATE POLICY "Hosts can read own host-logos objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Hosts can insert own host-logos objects" ON storage.objects;
CREATE POLICY "Hosts can insert own host-logos objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Hosts can update own host-logos objects" ON storage.objects;
CREATE POLICY "Hosts can update own host-logos objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Hosts can delete own host-logos objects" ON storage.objects;
CREATE POLICY "Hosts can delete own host-logos objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
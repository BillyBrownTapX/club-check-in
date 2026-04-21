ALTER TABLE public.host_profiles
ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('host-logos', 'host-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Hosts can view logo files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'host-logos');

CREATE POLICY "Hosts can upload their own logo files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Hosts can update their own logo files"
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

CREATE POLICY "Hosts can delete their own logo files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'host-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can update their own logo url"
ON public.host_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
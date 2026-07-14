ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS allowed_email_domains text[] NOT NULL DEFAULT '{}';

UPDATE public.universities
SET allowed_email_domains = ARRAY['ung.edu']
WHERE slug = 'university-of-north-georgia-dahlonega'
   OR lower(name) LIKE '%university of north georgia%';
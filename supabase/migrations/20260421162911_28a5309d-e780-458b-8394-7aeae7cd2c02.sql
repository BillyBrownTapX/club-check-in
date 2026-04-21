INSERT INTO public.universities (name, slug)
VALUES ('University of North Georgia, Dahlonega Campus', 'university-of-north-georgia-dahlonega')
ON CONFLICT (slug) DO NOTHING;
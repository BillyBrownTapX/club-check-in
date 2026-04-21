DROP POLICY IF EXISTS "Authenticated users can create universities" ON public.universities;

CREATE POLICY "Authenticated users can create universities"
ON public.universities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
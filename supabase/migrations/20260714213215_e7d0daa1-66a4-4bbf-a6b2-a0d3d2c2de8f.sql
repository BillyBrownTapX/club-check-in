DROP POLICY IF EXISTS "Authenticated users can create universities" ON public.universities;

CREATE POLICY "Admins can create universities"
  ON public.universities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
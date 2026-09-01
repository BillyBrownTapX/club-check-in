CREATE OR REPLACE FUNCTION public.owner_admin_guard()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allowed callers: the owner's own authenticated session, or trusted
  -- server-side code running as service_role (which verifies the owner first).
  -- current_setting('role') reflects the request role set by the API layer;
  -- current_user is unreliable here because this function is SECURITY DEFINER.
  IF NOT (
    public.is_owner_admin()
    OR current_setting('role', true) = 'service_role'
    OR pg_has_role(session_user, 'service_role', 'member')
  ) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
END;
$$;
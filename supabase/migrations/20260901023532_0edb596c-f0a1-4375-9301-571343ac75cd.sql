CREATE OR REPLACE FUNCTION public.owner_admin_guard()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow the owner's own authenticated session, or trusted server-side code
  -- (service role) which performs the owner check before it calls in.
  IF NOT (public.is_owner_admin() OR current_user = 'service_role') THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_admin_guard() FROM authenticated;
REVOKE ALL ON FUNCTION public.owner_admin_guard() FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_admin_guard() TO service_role;

REVOKE ALL ON FUNCTION public.owner_admin_club_stats() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_club_stats() TO service_role;

REVOKE ALL ON FUNCTION public.owner_admin_overview() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_overview() TO service_role;

REVOKE ALL ON FUNCTION public.owner_admin_series(timestamptz, timestamptz, text) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_series(timestamptz, timestamptz, text) TO service_role;

REVOKE ALL ON FUNCTION public.owner_admin_organizations(text, text, uuid, text, text, int, int) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_organizations(text, text, uuid, text, text, int, int) TO service_role;

REVOKE ALL ON FUNCTION public.owner_admin_organization_detail(uuid) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_organization_detail(uuid) TO service_role;
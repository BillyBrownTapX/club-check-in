
-- Lock down EXECUTE on SECURITY DEFINER functions.
-- Trigger-only helpers: revoke from public entirely.
REVOKE EXECUTE ON FUNCTION public.handle_new_host_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_event_university_from_club() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_club_university_to_events() FROM PUBLIC;

-- Host-scoped helpers: only signed-in users may execute; used inside RLS policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_event_host(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_student_visible_to_host(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_visible_to_host(uuid) TO authenticated;

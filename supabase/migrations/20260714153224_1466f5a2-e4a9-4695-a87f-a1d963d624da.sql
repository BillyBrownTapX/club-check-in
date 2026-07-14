
REVOKE EXECUTE ON FUNCTION public.handle_new_host_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_event_university_from_club() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_club_university_to_events() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_event_host(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_student_visible_to_host(uuid) FROM anon;

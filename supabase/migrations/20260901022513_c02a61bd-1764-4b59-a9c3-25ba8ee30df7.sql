-- Owner-admin gate: true only for the application owner's authenticated account.
CREATE OR REPLACE FUNCTION public.is_owner_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'billy.brown@ingresssoftware.com'
  );
$$;

REVOKE ALL ON FUNCTION public.is_owner_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_admin() TO service_role;

-- Forward-looking analytics/telemetry stream.
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid,
  club_id uuid,
  event_id uuid,
  student_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner admin can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_owner_admin());

CREATE INDEX analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX analytics_events_type_created_at_idx ON public.analytics_events (event_type, created_at DESC);
CREATE INDEX analytics_events_club_idx ON public.analytics_events (club_id, created_at DESC);

-- Dashboard performance indexes.
CREATE INDEX IF NOT EXISTS attendance_records_checked_in_at_idx ON public.attendance_records (checked_in_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_event_idx ON public.attendance_records (event_id);
CREATE INDEX IF NOT EXISTS attendance_records_student_idx ON public.attendance_records (student_id);
CREATE INDEX IF NOT EXISTS events_club_idx ON public.events (club_id, event_date DESC);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events (created_at DESC);
CREATE INDEX IF NOT EXISTS students_created_at_idx ON public.students (created_at DESC);
CREATE INDEX IF NOT EXISTS clubs_created_at_idx ON public.clubs (created_at DESC);
CREATE INDEX IF NOT EXISTS club_members_user_idx ON public.club_members (user_id);
CREATE INDEX IF NOT EXISTS pre_check_ins_event_idx ON public.pre_check_ins (event_id);
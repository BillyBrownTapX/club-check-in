-- Host activity feed: real milestones (first check-in, threshold reached, check-in closed).

CREATE TYPE public.host_activity_type AS ENUM ('first_check_in', 'threshold_reached', 'check_in_closed');

CREATE TABLE public.host_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  activity_type public.host_activity_type NOT NULL,
  threshold INT,
  attendance_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: check-ins race, and best-effort writers rely on unique conflicts
-- being swallowed so a milestone lands exactly once per event.
CREATE UNIQUE INDEX host_activity_first_check_in_uniq
  ON public.host_activity(event_id)
  WHERE activity_type = 'first_check_in';

CREATE UNIQUE INDEX host_activity_check_in_closed_uniq
  ON public.host_activity(event_id)
  WHERE activity_type = 'check_in_closed';

CREATE UNIQUE INDEX host_activity_threshold_uniq
  ON public.host_activity(event_id, threshold)
  WHERE activity_type = 'threshold_reached';

CREATE INDEX host_activity_club_created_idx
  ON public.host_activity(club_id, created_at DESC);

GRANT SELECT ON public.host_activity TO authenticated;
GRANT ALL ON public.host_activity TO service_role;

ALTER TABLE public.host_activity ENABLE ROW LEVEL SECURITY;

-- Members of the club can read its activity. No INSERT/UPDATE/DELETE policy —
-- writes only happen via service_role in server functions after a successful
-- mutation.
CREATE POLICY "Club members read host activity"
  ON public.host_activity
  FOR SELECT
  TO authenticated
  USING (public.is_club_member(club_id));

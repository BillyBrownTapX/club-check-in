-- Composite indexes to back the heaviest read paths.
--
-- 1) events list per host: filtered by club_id, ordered by event_date then start_time.
--    Today only idx_events_club_id (single column) exists, so the planner has to
--    sort the result set in memory. The composite index lets the planner stream
--    rows already in the desired order.
CREATE INDEX IF NOT EXISTS idx_events_club_date_start
  ON public.events (club_id, event_date, start_time);

-- 2) attendance roster per event: filtered by event_id, ordered by checked_in_at DESC.
--    Backs getEventOperations and exportEventAttendance.
CREATE INDEX IF NOT EXISTS idx_attendance_records_event_checked_in
  ON public.attendance_records (event_id, checked_in_at DESC);

-- 3) recent action log per event: filtered by event_id, ordered by created_at DESC, limit 30.
--    Backs both getEventOperations and getEventDisplayPayload.
CREATE INDEX IF NOT EXISTS idx_attendance_actions_event_created
  ON public.attendance_actions (event_id, created_at DESC);
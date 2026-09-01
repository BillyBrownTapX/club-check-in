CREATE OR REPLACE FUNCTION public.owner_admin_people()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  month_start timestamptz := date_trunc('month', now());
  prev_month_start timestamptz := date_trunc('month', now()) - interval '1 month';
BEGIN
  PERFORM public.owner_admin_guard();

  WITH per_student AS (
    SELECT student_id, count(*)::int AS visits
    FROM public.attendance_records
    GROUP BY student_id
  ),
  last_month AS (
    SELECT DISTINCT student_id
    FROM public.attendance_records
    WHERE checked_in_at >= prev_month_start AND checked_in_at < month_start
  ),
  this_month AS (
    SELECT DISTINCT student_id
    FROM public.attendance_records
    WHERE checked_in_at >= month_start
  )
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'total', (SELECT count(*) FROM public.students),
      'newThisMonth', (SELECT count(*) FROM public.students WHERE created_at >= month_start),
      'checkedIn', (SELECT count(*) FROM per_student),
      'repeat', (SELECT count(*) FROM per_student WHERE visits >= 2)
    ),
    'hosts', jsonb_build_object(
      'total', (SELECT count(*) FROM public.host_profiles),
      'newThisMonth', (SELECT count(*) FROM public.host_profiles WHERE created_at >= month_start),
      'organizations', (SELECT count(*) FROM public.clubs),
      'withOrganization', (SELECT count(DISTINCT user_id) FROM public.club_members)
    ),
    'checkIns', jsonb_build_object(
      'total', (SELECT count(*) FROM public.attendance_records),
      'thisMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= month_start),
      'previousMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= prev_month_start AND checked_in_at < month_start),
      'monthLabel', to_char(now(), 'FMMonth YYYY')
    ),
    'frequency', jsonb_build_array(
      jsonb_build_object('label', 'Came once', 'people', (SELECT count(*) FROM per_student WHERE visits = 1)),
      jsonb_build_object('label', 'Came 2-4 times', 'people', (SELECT count(*) FROM per_student WHERE visits BETWEEN 2 AND 4)),
      jsonb_build_object('label', 'Came 5+ times', 'people', (SELECT count(*) FROM per_student WHERE visits >= 5))
    ),
    'returning', jsonb_build_object(
      'lastMonthAttendees', (SELECT count(*) FROM last_month),
      'returnedThisMonth', (SELECT count(*) FROM last_month l WHERE EXISTS (SELECT 1 FROM this_month t WHERE t.student_id = l.student_id))
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_people() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_people() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_people() TO service_role;
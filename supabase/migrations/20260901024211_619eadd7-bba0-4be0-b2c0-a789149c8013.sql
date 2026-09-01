-- ── Users ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_users(
  _q text DEFAULT NULL,
  _limit int DEFAULT 25,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_count int;
  lim int := LEAST(GREATEST(COALESCE(_limit, 25), 1), 200);
  off int := GREATEST(COALESCE(_offset, 0), 0);
  needle text := NULLIF(btrim(COALESCE(_q, '')), '');
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT count(*)::int INTO total_count
  FROM public.host_profiles hp
  WHERE needle IS NULL OR hp.full_name ILIKE '%' || needle || '%' OR hp.email ILIKE '%' || needle || '%';

  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'total', (SELECT count(*) FROM public.host_profiles),
      'newToday', (SELECT count(*) FROM public.host_profiles WHERE created_at >= date_trunc('day', now())),
      'newThisWeek', (SELECT count(*) FROM public.host_profiles WHERE created_at >= now() - interval '7 days'),
      'newThisMonth', (SELECT count(*) FROM public.host_profiles WHERE created_at >= date_trunc('month', now())),
      'dau', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '1 day'),
      'wau', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
      'mau', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days'),
      'disabled', (SELECT count(*) FROM public.host_profiles WHERE is_disabled),
      'avgAdminsPerOrganization', (
        SELECT COALESCE(round(avg(cnt)::numeric, 2), 0) FROM (
          SELECT count(*) AS cnt FROM public.club_members GROUP BY club_id
        ) x
      ),
      'withoutOrganization', (
        SELECT count(*) FROM public.host_profiles hp
        WHERE NOT EXISTS (SELECT 1 FROM public.club_members m WHERE m.user_id = hp.id)
      ),
      'createdOrgNeverUsed', (
        SELECT count(DISTINCT m.user_id) FROM public.club_members m
        WHERE m.role = 'owner'
          AND NOT EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.attendance_records a ON a.event_id = e.id
            WHERE e.club_id = m.club_id
          )
      )
    ),
    'total', total_count,
    'limit', lim,
    'offset', off,
    'rows', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'createdAt') DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', hp.id,
          'name', hp.full_name,
          'email', hp.email,
          'createdAt', hp.created_at,
          'isDisabled', hp.is_disabled,
          'lastSignInAt', u.last_sign_in_at,
          'organizations', (SELECT count(*) FROM public.club_members m WHERE m.user_id = hp.id),
          'roles', (
            SELECT COALESCE(string_agg(DISTINCT m.role::text, ', '), 'none')
            FROM public.club_members m WHERE m.user_id = hp.id
          ),
          'eventsCreated', (
            SELECT count(*) FROM public.events e
            WHERE e.club_id IN (SELECT club_id FROM public.club_members m WHERE m.user_id = hp.id)
          ),
          'isStaffAdmin', EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = hp.id AND ur.role = 'admin')
        ) AS r
        FROM public.host_profiles hp
        LEFT JOIN auth.users u ON u.id = hp.id
        WHERE needle IS NULL OR hp.full_name ILIKE '%' || needle || '%' OR hp.email ILIKE '%' || needle || '%'
        ORDER BY hp.created_at DESC
        LIMIT lim OFFSET off
      ) rows
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Members ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_members(
  _q text DEFAULT NULL,
  _limit int DEFAULT 25,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_count int;
  lim int := LEAST(GREATEST(COALESCE(_limit, 25), 1), 200);
  off int := GREATEST(COALESCE(_offset, 0), 0);
  needle text := NULLIF(btrim(COALESCE(_q, '')), '');
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT count(*)::int INTO total_count
  FROM public.students s
  WHERE needle IS NULL
    OR (s.first_name || ' ' || s.last_name) ILIKE '%' || needle || '%'
    OR s.student_email ILIKE '%' || needle || '%';

  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'total', (SELECT count(*) FROM public.students),
      'newToday', (SELECT count(*) FROM public.students WHERE created_at >= date_trunc('day', now())),
      'newThisWeek', (SELECT count(*) FROM public.students WHERE created_at >= now() - interval '7 days'),
      'newThisMonth', (SELECT count(*) FROM public.students WHERE created_at >= date_trunc('month', now())),
      'withAttendance', (SELECT count(DISTINCT student_id) FROM public.attendance_records),
      'withoutAttendance', (
        SELECT count(*) FROM public.students s
        WHERE NOT EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.student_id = s.id)
      ),
      'repeatAttendees', (
        SELECT count(*) FROM (
          SELECT student_id FROM public.attendance_records GROUP BY student_id HAVING count(*) > 1
        ) x
      ),
      'avgEventsPerMember', (
        SELECT COALESCE(round(avg(c)::numeric, 1), 0) FROM (
          SELECT count(DISTINCT event_id) AS c FROM public.attendance_records GROUP BY student_id
        ) y
      ),
      'avgPerOrganization', (
        SELECT COALESCE(round(avg(c)::numeric, 1), 0) FROM (
          SELECT count(DISTINCT a.student_id) AS c
          FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id
          GROUP BY e.club_id
        ) z
      )
    ),
    'total', total_count,
    'limit', lim,
    'offset', off,
    'rows', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'createdAt') DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', s.id,
          'name', s.first_name || ' ' || s.last_name,
          'email', s.student_email,
          'university', un.name,
          'createdAt', s.created_at,
          'checkIns', (SELECT count(*) FROM public.attendance_records a WHERE a.student_id = s.id),
          'eventsAttended', (SELECT count(DISTINCT a.event_id) FROM public.attendance_records a WHERE a.student_id = s.id),
          'organizations', (
            SELECT count(DISTINCT e.club_id) FROM public.attendance_records a
            JOIN public.events e ON e.id = a.event_id WHERE a.student_id = s.id
          ),
          'firstAttendance', (SELECT min(a.checked_in_at) FROM public.attendance_records a WHERE a.student_id = s.id),
          'lastAttendance', (SELECT max(a.checked_in_at) FROM public.attendance_records a WHERE a.student_id = s.id)
        ) AS r
        FROM public.students s
        LEFT JOIN public.universities un ON un.id = s.university_id
        WHERE needle IS NULL
          OR (s.first_name || ' ' || s.last_name) ILIKE '%' || needle || '%'
          OR s.student_email ILIKE '%' || needle || '%'
        ORDER BY s.created_at DESC
        LIMIT lim OFFSET off
      ) rows
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Events ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_events(
  _q text DEFAULT NULL,
  _club_id uuid DEFAULT NULL,
  _from date DEFAULT NULL,
  _to date DEFAULT NULL,
  _limit int DEFAULT 25,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_count int;
  lim int := LEAST(GREATEST(COALESCE(_limit, 25), 1), 200);
  off int := GREATEST(COALESCE(_offset, 0), 0);
  needle text := NULLIF(btrim(COALESCE(_q, '')), '');
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT count(*)::int INTO total_count
  FROM public.events e
  WHERE (needle IS NULL OR e.event_name ILIKE '%' || needle || '%')
    AND (_club_id IS NULL OR e.club_id = _club_id)
    AND (_from IS NULL OR e.event_date >= _from)
    AND (_to IS NULL OR e.event_date <= _to);

  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'total', (SELECT count(*) FROM public.events),
      'today', (SELECT count(*) FROM public.events WHERE event_date = current_date),
      'thisWeek', (SELECT count(*) FROM public.events WHERE event_date >= current_date - 7),
      'thisMonth', (SELECT count(*) FROM public.events WHERE event_date >= date_trunc('month', now())::date),
      'avgPerOrganization', (
        SELECT COALESCE(round((SELECT count(*) FROM public.events)::numeric / NULLIF((SELECT count(*) FROM public.clubs), 0), 1), 0)
      ),
      'avgAttendance', (
        SELECT COALESCE(round(avg(c)::numeric, 1), 0) FROM (
          SELECT count(a.id) AS c FROM public.events e LEFT JOIN public.attendance_records a ON a.event_id = e.id GROUP BY e.id
        ) x
      ),
      'medianAttendance', (
        SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY c), 0) FROM (
          SELECT count(a.id)::numeric AS c FROM public.events e LEFT JOIN public.attendance_records a ON a.event_id = e.id GROUP BY e.id
        ) y
      ),
      'zeroAttendance', (
        SELECT count(*) FROM public.events e
        WHERE NOT EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.event_id = e.id)
      ),
      'largestEvent', (
        SELECT jsonb_build_object('name', e.event_name, 'checkIns', count(a.id), 'date', e.event_date)
        FROM public.events e JOIN public.attendance_records a ON a.event_id = e.id
        GROUP BY e.id, e.event_name, e.event_date ORDER BY count(a.id) DESC LIMIT 1
      ),
      'mostActiveOrganization', (
        SELECT jsonb_build_object('name', c.club_name, 'checkIns', count(a.id))
        FROM public.clubs c
        JOIN public.events e ON e.club_id = c.id
        JOIN public.attendance_records a ON a.event_id = e.id
        GROUP BY c.id, c.club_name ORDER BY count(a.id) DESC LIMIT 1
      )
    ),
    'total', total_count,
    'limit', lim,
    'offset', off,
    'rows', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'date') DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id', e.id,
          'name', e.event_name,
          'organization', c.club_name,
          'clubId', c.id,
          'date', e.event_date,
          'createdAt', e.created_at,
          'checkIns', (SELECT count(*) FROM public.attendance_records a WHERE a.event_id = e.id),
          'uniqueAttendees', (SELECT count(DISTINCT a.student_id) FROM public.attendance_records a WHERE a.event_id = e.id),
          'preCheckIns', (SELECT count(*) FROM public.pre_check_ins p WHERE p.event_id = e.id),
          'status', CASE
            WHEN e.is_archived THEN 'archived'
            WHEN NOT e.is_active THEN 'inactive'
            WHEN now() < e.check_in_opens_at THEN 'upcoming'
            WHEN now() BETWEEN e.check_in_opens_at AND e.check_in_closes_at THEN 'live'
            ELSE 'completed'
          END
        ) AS r
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE (needle IS NULL OR e.event_name ILIKE '%' || needle || '%')
          AND (_club_id IS NULL OR e.club_id = _club_id)
          AND (_from IS NULL OR e.event_date >= _from)
          AND (_to IS NULL OR e.event_date <= _to)
        ORDER BY e.event_date DESC
        LIMIT lim OFFSET off
      ) rows
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Attendance ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_attendance(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'lifetime', (SELECT count(*) FROM public.attendance_records),
      'today', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= date_trunc('day', now())),
      'thisWeek', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= now() - interval '7 days'),
      'thisMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= date_trunc('month', now())),
      'inRange', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= _from AND checked_in_at < _to),
      'uniqueAttendees', (SELECT count(DISTINCT student_id) FROM public.attendance_records),
      'avgPerEvent', (
        SELECT COALESCE(round((SELECT count(*) FROM public.attendance_records)::numeric / NULLIF((SELECT count(*) FROM public.events), 0), 1), 0)
      ),
      'avgPerOrganization', (
        SELECT COALESCE(round((SELECT count(*) FROM public.attendance_records)::numeric / NULLIF((SELECT count(*) FROM public.clubs), 0), 1), 0)
      ),
      'repeatRate', (
        SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE c > 1) / NULLIF(count(*), 0), 1), 0)
        FROM (SELECT student_id, count(*) AS c FROM public.attendance_records GROUP BY student_id) x
      ),
      'preCheckIns', (SELECT count(*) FROM public.pre_check_ins),
      'methodBreakdown', (
        SELECT COALESCE(jsonb_object_agg(check_in_method, cnt), '{}'::jsonb)
        FROM (SELECT check_in_method::text, count(*) AS cnt FROM public.attendance_records GROUP BY 1) m
      ),
      'duplicateAttempts', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'duplicate_check_in_attempt'),
      'failedAttempts', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'check_in_failed')
    ),
    'byDayOfWeek', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'checkIns', cnt) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT EXTRACT(DOW FROM checked_in_at)::int AS d, count(*) AS cnt
        FROM public.attendance_records WHERE checked_in_at >= _from AND checked_in_at < _to GROUP BY 1
      ) x
    ),
    'byHour', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', h, 'checkIns', cnt) ORDER BY h), '[]'::jsonb)
      FROM (
        SELECT EXTRACT(HOUR FROM checked_in_at)::int AS h, count(*) AS cnt
        FROM public.attendance_records WHERE checked_in_at >= _from AND checked_in_at < _to GROUP BY 1
      ) y
    ),
    'topOrganizations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', club_name, 'clubId', club_id, 'checkIns', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT c.id AS club_id, c.club_name, count(*) AS cnt
        FROM public.attendance_records a
        JOIN public.events e ON e.id = a.event_id
        JOIN public.clubs c ON c.id = e.club_id
        WHERE a.checked_in_at >= _from AND a.checked_in_at < _to
        GROUP BY c.id, c.club_name ORDER BY cnt DESC LIMIT 10
      ) z
    ),
    'largestEvents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', event_name, 'eventId', id, 'date', event_date, 'checkIns', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT e.id, e.event_name, e.event_date, count(*) AS cnt
        FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id
        WHERE a.checked_in_at >= _from AND a.checked_in_at < _to
        GROUP BY e.id, e.event_name, e.event_date ORDER BY cnt DESC LIMIT 10
      ) w
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Activation ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_activation()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.owner_admin_guard();

  WITH s AS (SELECT * FROM public.owner_admin_club_stats()),
  accounts AS (SELECT count(*)::int AS c FROM public.host_profiles)
  SELECT jsonb_build_object(
    'funnel', jsonb_build_array(
      jsonb_build_object('stage', 'Account created', 'count', (SELECT c FROM accounts)),
      jsonb_build_object('stage', 'Organization created', 'count', (SELECT count(DISTINCT owner_id)::int FROM s)),
      jsonb_build_object('stage', 'Members added', 'count', (SELECT count(*)::int FROM s WHERE member_count > 0)),
      jsonb_build_object('stage', 'First event created', 'count', (SELECT count(*)::int FROM s WHERE event_count > 0)),
      jsonb_build_object('stage', 'First check-in', 'count', (SELECT count(*)::int FROM s WHERE checkins_total > 0)),
      jsonb_build_object('stage', 'Second event created', 'count', (SELECT count(*)::int FROM s WHERE event_count > 1))
    ),
    'activationRate', (
      SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE checkins_total > 0) / NULLIF(count(*), 0), 1), 0) FROM s
    ),
    'timings', jsonb_build_object(
      'signupToOrganizationDays', (
        SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (s.created_at - hp.created_at)) / 86400)::numeric, 1), 0)
        FROM s JOIN public.host_profiles hp ON hp.id = s.owner_id
      ),
      'organizationToFirstEventDays', (
        SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (s.first_event_created_at - s.created_at)) / 86400)::numeric, 1), 0)
        FROM s WHERE s.first_event_created_at IS NOT NULL
      ),
      'organizationToFirstCheckInDays', (
        SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (s.first_checkin_at - s.created_at)) / 86400)::numeric, 1), 0)
        FROM s WHERE s.first_checkin_at IS NOT NULL
      ),
      'firstToSecondEventDays', (
        SELECT COALESCE(round(avg(EXTRACT(EPOCH FROM (s.second_event_created_at - s.first_event_created_at)) / 86400)::numeric, 1), 0)
        FROM s WHERE s.second_event_created_at IS NOT NULL
      )
    ),
    'neverActivated', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'clubId', club_id, 'name', club_name, 'owner', owner_name, 'ownerEmail', owner_email,
        'createdAt', created_at, 'events', event_count, 'members', member_count
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM s WHERE checkins_total = 0
    ),
    'stalled', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'clubId', club_id, 'name', club_name, 'owner', owner_name, 'ownerEmail', owner_email,
        'createdAt', created_at, 'events', event_count, 'members', member_count,
        'reason', CASE WHEN event_count = 0 THEN 'No events created' ELSE 'Events created, no check-ins' END
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM s WHERE checkins_total = 0 AND (member_count > 0 OR event_count > 0)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Retention ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_retention()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.owner_admin_guard();

  WITH s AS (SELECT * FROM public.owner_admin_club_stats()),
  activity AS (
    SELECT e.club_id, date_trunc('month', a.checked_in_at) AS month
    FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id
    GROUP BY 1, 2
  ),
  cohorts AS (
    SELECT c.id AS club_id, date_trunc('month', c.created_at) AS cohort
    FROM public.clubs c
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'retained7d', (
        SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE last_checkin_at >= now() - interval '7 days') / NULLIF(count(*) FILTER (WHERE checkins_total > 0), 0), 1), 0) FROM s
      ),
      'retained30d', (
        SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE last_checkin_at >= now() - interval '30 days') / NULLIF(count(*) FILTER (WHERE checkins_total > 0), 0), 1), 0) FROM s
      ),
      'retained60d', (
        SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE last_checkin_at >= now() - interval '60 days') / NULLIF(count(*) FILTER (WHERE checkins_total > 0), 0), 1), 0) FROM s
      ),
      'retained90d', (
        SELECT COALESCE(round(100.0 * count(*) FILTER (WHERE last_checkin_at >= now() - interval '90 days') / NULLIF(count(*) FILTER (WHERE checkins_total > 0), 0), 1), 0) FROM s
      ),
      'dormant', (SELECT count(*)::int FROM s WHERE checkins_total > 0 AND last_checkin_at < now() - interval '60 days'),
      'atRisk', (SELECT count(*)::int FROM s WHERE last_checkin_at < now() - interval '30 days' AND last_checkin_at >= now() - interval '60 days'),
      'reactivated', (
        SELECT count(*)::int FROM (
          SELECT club_id FROM activity GROUP BY club_id
          HAVING max(month) >= date_trunc('month', now() - interval '1 month')
            AND count(*) > 1
            AND max(month) - min(month) > interval '2 months'
        ) r
      ),
      'avgDaysBetweenEvents', (
        SELECT COALESCE(round(avg(gap)::numeric, 1), 0) FROM (
          SELECT (event_date - lag(event_date) OVER (PARTITION BY club_id ORDER BY event_date)) AS gap
          FROM public.events
        ) g WHERE gap IS NOT NULL
      )
    ),
    'cohorts', (
      SELECT COALESCE(jsonb_agg(row ORDER BY row->>'cohort'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'cohort', to_char(co.cohort, 'YYYY-MM'),
          'size', count(DISTINCT co.club_id),
          'months', (
            SELECT jsonb_agg(jsonb_build_object(
              'offset', m.n,
              'retained', (
                SELECT count(DISTINCT ac.club_id)
                FROM activity ac
                WHERE ac.club_id IN (SELECT club_id FROM cohorts c2 WHERE c2.cohort = co.cohort)
                  AND ac.month = co.cohort + (m.n || ' months')::interval
              )
            ) ORDER BY m.n)
            FROM generate_series(0, 5) AS m(n)
            WHERE co.cohort + (m.n || ' months')::interval <= date_trunc('month', now())
          )
        ) AS row
        FROM cohorts co
        GROUP BY co.cohort
      ) rows
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── Product usage ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_product_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  club_total int;
BEGIN
  PERFORM public.owner_admin_guard();
  SELECT count(*)::int INTO club_total FROM public.clubs;

  SELECT jsonb_build_object(
    'organizationCount', club_total,
    'features', jsonb_build_array(
      jsonb_build_object('key', 'organization_created', 'label', 'Organization creation', 'source', 'historical',
        'total', (SELECT count(*) FROM public.clubs),
        'orgs', (SELECT count(*) FROM public.clubs),
        'last7d', (SELECT count(*) FROM public.clubs WHERE created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.clubs WHERE created_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'event_created', 'label', 'Event creation', 'source', 'historical',
        'total', (SELECT count(*) FROM public.events),
        'orgs', (SELECT count(DISTINCT club_id) FROM public.events),
        'last7d', (SELECT count(*) FROM public.events WHERE created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.events WHERE created_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'qr_check_in', 'label', 'QR check-in', 'source', 'historical',
        'total', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'qr_scan'),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id WHERE a.check_in_method = 'qr_scan'),
        'last7d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'qr_scan' AND checked_in_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'qr_scan' AND checked_in_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'returning_lookup', 'label', 'Returning-student lookup', 'source', 'historical',
        'total', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'returning_lookup'),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id WHERE a.check_in_method = 'returning_lookup'),
        'last7d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'returning_lookup' AND checked_in_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'returning_lookup' AND checked_in_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'remembered_device', 'label', 'Remembered device check-in', 'source', 'historical',
        'total', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'remembered_device'),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id WHERE a.check_in_method = 'remembered_device'),
        'last7d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'remembered_device' AND checked_in_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'remembered_device' AND checked_in_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'host_correction', 'label', 'Manual host check-in / correction', 'source', 'historical',
        'total', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'host_correction'),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.attendance_records a JOIN public.events e ON e.id = a.event_id WHERE a.check_in_method = 'host_correction'),
        'last7d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'host_correction' AND checked_in_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.attendance_records WHERE check_in_method = 'host_correction' AND checked_in_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'pre_check_in', 'label', 'Pre-event check-in', 'source', 'historical',
        'total', (SELECT count(*) FROM public.pre_check_ins),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.pre_check_ins p JOIN public.events e ON e.id = p.event_id),
        'last7d', (SELECT count(*) FROM public.pre_check_ins WHERE checked_in_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.pre_check_ins WHERE checked_in_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'event_templates', 'label', 'Event templates', 'source', 'historical',
        'total', (SELECT count(*) FROM public.event_templates),
        'orgs', (SELECT count(DISTINCT club_id) FROM public.event_templates),
        'last7d', (SELECT count(*) FROM public.event_templates WHERE created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.event_templates WHERE created_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'officer_invites', 'label', 'Officer / admin invitations', 'source', 'historical',
        'total', (SELECT count(*) FROM public.club_members WHERE role = 'officer'),
        'orgs', (SELECT count(DISTINCT club_id) FROM public.club_members WHERE role = 'officer'),
        'last7d', (SELECT count(*) FROM public.club_members WHERE role = 'officer' AND created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.club_members WHERE role = 'officer' AND created_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'attendance_actions', 'label', 'Roster corrections & notes', 'source', 'historical',
        'total', (SELECT count(*) FROM public.attendance_actions),
        'orgs', (SELECT count(DISTINCT e.club_id) FROM public.attendance_actions aa JOIN public.events e ON e.id = aa.event_id),
        'last7d', (SELECT count(*) FROM public.attendance_actions WHERE created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.attendance_actions WHERE created_at >= now() - interval '30 days')),
      jsonb_build_object('key', 'remembered_devices', 'label', 'Remembered device sessions', 'source', 'historical',
        'total', (SELECT count(*) FROM public.student_device_sessions),
        'orgs', 0,
        'last7d', (SELECT count(*) FROM public.student_device_sessions WHERE created_at >= now() - interval '7 days'),
        'last30d', (SELECT count(*) FROM public.student_device_sessions WHERE created_at >= now() - interval '30 days'))
    ),
    'tracked', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', event_type, 'label', event_type, 'source', 'tracked',
        'total', total, 'orgs', orgs, 'last7d', last7d, 'last30d', last30d
      ) ORDER BY total DESC), '[]'::jsonb)
      FROM (
        SELECT event_type,
          count(*) AS total,
          count(DISTINCT club_id) AS orgs,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last7d,
          count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last30d
        FROM public.analytics_events GROUP BY event_type
      ) t
    ),
    'trackingSince', (SELECT min(created_at) FROM public.analytics_events)
  ) INTO result;

  RETURN result;
END;
$$;

-- ── System health ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_admin_system_health(_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lim int := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT jsonb_build_object(
    'trackingSince', (SELECT min(created_at) FROM public.analytics_events),
    'counts', jsonb_build_object(
      'checkInFailed', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'check_in_failed'),
      'duplicateCheckIn', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'duplicate_check_in_attempt'),
      'rateLimited', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'check_in_rate_limited'),
      'serverErrors', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'server_error'),
      'checkInFailed7d', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'check_in_failed' AND created_at >= now() - interval '7 days'),
      'serverErrors7d', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'server_error' AND created_at >= now() - interval '7 days'),
      'activeRateLimitBuckets', (SELECT count(*) FROM public.check_in_rate_limits WHERE window_started_at >= now() - interval '1 day'),
      'expiredDeviceSessions', (SELECT count(*) FROM public.student_device_sessions WHERE last_used_at < now() - interval '90 days')
    ),
    'recent', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', ae.id,
        'at', ae.created_at,
        'type', ae.event_type,
        'organization', c.club_name,
        'eventId', ae.event_id,
        'userId', ae.user_id,
        'metadata', ae.metadata
      ) ORDER BY ae.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.analytics_events
        WHERE event_type IN ('check_in_failed', 'duplicate_check_in_attempt', 'check_in_rate_limited', 'server_error')
        ORDER BY created_at DESC LIMIT lim
      ) ae
      LEFT JOIN public.clubs c ON c.id = ae.club_id
    ),
    'errorsByDay', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', to_char(d, 'YYYY-MM-DD'), 'errors', cnt) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at) AS d, count(*) AS cnt
        FROM public.analytics_events
        WHERE created_at >= now() - interval '30 days'
          AND event_type IN ('check_in_failed', 'duplicate_check_in_attempt', 'check_in_rate_limited', 'server_error')
        GROUP BY 1
      ) x
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_users(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_users(text, int, int) TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_members(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_members(text, int, int) TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_events(text, uuid, date, date, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_events(text, uuid, date, date, int, int) TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_attendance(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_attendance(timestamptz, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_activation() TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_retention() TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_product_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_product_usage() TO service_role;
REVOKE ALL ON FUNCTION public.owner_admin_system_health(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_system_health(int) TO service_role;
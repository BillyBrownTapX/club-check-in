-- Guard used by every owner-admin report.
CREATE OR REPLACE FUNCTION public.owner_admin_guard()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_guard() TO service_role;

-- Per-organization rollup used by the organizations list, detail page and overview.
CREATE OR REPLACE FUNCTION public.owner_admin_club_stats()
RETURNS TABLE (
  club_id uuid,
  club_name text,
  club_slug text,
  created_at timestamptz,
  is_active boolean,
  university_id uuid,
  university_name text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  admin_count int,
  member_count int,
  members_new_30d int,
  members_attended int,
  event_count int,
  events_30d int,
  first_event_created_at timestamptz,
  second_event_created_at timestamptz,
  last_event_date date,
  next_event_date date,
  checkins_total int,
  checkins_30d int,
  unique_attendees int,
  repeat_attendees int,
  first_checkin_at timestamptz,
  last_checkin_at timestamptz,
  last_admin_sign_in timestamptz,
  feature_count int,
  last_activity timestamptz,
  days_since_activity int,
  score_recency int,
  score_event_frequency int,
  score_volume int,
  score_admin int,
  score_features int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.owner_admin_guard();
  RETURN QUERY
  WITH ar AS (
    SELECT e.club_id, a.student_id, a.checked_in_at
    FROM public.attendance_records a
    JOIN public.events e ON e.id = a.event_id
  ),
  mem AS (
    SELECT club_id, student_id FROM ar
    UNION
    SELECT e.club_id, p.student_id
    FROM public.pre_check_ins p
    JOIN public.events e ON e.id = p.event_id
  ),
  ci AS (
    SELECT club_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE checked_in_at >= now() - interval '30 days')::int AS c30,
           count(DISTINCT student_id)::int AS uniq,
           min(checked_in_at) AS first_at,
           max(checked_in_at) AS last_at
    FROM ar GROUP BY club_id
  ),
  rep AS (
    SELECT club_id, count(*)::int AS repeat_cnt
    FROM (SELECT club_id, student_id, count(*) AS c FROM ar GROUP BY 1, 2) s
    WHERE s.c > 1 GROUP BY club_id
  ),
  memc AS (
    SELECT m.club_id,
           count(*)::int AS member_count,
           count(*) FILTER (WHERE s.created_at >= now() - interval '30 days')::int AS new_30d
    FROM mem m JOIN public.students s ON s.id = m.student_id
    GROUP BY m.club_id
  ),
  att AS (
    SELECT club_id, count(DISTINCT student_id)::int AS attended FROM ar GROUP BY club_id
  ),
  evs AS (
    SELECT e.club_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE e.event_date >= current_date - 30)::int AS e30,
           min(e.created_at) AS first_created,
           (array_agg(e.created_at ORDER BY e.created_at))[2] AS second_created,
           max(e.event_date) FILTER (WHERE e.event_date <= current_date) AS last_date,
           min(e.event_date) FILTER (WHERE e.event_date > current_date) AS next_date,
           count(*) FILTER (WHERE e.pre_check_in_enabled)::int AS pre_events,
           count(*) FILTER (WHERE e.is_archived)::int AS archived_events
    FROM public.events e GROUP BY e.club_id
  ),
  adm AS (
    SELECT m.club_id, count(*)::int AS admin_count, max(u.last_sign_in_at) AS last_sign_in
    FROM public.club_members m
    LEFT JOIN auth.users u ON u.id = m.user_id
    GROUP BY m.club_id
  ),
  tpl AS (
    SELECT t.club_id, count(*)::int AS template_count FROM public.event_templates t GROUP BY t.club_id
  )
  SELECT
    c.id,
    c.club_name,
    c.club_slug,
    c.created_at,
    c.is_active,
    c.university_id,
    un.name,
    c.host_id,
    hp.full_name,
    hp.email,
    COALESCE(adm.admin_count, 0),
    COALESCE(memc.member_count, 0),
    COALESCE(memc.new_30d, 0),
    COALESCE(att.attended, 0),
    COALESCE(evs.total, 0),
    COALESCE(evs.e30, 0),
    evs.first_created,
    evs.second_created,
    evs.last_date,
    evs.next_date,
    COALESCE(ci.total, 0),
    COALESCE(ci.c30, 0),
    COALESCE(ci.uniq, 0),
    COALESCE(rep.repeat_cnt, 0),
    ci.first_at,
    ci.last_at,
    adm.last_sign_in,
    (
      (CASE WHEN COALESCE(tpl.template_count, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(evs.pre_events, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(adm.admin_count, 0) > 1 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(evs.archived_events, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN c.logo_url IS NOT NULL THEN 1 ELSE 0 END)
    )::int,
    GREATEST(c.created_at, COALESCE(ci.last_at, c.created_at), COALESCE(evs.first_created, c.created_at)),
    (EXTRACT(EPOCH FROM (now() - GREATEST(c.created_at, COALESCE(ci.last_at, c.created_at), COALESCE(evs.first_created, c.created_at)))) / 86400)::int,
    CASE
      WHEN ci.last_at IS NULL THEN 0
      WHEN ci.last_at >= now() - interval '7 days' THEN 100
      WHEN ci.last_at >= now() - interval '14 days' THEN 75
      WHEN ci.last_at >= now() - interval '30 days' THEN 50
      WHEN ci.last_at >= now() - interval '60 days' THEN 20
      ELSE 0
    END,
    CASE
      WHEN COALESCE(evs.e30, 0) >= 4 THEN 100
      WHEN COALESCE(evs.e30, 0) = 3 THEN 85
      WHEN COALESCE(evs.e30, 0) = 2 THEN 65
      WHEN COALESCE(evs.e30, 0) = 1 THEN 40
      ELSE 0
    END,
    CASE
      WHEN COALESCE(ci.c30, 0) >= 100 THEN 100
      WHEN COALESCE(ci.c30, 0) >= 50 THEN 85
      WHEN COALESCE(ci.c30, 0) >= 20 THEN 65
      WHEN COALESCE(ci.c30, 0) >= 5 THEN 40
      WHEN COALESCE(ci.c30, 0) > 0 THEN 20
      ELSE 0
    END,
    CASE
      WHEN adm.last_sign_in IS NULL THEN 0
      WHEN adm.last_sign_in >= now() - interval '7 days' THEN 100
      WHEN adm.last_sign_in >= now() - interval '30 days' THEN 60
      WHEN adm.last_sign_in >= now() - interval '90 days' THEN 30
      ELSE 10
    END,
    (
      (CASE WHEN COALESCE(tpl.template_count, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(evs.pre_events, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(adm.admin_count, 0) > 1 THEN 1 ELSE 0 END)
      + (CASE WHEN COALESCE(evs.archived_events, 0) > 0 THEN 1 ELSE 0 END)
      + (CASE WHEN c.logo_url IS NOT NULL THEN 1 ELSE 0 END)
    )::int * 20
  FROM public.clubs c
  LEFT JOIN public.universities un ON un.id = c.university_id
  LEFT JOIN public.host_profiles hp ON hp.id = c.host_id
  LEFT JOIN ci ON ci.club_id = c.id
  LEFT JOIN rep ON rep.club_id = c.id
  LEFT JOIN memc ON memc.club_id = c.id
  LEFT JOIN att ON att.club_id = c.id
  LEFT JOIN evs ON evs.club_id = c.id
  LEFT JOIN adm ON adm.club_id = c.id
  LEFT JOIN tpl ON tpl.club_id = c.id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_club_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_club_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_club_stats() TO service_role;

-- Platform overview.
CREATE OR REPLACE FUNCTION public.owner_admin_overview()
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

  WITH s AS (SELECT * FROM public.owner_admin_club_stats())
  SELECT jsonb_build_object(
    'organizations', jsonb_build_object(
      'total', (SELECT count(*) FROM public.clubs),
      'newToday', (SELECT count(*) FROM public.clubs WHERE created_at >= date_trunc('day', now())),
      'newThisWeek', (SELECT count(*) FROM public.clubs WHERE created_at >= now() - interval '7 days'),
      'newThisMonth', (SELECT count(*) FROM public.clubs WHERE created_at >= month_start),
      'active7d', (SELECT count(*) FROM s WHERE last_checkin_at >= now() - interval '7 days'),
      'active30d', (SELECT count(*) FROM s WHERE last_checkin_at >= now() - interval '30 days'),
      'dormant', (SELECT count(*) FROM s WHERE last_checkin_at IS NULL OR last_checkin_at < now() - interval '60 days'),
      'atRisk', (SELECT count(*) FROM s WHERE last_checkin_at < now() - interval '30 days' AND last_checkin_at >= now() - interval '60 days'),
      'neverActivated', (SELECT count(*) FROM s WHERE checkins_total = 0)
    ),
    'members', jsonb_build_object(
      'total', (SELECT count(*) FROM public.students),
      'newThisMonth', (SELECT count(*) FROM public.students WHERE created_at >= month_start),
      'avgPerOrganization', (SELECT COALESCE(round(avg(member_count)::numeric, 1), 0) FROM s),
      'withAttendance', (SELECT count(DISTINCT student_id) FROM public.attendance_records)
    ),
    'events', jsonb_build_object(
      'total', (SELECT count(*) FROM public.events),
      'thisWeek', (SELECT count(*) FROM public.events WHERE created_at >= now() - interval '7 days'),
      'thisMonth', (SELECT count(*) FROM public.events WHERE created_at >= month_start),
      'avgPerActiveOrganization', (
        SELECT COALESCE(round(avg(event_count)::numeric, 1), 0) FROM s WHERE last_checkin_at >= now() - interval '30 days'
      )
    ),
    'attendance', jsonb_build_object(
      'total', (SELECT count(*) FROM public.attendance_records),
      'today', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= date_trunc('day', now())),
      'thisWeek', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= now() - interval '7 days'),
      'thisMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= month_start),
      'uniqueThisMonth', (SELECT count(DISTINCT student_id) FROM public.attendance_records WHERE checked_in_at >= month_start),
      'avgPerEvent', (
        SELECT COALESCE(round((SELECT count(*) FROM public.attendance_records)::numeric / NULLIF((SELECT count(*) FROM public.events), 0), 1), 0)
      )
    ),
    'northStar', jsonb_build_object(
      'currentMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= month_start),
      'previousMonth', (SELECT count(*) FROM public.attendance_records WHERE checked_in_at >= prev_month_start AND checked_in_at < month_start),
      'monthLabel', to_char(now(), 'FMMonth YYYY')
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_overview() TO service_role;

-- Time series for overview charts.
CREATE OR REPLACE FUNCTION public.owner_admin_series(_from timestamptz, _to timestamptz, _bucket text DEFAULT 'day')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  unit text := CASE WHEN _bucket IN ('day', 'week', 'month') THEN _bucket ELSE 'day' END;
  step interval := CASE unit WHEN 'week' THEN interval '1 week' WHEN 'month' THEN interval '1 month' ELSE interval '1 day' END;
BEGIN
  PERFORM public.owner_admin_guard();

  WITH buckets AS (
    SELECT g AS bucket_start, g + step AS bucket_end
    FROM generate_series(date_trunc(unit, _from), date_trunc(unit, _to), step) g
  )
  SELECT jsonb_agg(jsonb_build_object(
    'bucket', to_char(b.bucket_start, 'YYYY-MM-DD'),
    'newOrganizations', (SELECT count(*) FROM public.clubs c WHERE c.created_at >= b.bucket_start AND c.created_at < b.bucket_end),
    'totalOrganizations', (SELECT count(*) FROM public.clubs c WHERE c.created_at < b.bucket_end),
    'checkIns', (SELECT count(*) FROM public.attendance_records a WHERE a.checked_in_at >= b.bucket_start AND a.checked_in_at < b.bucket_end),
    'eventsCreated', (SELECT count(*) FROM public.events e WHERE e.created_at >= b.bucket_start AND e.created_at < b.bucket_end),
    'newMembers', (SELECT count(*) FROM public.students st WHERE st.created_at >= b.bucket_start AND st.created_at < b.bucket_end),
    'totalMembers', (SELECT count(*) FROM public.students st WHERE st.created_at < b.bucket_end),
    'activeOrganizations', (
      SELECT count(DISTINCT e.club_id)
      FROM public.attendance_records a
      JOIN public.events e ON e.id = a.event_id
      WHERE a.checked_in_at >= b.bucket_start AND a.checked_in_at < b.bucket_end
    )
  ) ORDER BY b.bucket_start)
  INTO result
  FROM buckets b;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_series(timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_series(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_series(timestamptz, timestamptz, text) TO service_role;

-- Organizations table (search / filter / sort / paginate server-side).
CREATE OR REPLACE FUNCTION public.owner_admin_organizations(
  _q text DEFAULT NULL,
  _status text DEFAULT NULL,
  _university_id uuid DEFAULT NULL,
  _sort text DEFAULT 'last_activity',
  _dir text DEFAULT 'desc',
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
  asc_dir boolean := lower(COALESCE(_dir, 'desc')) = 'asc';
  sort_key text := COALESCE(_sort, 'last_activity');
BEGIN
  PERFORM public.owner_admin_guard();

  CREATE TEMP TABLE IF NOT EXISTS _oa_orgs ON COMMIT DROP AS SELECT * FROM public.owner_admin_club_stats() WITH NO DATA;
  DELETE FROM _oa_orgs;
  INSERT INTO _oa_orgs SELECT * FROM public.owner_admin_club_stats();

  WITH scored AS (
    SELECT s.*,
      (0.30 * s.score_recency + 0.25 * s.score_event_frequency + 0.20 * s.score_volume
       + 0.15 * s.score_admin + 0.10 * s.score_features)::int AS health_score
    FROM _oa_orgs s
  ),
  labeled AS (
    SELECT sc.*,
      CASE
        WHEN sc.checkins_total = 0 THEN 'never_activated'
        WHEN sc.health_score >= 80 THEN 'power_user'
        WHEN sc.health_score >= 60 THEN 'healthy'
        WHEN sc.health_score >= 40 THEN 'at_risk'
        WHEN sc.health_score >= 20 THEN 'churning'
        ELSE 'dormant'
      END AS status
    FROM scored sc
  ),
  filtered AS (
    SELECT * FROM labeled l
    WHERE (_status IS NULL OR _status = '' OR _status = 'all' OR l.status = _status)
      AND (_university_id IS NULL OR l.university_id = _university_id)
      AND (
        needle IS NULL
        OR l.club_name ILIKE '%' || needle || '%'
        OR COALESCE(l.owner_name, '') ILIKE '%' || needle || '%'
        OR COALESCE(l.owner_email, '') ILIKE '%' || needle || '%'
        OR COALESCE(l.university_name, '') ILIKE '%' || needle || '%'
      )
  )
  SELECT count(*)::int INTO total_count FROM filtered;

  WITH scored AS (
    SELECT s.*,
      (0.30 * s.score_recency + 0.25 * s.score_event_frequency + 0.20 * s.score_volume
       + 0.15 * s.score_admin + 0.10 * s.score_features)::int AS health_score
    FROM _oa_orgs s
  ),
  labeled AS (
    SELECT sc.*,
      CASE
        WHEN sc.checkins_total = 0 THEN 'never_activated'
        WHEN sc.health_score >= 80 THEN 'power_user'
        WHEN sc.health_score >= 60 THEN 'healthy'
        WHEN sc.health_score >= 40 THEN 'at_risk'
        WHEN sc.health_score >= 20 THEN 'churning'
        ELSE 'dormant'
      END AS status
    FROM scored sc
  ),
  filtered AS (
    SELECT * FROM labeled l
    WHERE (_status IS NULL OR _status = '' OR _status = 'all' OR l.status = _status)
      AND (_university_id IS NULL OR l.university_id = _university_id)
      AND (
        needle IS NULL
        OR l.club_name ILIKE '%' || needle || '%'
        OR COALESCE(l.owner_name, '') ILIKE '%' || needle || '%'
        OR COALESCE(l.owner_email, '') ILIKE '%' || needle || '%'
        OR COALESCE(l.university_name, '') ILIKE '%' || needle || '%'
      )
  ),
  page AS (
    SELECT * FROM filtered f
    ORDER BY
      CASE WHEN asc_dir THEN
        CASE sort_key
          WHEN 'name' THEN NULL
          ELSE NULL
        END
      END,
      CASE WHEN sort_key = 'name' AND asc_dir THEN f.club_name END ASC,
      CASE WHEN sort_key = 'name' AND NOT asc_dir THEN f.club_name END DESC,
      CASE WHEN sort_key = 'created' AND asc_dir THEN f.created_at END ASC,
      CASE WHEN sort_key = 'created' AND NOT asc_dir THEN f.created_at END DESC,
      CASE WHEN sort_key = 'members' AND asc_dir THEN f.member_count END ASC,
      CASE WHEN sort_key = 'members' AND NOT asc_dir THEN f.member_count END DESC,
      CASE WHEN sort_key = 'events' AND asc_dir THEN f.event_count END ASC,
      CASE WHEN sort_key = 'events' AND NOT asc_dir THEN f.event_count END DESC,
      CASE WHEN sort_key = 'checkins' AND asc_dir THEN f.checkins_total END ASC,
      CASE WHEN sort_key = 'checkins' AND NOT asc_dir THEN f.checkins_total END DESC,
      CASE WHEN sort_key = 'health' AND asc_dir THEN f.health_score END ASC,
      CASE WHEN sort_key = 'health' AND NOT asc_dir THEN f.health_score END DESC,
      CASE WHEN sort_key = 'last_activity' AND asc_dir THEN f.last_activity END ASC,
      CASE WHEN sort_key = 'last_activity' AND NOT asc_dir THEN f.last_activity END DESC
    LIMIT lim OFFSET off
  )
  SELECT jsonb_build_object(
    'total', total_count,
    'limit', lim,
    'offset', off,
    'rows', COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  ) INTO result
  FROM page p;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_organizations(text, text, uuid, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_organizations(text, text, uuid, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_organizations(text, text, uuid, text, text, int, int) TO service_role;

-- Single organization profile + timeline.
CREATE OR REPLACE FUNCTION public.owner_admin_organization_detail(_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  stats jsonb;
BEGIN
  PERFORM public.owner_admin_guard();

  SELECT to_jsonb(s) || jsonb_build_object(
    'health_score', (0.30 * s.score_recency + 0.25 * s.score_event_frequency + 0.20 * s.score_volume
                     + 0.15 * s.score_admin + 0.10 * s.score_features)::int
  )
  INTO stats
  FROM public.owner_admin_club_stats() s
  WHERE s.club_id = _club_id;

  IF stats IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'stats', stats,
    'administrators', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'userId', m.user_id,
        'name', hp.full_name,
        'email', hp.email,
        'role', m.role,
        'addedAt', m.created_at,
        'lastSignInAt', u.last_sign_in_at
      ) ORDER BY m.role, hp.full_name), '[]'::jsonb)
      FROM public.club_members m
      LEFT JOIN public.host_profiles hp ON hp.id = m.user_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      WHERE m.club_id = _club_id
    ),
    'recentEvents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.event_name,
        'date', e.event_date,
        'createdAt', e.created_at,
        'checkIns', (SELECT count(*) FROM public.attendance_records a WHERE a.event_id = e.id),
        'preCheckIns', (SELECT count(*) FROM public.pre_check_ins p WHERE p.event_id = e.id)
      ) ORDER BY e.event_date DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.events WHERE club_id = _club_id ORDER BY event_date DESC LIMIT 10) e
    ),
    'timeline', (
      SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'at') DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('at', c.created_at, 'type', 'organization_created', 'label', 'Organization created') AS t
        FROM public.clubs c WHERE c.id = _club_id
        UNION ALL
        SELECT jsonb_build_object('at', m.created_at, 'type', 'administrator_added', 'label', 'Administrator added: ' || COALESCE(hp.full_name, 'unknown') || ' (' || m.role || ')')
        FROM public.club_members m LEFT JOIN public.host_profiles hp ON hp.id = m.user_id
        WHERE m.club_id = _club_id
        UNION ALL
        SELECT jsonb_build_object('at', e.created_at, 'type', 'event_created', 'label', 'Event created: ' || e.event_name)
        FROM public.events e WHERE e.club_id = _club_id
        UNION ALL
        SELECT jsonb_build_object('at', h.created_at, 'type', h.activity_type::text, 'label',
          CASE h.activity_type
            WHEN 'first_check_in' THEN 'First check-in recorded'
            WHEN 'threshold_reached' THEN 'Attendance milestone: ' || COALESCE(h.threshold::text, '?')
            ELSE 'Check-in window closed with ' || COALESCE(h.attendance_count::text, '0') || ' attendees'
          END)
        FROM public.host_activity h WHERE h.club_id = _club_id
      ) rows LIMIT 60
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_admin_organization_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_admin_organization_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_admin_organization_detail(uuid) TO service_role;
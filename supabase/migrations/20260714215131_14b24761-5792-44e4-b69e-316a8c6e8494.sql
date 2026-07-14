WITH candidates AS (
  SELECT
    ar.student_id,
    COALESCE(e.university_id, c.university_id) AS university_id,
    ROW_NUMBER() OVER (
      PARTITION BY ar.student_id
      ORDER BY e.event_date DESC NULLS LAST, ar.checked_in_at DESC NULLS LAST
    ) AS rn
  FROM public.attendance_records ar
  JOIN public.events e ON e.id = ar.event_id
  JOIN public.clubs c ON c.id = e.club_id
  WHERE COALESCE(e.university_id, c.university_id) IS NOT NULL
)
UPDATE public.students s
SET university_id = cand.university_id
FROM candidates cand
WHERE cand.rn = 1
  AND cand.student_id = s.id
  AND s.university_id IS NULL;

-- Backfill NULL university_id on clubs using the sole existing university.
-- If more than one university exists at run time, fall back to the earliest
-- created one; hosts can edit afterwards. This matches the app's Zod contract
-- that already requires universityId on both create and update.
UPDATE public.clubs c
SET university_id = u.id,
    updated_at = now()
FROM (
  SELECT id
  FROM public.universities
  ORDER BY created_at ASC
  LIMIT 1
) u
WHERE c.university_id IS NULL;

-- Propagate to any events that were somehow left without a university
-- (defensive; the sync trigger normally handles this on insert).
UPDATE public.events e
SET university_id = c.university_id,
    updated_at = now()
FROM public.clubs c
WHERE e.club_id = c.id
  AND e.university_id IS NULL
  AND c.university_id IS NOT NULL;

-- Lock down the column so the DB matches the app schema.
ALTER TABLE public.clubs
  ALTER COLUMN university_id SET NOT NULL;

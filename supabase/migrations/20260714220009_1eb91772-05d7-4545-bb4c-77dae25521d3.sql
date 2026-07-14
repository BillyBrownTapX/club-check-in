-- P1.2: migrate students 900 uniqueness from global to per-university.
--
-- Preflight guards inside DO blocks abort the migration if data is not ready:
--   • any students.university_id IS NULL   -> abort
--   • any duplicate (university_id, nine_hundred_number) pairs -> abort
--
-- Rollback notes (manual, not automated):
--   • To restore the global unique: verify no cross-university duplicates on
--     nine_hundred_number, then
--       ALTER TABLE public.students
--         ADD CONSTRAINT students_nine_hundred_number_key UNIQUE (nine_hundred_number);
--     Drop the per-university constraint afterward.
--   • DROP NOT NULL on university_id only if you also intend to relax the
--     per-university unique (otherwise NULLs will bypass the constraint).

DO $$
DECLARE
  null_count integer;
  dup_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM public.students WHERE university_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Aborting P1.2 migration: % students rows have NULL university_id', null_count;
  END IF;

  SELECT count(*) INTO dup_count FROM (
    SELECT university_id, nine_hundred_number
    FROM public.students
    GROUP BY university_id, nine_hundred_number
    HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Aborting P1.2 migration: % duplicate (university_id, nine_hundred_number) pairs', dup_count;
  END IF;
END $$;

-- Drop the old global unique on nine_hundred_number.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_nine_hundred_number_key;

-- Drop redundant helper index if it existed only to back the old unique.
DROP INDEX IF EXISTS public.idx_students_nine_hundred_number;

-- Drop the partial unique index (if present) so we can replace it with a
-- full UNIQUE CONSTRAINT now that university_id will be NOT NULL.
DROP INDEX IF EXISTS public.idx_students_university_nine_hundred;

-- Enforce NOT NULL on university_id.
ALTER TABLE public.students ALTER COLUMN university_id SET NOT NULL;

-- Per-university uniqueness on 900 number.
ALTER TABLE public.students
  ADD CONSTRAINT students_university_id_nine_hundred_number_key
  UNIQUE (university_id, nine_hundred_number);

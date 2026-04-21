CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities' AND policyname = 'Authenticated users can view universities'
  ) THEN
    CREATE POLICY "Authenticated users can view universities"
    ON public.universities
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities' AND policyname = 'Authenticated users can create universities'
  ) THEN
    CREATE POLICY "Authenticated users can create universities"
    ON public.universities
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities' AND policyname = 'Admins can update universities'
  ) THEN
    CREATE POLICY "Admins can update universities"
    ON public.universities
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities' AND policyname = 'Admins can delete universities'
  ) THEN
    CREATE POLICY "Admins can delete universities"
    ON public.universities
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS university_id UUID;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS university_id UUID;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS university_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clubs_university_id_fkey'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_university_id_fkey'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_university_id_fkey'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clubs_university_id ON public.clubs(university_id);
CREATE INDEX IF NOT EXISTS idx_students_university_id ON public.students(university_id);
CREATE INDEX IF NOT EXISTS idx_events_university_id ON public.events(university_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_slug ON public.universities(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_university_nine_hundred ON public.students(university_id, nine_hundred_number) WHERE university_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_event_student_unique ON public.attendance_records(event_id, student_id);

CREATE OR REPLACE FUNCTION public.sync_event_university_from_club()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  club_university_id UUID;
BEGIN
  SELECT university_id
  INTO club_university_id
  FROM public.clubs
  WHERE id = NEW.club_id;

  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Event must belong to a club';
  END IF;

  IF club_university_id IS NULL THEN
    RAISE EXCEPTION 'Selected club must have a university before events can be saved';
  END IF;

  NEW.university_id := club_university_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_club_university_to_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET university_id = NEW.university_id
  WHERE club_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_event_university_from_club ON public.events;
CREATE TRIGGER set_event_university_from_club
BEFORE INSERT OR UPDATE OF club_id, university_id
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_event_university_from_club();

DROP TRIGGER IF EXISTS propagate_club_university_to_events_trigger ON public.clubs;
CREATE TRIGGER propagate_club_university_to_events_trigger
AFTER UPDATE OF university_id
ON public.clubs
FOR EACH ROW
WHEN (OLD.university_id IS DISTINCT FROM NEW.university_id)
EXECUTE FUNCTION public.propagate_club_university_to_events();
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pre_check_in_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_check_in_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_check_in_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_check_in_token text;

CREATE UNIQUE INDEX IF NOT EXISTS events_pre_check_in_token_key
  ON public.events (pre_check_in_token)
  WHERE pre_check_in_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pre_check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_method public.check_in_method NOT NULL DEFAULT 'qr_scan'::public.check_in_method,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pre_check_ins_event_id_student_id_key UNIQUE (event_id, student_id)
);

CREATE INDEX IF NOT EXISTS pre_check_ins_event_id_idx ON public.pre_check_ins (event_id);
CREATE INDEX IF NOT EXISTS pre_check_ins_student_id_idx ON public.pre_check_ins (student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_check_ins TO authenticated;
GRANT ALL ON public.pre_check_ins TO service_role;

ALTER TABLE public.pre_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can read pre check-ins for own events"
  ON public.pre_check_ins FOR SELECT TO authenticated
  USING (public.is_event_host(event_id));

CREATE POLICY "Hosts can insert pre check-ins for own events"
  ON public.pre_check_ins FOR INSERT TO authenticated
  WITH CHECK (public.is_event_host(event_id));

CREATE POLICY "Hosts can update pre check-ins for own events"
  ON public.pre_check_ins FOR UPDATE TO authenticated
  USING (public.is_event_host(event_id))
  WITH CHECK (public.is_event_host(event_id));

CREATE POLICY "Hosts can delete pre check-ins for own events"
  ON public.pre_check_ins FOR DELETE TO authenticated
  USING (public.is_event_host(event_id));

CREATE TRIGGER update_pre_check_ins_updated_at
  BEFORE UPDATE ON public.pre_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_event_pre_check_in_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pre_check_in_enabled THEN
    IF NEW.pre_check_in_opens_at IS NULL OR NEW.pre_check_in_closes_at IS NULL THEN
      RAISE EXCEPTION 'Pre check-in requires both an open and close time';
    END IF;
    IF NEW.pre_check_in_closes_at <= NEW.pre_check_in_opens_at THEN
      RAISE EXCEPTION 'Pre check-in must close after it opens';
    END IF;
    IF NEW.pre_check_in_closes_at > NEW.check_in_closes_at THEN
      RAISE EXCEPTION 'Pre check-in cannot close after the event check-in closes';
    END IF;
    IF NEW.pre_check_in_token IS NULL THEN
      RAISE EXCEPTION 'Pre check-in requires a link token';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_event_pre_check_in_window ON public.events;
CREATE TRIGGER validate_event_pre_check_in_window
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_pre_check_in_window();

CREATE OR REPLACE FUNCTION public.is_student_visible_to_host(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    JOIN public.events e ON e.id = ar.event_id
    JOIN public.clubs c ON c.id = e.club_id
    WHERE ar.student_id = _student_id
      AND (
        c.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = c.id AND m.user_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.pre_check_ins p
    JOIN public.events e2 ON e2.id = p.event_id
    JOIN public.clubs c2 ON c2.id = e2.club_id
    WHERE p.student_id = _student_id
      AND (
        c2.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members m2
          WHERE m2.club_id = c2.id AND m2.user_id = auth.uid()
        )
      )
  );
$$;
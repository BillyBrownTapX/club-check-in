
-- 1) Enum + table
CREATE TYPE public.club_member_role AS ENUM ('owner', 'officer');

CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.host_profiles(id) ON DELETE CASCADE,
  role public.club_member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE INDEX idx_club_members_user_id ON public.club_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_club_members_updated_at
  BEFORE UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Backfill existing owners
INSERT INTO public.club_members (club_id, user_id, role)
SELECT c.id, c.host_id, 'owner'::public.club_member_role
FROM public.clubs c
ON CONFLICT (club_id, user_id) DO NOTHING;

DO $$
DECLARE
  club_count int;
  owner_count int;
  mismatch int;
BEGIN
  SELECT count(*) INTO club_count FROM public.clubs;
  SELECT count(*) INTO owner_count
    FROM public.club_members WHERE role = 'owner';
  IF owner_count <> club_count THEN
    RAISE EXCEPTION 'club_members owner backfill mismatch: % clubs vs % owner rows', club_count, owner_count;
  END IF;

  SELECT count(*) INTO mismatch FROM public.clubs c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = c.id AND m.user_id = c.host_id AND m.role = 'owner'
    );
  IF mismatch > 0 THEN
    RAISE EXCEPTION 'club_members backfill missing owner for % clubs', mismatch;
  END IF;
END $$;

-- 3) Keep membership in sync for newly created clubs (host_id UPDATE sync deferred to P1.5d)
CREATE OR REPLACE FUNCTION public.sync_club_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.host_id, 'owner'::public.club_member_role)
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_club_created_add_owner_member
AFTER INSERT ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.sync_club_owner_membership();

-- 4) SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.is_club_member(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = _club_id AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = _club_id AND c.host_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_owner(_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = _club_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  )
  OR EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = _club_id AND c.host_id = auth.uid()
  );
$$;

-- Redefine is_event_host to accept club members (not only host_id)
CREATE OR REPLACE FUNCTION public.is_event_host(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.clubs c ON c.id = e.club_id
    WHERE e.id = _event_id
      AND (
        c.host_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = c.id AND m.user_id = auth.uid()
        )
      )
  );
$$;

-- Redefine is_student_visible_to_host similarly
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
  );
$$;

-- 5) RLS policies

-- clubs
DROP POLICY IF EXISTS "Hosts can manage own clubs" ON public.clubs;

CREATE POLICY "Members can view their clubs"
  ON public.clubs FOR SELECT TO authenticated
  USING (public.is_club_member(id));

CREATE POLICY "Hosts can create clubs"
  ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Members can update their clubs"
  ON public.clubs FOR UPDATE TO authenticated
  USING (public.is_club_member(id))
  WITH CHECK (public.is_club_member(id));

CREATE POLICY "Owners can delete their clubs"
  ON public.clubs FOR DELETE TO authenticated
  USING (public.is_club_owner(id));

-- events
DROP POLICY IF EXISTS "Hosts can manage events in own clubs" ON public.events;

CREATE POLICY "Members can manage events in their clubs"
  ON public.events FOR ALL TO authenticated
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

-- event_templates
DROP POLICY IF EXISTS "Hosts can manage templates in own clubs" ON public.event_templates;

CREATE POLICY "Members can manage templates in their clubs"
  ON public.event_templates FOR ALL TO authenticated
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

-- club_members policies
CREATE POLICY "Members can view club roster"
  ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_member(club_id));

CREATE POLICY "Owners can add members"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (public.is_club_owner(club_id));

CREATE POLICY "Owners can update members"
  ON public.club_members FOR UPDATE TO authenticated
  USING (public.is_club_owner(club_id))
  WITH CHECK (public.is_club_owner(club_id));

CREATE POLICY "Owners can remove officers"
  ON public.club_members FOR DELETE TO authenticated
  USING (public.is_club_owner(club_id) AND role = 'officer');

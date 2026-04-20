CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.check_in_method AS ENUM ('qr_scan', 'returning_lookup', 'remembered_device', 'host_correction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.check_in_source AS ENUM ('public_mobile', 'host_dashboard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.attendance_action_type AS ENUM ('removed', 'restored', 'note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.host_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 1 AND 120),
  email text NOT NULL UNIQUE CHECK (email = lower(trim(email)) AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.host_profiles(id) ON DELETE CASCADE,
  club_name text NOT NULL CHECK (char_length(trim(club_name)) BETWEEN 1 AND 120),
  club_slug text NOT NULL UNIQUE CHECK (club_slug = lower(trim(club_slug)) AND club_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  template_name text NOT NULL CHECK (char_length(trim(template_name)) BETWEEN 1 AND 120),
  default_event_name text,
  default_location text,
  default_start_time time,
  default_end_time time,
  default_check_in_open_offset_minutes integer NOT NULL DEFAULT 15 CHECK (default_check_in_open_offset_minutes BETWEEN -1440 AND 1440),
  default_check_in_close_offset_minutes integer NOT NULL DEFAULT 60 CHECK (default_check_in_close_offset_minutes BETWEEN -1440 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_template_id uuid REFERENCES public.event_templates(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (char_length(trim(event_name)) BETWEEN 1 AND 160),
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  check_in_opens_at timestamptz NOT NULL,
  check_in_closes_at timestamptz NOT NULL,
  qr_token text NOT NULL UNIQUE CHECK (char_length(trim(qr_token)) BETWEEN 16 AND 128),
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (check_in_closes_at > check_in_opens_at)
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(trim(first_name)) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(trim(last_name)) BETWEEN 1 AND 80),
  student_email text NOT NULL CHECK (student_email = lower(trim(student_email)) AND student_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  nine_hundred_number text NOT NULL UNIQUE CHECK (nine_hundred_number ~ '^\d{9}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_method public.check_in_method NOT NULL DEFAULT 'qr_scan',
  check_in_source public.check_in_source NOT NULL DEFAULT 'public_mobile',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendance_record_id uuid REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  host_id uuid NOT NULL REFERENCES public.host_profiles(id) ON DELETE CASCADE,
  action_type public.attendance_action_type NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  device_token text NOT NULL UNIQUE CHECK (char_length(trim(device_token)) BETWEEN 24 AND 255),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clubs_host_id ON public.clubs(host_id);
CREATE INDEX IF NOT EXISTS idx_event_templates_club_id ON public.event_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_events_club_id ON public.events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_qr_token ON public.events(qr_token);
CREATE INDEX IF NOT EXISTS idx_attendance_records_event_id ON public.attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_actions_event_id ON public.attendance_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_students_nine_hundred_number ON public.students(nine_hundred_number);
CREATE INDEX IF NOT EXISTS idx_student_device_sessions_student_id ON public.student_device_sessions(student_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_host_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.host_profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    lower(trim(COALESCE(NEW.email, '')))
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_host(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.clubs c ON c.id = e.club_id
    WHERE e.id = _event_id
      AND c.host_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_visible_to_host(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    JOIN public.events e ON e.id = ar.event_id
    JOIN public.clubs c ON c.id = e.club_id
    WHERE ar.student_id = _student_id
      AND c.host_id = auth.uid()
  );
$$;

ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can read own profile" ON public.host_profiles;
CREATE POLICY "Hosts can read own profile"
ON public.host_profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Hosts can create own profile" ON public.host_profiles;
CREATE POLICY "Hosts can create own profile"
ON public.host_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Hosts can update own profile" ON public.host_profiles;
CREATE POLICY "Hosts can update own profile"
ON public.host_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
CREATE POLICY "Admins can view user roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Hosts can manage own clubs" ON public.clubs;
CREATE POLICY "Hosts can manage own clubs"
ON public.clubs FOR ALL TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can manage templates in own clubs" ON public.event_templates;
CREATE POLICY "Hosts can manage templates in own clubs"
ON public.event_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.host_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.host_id = auth.uid()));

DROP POLICY IF EXISTS "Hosts can manage events in own clubs" ON public.events;
CREATE POLICY "Hosts can manage events in own clubs"
ON public.events FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.host_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.host_id = auth.uid()));

DROP POLICY IF EXISTS "Hosts can read linked students" ON public.students;
CREATE POLICY "Hosts can read linked students"
ON public.students FOR SELECT TO authenticated
USING (public.is_student_visible_to_host(id));

DROP POLICY IF EXISTS "Hosts can read attendance for own events" ON public.attendance_records;
CREATE POLICY "Hosts can read attendance for own events"
ON public.attendance_records FOR SELECT TO authenticated
USING (public.is_event_host(event_id));

DROP POLICY IF EXISTS "Hosts can manage attendance for own events" ON public.attendance_records;
CREATE POLICY "Hosts can manage attendance for own events"
ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (public.is_event_host(event_id));

DROP POLICY IF EXISTS "Hosts can update attendance for own events" ON public.attendance_records;
CREATE POLICY "Hosts can update attendance for own events"
ON public.attendance_records FOR UPDATE TO authenticated
USING (public.is_event_host(event_id))
WITH CHECK (public.is_event_host(event_id));

DROP POLICY IF EXISTS "Hosts can delete attendance for own events" ON public.attendance_records;
CREATE POLICY "Hosts can delete attendance for own events"
ON public.attendance_records FOR DELETE TO authenticated
USING (public.is_event_host(event_id));

DROP POLICY IF EXISTS "Hosts can manage attendance actions for own events" ON public.attendance_actions;
CREATE POLICY "Hosts can manage attendance actions for own events"
ON public.attendance_actions FOR ALL TO authenticated
USING (public.is_event_host(event_id) AND auth.uid() = host_id)
WITH CHECK (public.is_event_host(event_id) AND auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can read remembered device sessions for linked students" ON public.student_device_sessions;
CREATE POLICY "Hosts can read remembered device sessions for linked students"
ON public.student_device_sessions FOR SELECT TO authenticated
USING (public.is_student_visible_to_host(student_id));

DROP POLICY IF EXISTS "Hosts can manage remembered device sessions for linked students" ON public.student_device_sessions;
CREATE POLICY "Hosts can manage remembered device sessions for linked students"
ON public.student_device_sessions FOR ALL TO authenticated
USING (public.is_student_visible_to_host(student_id))
WITH CHECK (public.is_student_visible_to_host(student_id));

DROP TRIGGER IF EXISTS update_host_profiles_updated_at ON public.host_profiles;
CREATE TRIGGER update_host_profiles_updated_at BEFORE UPDATE ON public.host_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_clubs_updated_at ON public.clubs;
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_event_templates_updated_at ON public.event_templates;
CREATE TRIGGER update_event_templates_updated_at BEFORE UPDATE ON public.event_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_student_device_sessions_updated_at ON public.student_device_sessions;
CREATE TRIGGER update_student_device_sessions_updated_at BEFORE UPDATE ON public.student_device_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS on_auth_user_created_host_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_host_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_host_profile();
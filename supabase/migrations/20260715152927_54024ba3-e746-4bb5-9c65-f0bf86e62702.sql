-- Disable fields on host_profiles (additive; no existing policies dropped)
ALTER TABLE public.host_profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

ALTER TABLE public.host_profiles
  DROP CONSTRAINT IF EXISTS host_profiles_disabled_reason_length;
ALTER TABLE public.host_profiles
  ADD CONSTRAINT host_profiles_disabled_reason_length
  CHECK (disabled_reason IS NULL OR char_length(disabled_reason) <= 280);

-- Prevent non-admin authenticated users from mutating disable fields via
-- their existing "Hosts can update own profile" policy. Service role
-- (auth.uid() IS NULL) always passes so admin server fns can update.
CREATE OR REPLACE FUNCTION public.prevent_non_admin_host_disable_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_disabled IS DISTINCT FROM OLD.is_disabled
      OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at
      OR NEW.disabled_reason IS DISTINCT FROM OLD.disabled_reason) THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can modify host disable state.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS host_profiles_prevent_non_admin_disable ON public.host_profiles;
CREATE TRIGGER host_profiles_prevent_non_admin_disable
  BEFORE UPDATE ON public.host_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_host_disable_change();

-- Seed the initial admin (no-op if the host doesn't exist yet or is already admin).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM public.host_profiles
WHERE email = 'billy.brown@ingresssoftware.com'
ON CONFLICT (user_id, role) DO NOTHING;
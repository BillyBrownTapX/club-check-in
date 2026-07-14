
-- Rate-limit counter table used by the public check-in surface.
-- Bucket key is a hashed composite of (qrToken, ip) built server-side.
CREATE TABLE IF NOT EXISTS public.check_in_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);

-- No public API access. Only reachable through the SECURITY DEFINER function below,
-- which itself is only callable by the service role via server-side admin client.
GRANT ALL ON public.check_in_rate_limits TO service_role;
ALTER TABLE public.check_in_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no anon/authenticated access via Data API.

-- Atomic hit + check. Called only by service-role server code.
-- Returns true when the caller is still within max_hits for the current window.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket_key text,
  _max_hits integer,
  _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _row public.check_in_rate_limits%ROWTYPE;
BEGIN
  INSERT INTO public.check_in_rate_limits (bucket_key, window_started_at, hits)
    VALUES (_bucket_key, _now, 1)
    ON CONFLICT (bucket_key) DO UPDATE
      SET window_started_at = CASE
            WHEN public.check_in_rate_limits.window_started_at < _now - make_interval(secs => _window_seconds)
              THEN _now
            ELSE public.check_in_rate_limits.window_started_at
          END,
          hits = CASE
            WHEN public.check_in_rate_limits.window_started_at < _now - make_interval(secs => _window_seconds)
              THEN 1
            ELSE public.check_in_rate_limits.hits + 1
          END
    RETURNING * INTO _row;

  RETURN _row.hits <= _max_hits;
END;
$$;

-- Only service role may call this. Not exposed to anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

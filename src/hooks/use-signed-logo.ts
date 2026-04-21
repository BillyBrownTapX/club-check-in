import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Simple in-memory cache for signed URLs. Signed URLs expire (1h here), so
// we also track when each entry was cached and re-sign once the cache gets
// close to expiry. This keeps us from hitting storage on every render of a
// club card list.
type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function useSignedLogoUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const cached = cache.get(path);
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url;
    return null;
  });

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }

    const cached = cache.get(path);
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
      setUrl(cached.url);
      return;
    }

    let active = true;
    void (async () => {
      const { data, error } = await supabase.storage.from("host-logos").createSignedUrl(path, TTL_SECONDS);
      if (!active) return;
      if (error || !data?.signedUrl) {
        setUrl(null);
        return;
      }
      cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
      setUrl(data.signedUrl);
    })();
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}

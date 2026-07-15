import { useEffect, useState } from "react";

/**
 * Report whether the browser currently believes it has a network path.
 *
 * SSR-safe: returns `true` on the server / before hydration so we never
 * render a scary "offline" banner during the initial paint. Once the
 * component mounts we sync to `navigator.onLine` and subscribe to
 * `online` / `offline` window events.
 *
 * We deliberately do NOT run active connectivity probes here — the check-in
 * flow surfaces real network failures through submit-time error classification,
 * and probing on a shared-NAT venue would spend budget for no benefit.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/**
 * Heuristic: does this thrown error look like a transport / offline failure
 * (fetch aborted, DNS gone, radios off) rather than a valid server response?
 *
 * TanStack Start server-fn RPC surfaces network failures as plain `TypeError`
 * or errors whose message contains "Failed to fetch" / "NetworkError" / "Load failed".
 * A server-thrown domain error (rate limit, invalid input) has a `code` or a
 * user-visible `message` and should NOT be treated as offline.
 */
export function isLikelyOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; message?: unknown; code?: unknown };
  if (e.code === "rate_limited" || e.code === "invalid_email_domain") return false;
  const name = typeof e.name === "string" ? e.name : "";
  const msg = typeof e.message === "string" ? e.message : "";
  if (name === "TypeError" || name === "AbortError") return true;
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("network request failed") ||
    msg.toLowerCase().includes("networkerror")
  );
}

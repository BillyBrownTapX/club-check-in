import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "disconnected";

/**
 * Subscribe to realtime changes for a single event's attendance + actions + the event row itself.
 * Calls `onChange` (debounced to coalesce bursts) whenever something relevant updates.
 *
 * Health model:
 *   - `connecting` → first JOIN in flight. UI may briefly show a spinner pill.
 *   - `connected`  → channel is JOINED and we trust it as the source of truth.
 *                    Safety-net polling is OFF.
 *   - `disconnected` → channel errored, timed out, closed, OR a periodic
 *                    heartbeat caught the channel in a non-`joined` state
 *                    (zombie socket — server thinks it's gone, client never
 *                    got a CLOSED frame). The safety-net poll re-engages and
 *                    the UI surfaces a "Reconnecting…" chip.
 *
 * The fallback poll only runs while the channel is NOT connected, so a healthy
 * connection costs zero polling traffic.
 */
export function useEventRealtime(opts: {
  eventId: string | null | undefined;
  enabled: boolean;
  onChange: () => void;
  fallbackPollMs?: number;
  /** debounce window for coalescing rapid events (default 250ms) */
  debounceMs?: number;
  /** how often to verify the channel is still actually joined (default 25s) */
  heartbeatMs?: number;
}): {
  status: RealtimeStatus;
  /** True once we've ever been connected — distinguishes "first connect" from "reconnecting". */
  hasEverConnected: boolean;
} {
  const {
    eventId,
    enabled,
    onChange,
    fallbackPollMs = 30_000,
    debounceMs = 250,
    heartbeatMs = 25_000,
  } = opts;
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [hasEverConnected, setHasEverConnected] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !eventId) return;

    setStatus("connecting");

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChangeRef.current();
      }, debounceMs);
    };

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `event_id=eq.${eventId}` },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_actions", filter: `event_id=eq.${eventId}` },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        trigger,
      )
      .subscribe((channelStatus) => {
        if (channelStatus === "SUBSCRIBED") {
          setStatus("connected");
          setHasEverConnected(true);
        } else if (
          channelStatus === "CHANNEL_ERROR" ||
          channelStatus === "TIMED_OUT" ||
          channelStatus === "CLOSED"
        ) {
          setStatus("disconnected");
        }
      });

    // Heartbeat: in practice the realtime client occasionally fails silently
    // (server-side socket dropped, client never got a CLOSED frame). Polling
    // `channel.state` lets us detect the zombie and demote ourselves so the
    // fallback poll re-engages and the UI shows "Reconnecting…".
    const heartbeat = window.setInterval(() => {
      // RealtimeChannel.state: "closed" | "errored" | "joined" | "joining" | "leaving"
      const state = (channel as unknown as { state?: string }).state;
      if (state && state !== "joined" && state !== "joining") {
        setStatus((prev) => (prev === "connected" ? "disconnected" : prev));
      }
    }, heartbeatMs);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [enabled, eventId, debounceMs, heartbeatMs]);

  // Safety-net poll: only runs when realtime is NOT connected.
  useEffect(() => {
    if (!enabled || !eventId) return;
    if (status === "connected") return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      onChangeRef.current();
    }, fallbackPollMs);
    return () => window.clearInterval(id);
  }, [enabled, eventId, status, fallbackPollMs]);

  // Refresh once when the tab becomes visible again — covers the case where realtime
  // dropped silently while the tab was backgrounded.
  useEffect(() => {
    if (!enabled || !eventId) return;
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") onChangeRef.current();
    };
    const onOnline = () => onChangeRef.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, eventId]);

  return { status, hasEverConnected };
}

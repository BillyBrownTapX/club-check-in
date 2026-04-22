import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes for a single event's attendance + actions + the event row itself.
 * Calls `onChange` (debounced to coalesce bursts) whenever something relevant updates.
 *
 * Falls back to a slow safety-net poll (default 30s) only while the realtime channel is
 * NOT in a healthy `SUBSCRIBED` state — so a disconnected user still gets eventual updates,
 * but a healthy connection costs zero polling traffic.
 */
export function useEventRealtime(opts: {
  eventId: string | null | undefined;
  enabled: boolean;
  onChange: () => void;
  fallbackPollMs?: number;
  /** debounce window for coalescing rapid events (default 250ms) */
  debounceMs?: number;
}) {
  const { eventId, enabled, onChange, fallbackPollMs = 30_000, debounceMs = 250 } = opts;
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");

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
        if (channelStatus === "SUBSCRIBED") setStatus("connected");
        else if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT" || channelStatus === "CLOSED") {
          setStatus("disconnected");
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [enabled, eventId, debounceMs]);

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

  return { status };
}

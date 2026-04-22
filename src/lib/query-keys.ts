// Centralized query key registry.
//
// Why centralize: mutations invalidate by prefix (`['events']` invalidates the
// list AND every detail). If keys live inline next to the call sites, a typo
// silently breaks invalidation and the UI looks "stuck" until reload. Keep
// every key the app uses in one file so mutations can target prefixes
// confidently.
//
// Convention: each key is a tuple starting with the resource name. Detail
// keys end with the id. Filter keys serialize the filter into a stable shape.

import type { EventListStatusFilter } from "@/lib/attendance-hq";

export const queryKeys = {
  clubs: {
    all: ["clubs"] as const,
    summaries: () => ["clubs", "summaries"] as const,
    detail: (clubId: string) => ["clubs", "detail", clubId] as const,
  },
  events: {
    all: ["events"] as const,
    list: (filter: { clubId: string; status: EventListStatusFilter; query: string }) =>
      ["events", "list", filter] as const,
    detail: (eventId: string) => ["events", "detail", eventId] as const,
    display: (eventId: string) => ["events", "display", eventId] as const,
  },
  universities: {
    all: ["universities"] as const,
    forHost: () => ["universities", "for-host"] as const,
  },
  templates: {
    byClub: (clubId: string) => ["templates", "by-club", clubId] as const,
  },
} as const;

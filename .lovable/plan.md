

## Goal

Bring `/events/new` in line with the rest of the host routes (`clubs.index`, `events.index`, `notifications`, `events.$eventId`, `events.$eventId.edit` patterns). It's the last route still using the legacy hand-rolled `useEffect + useState + useAuthorizedServerFn` data-loading pattern.

## What changes

### 1. `src/lib/query-keys.ts`
Add an `eventFormPayload` key under `events`, parameterized by the bootstrap inputs:

```ts
events: {
  ...
  formPayload: (input: { eventId: string; clubId: string; templateId: string; duplicateFrom: string }) =>
    ["events", "form-payload", input] as const,
},
```

### 2. `src/routes/events.new.tsx` — full rewrite to match siblings

**Data loading**: replace the manual `useEffect` + `loadPayload().then()` + `useState<EventFormPayload | null>` flow with a single `useAuthorizedQuery` call (same shape used in `clubs.index.tsx` and `events.index.tsx`).

**Mutations**: replace the two raw `useAuthorizedServerFn(createEvent)` / `useAuthorizedServerFn(duplicateEvent)` calls with `useAuthorizedMutation`, invalidating `queryKeys.events.all` and `queryKeys.clubs.all` so the events list and club summaries refresh after creation (currently they don't auto-refresh on create — minor latent bug).

**Error component**: upgrade `EventCreateError` to accept `{ error, reset }` and render the same `ios-card` + "Try again" button pattern used by `ClubsError` / `EventsError`, calling `router.invalidate(); reset();`.

**Empty-club redirect**: keep the existing "no clubs → `/onboarding/club`" bounce, but move it into a `useEffect` that watches `query.data` (so it survives the switch to TanStack Query).

**Loading & error rendering**: drop the local `error` state — read directly from `query.error` and render via `getManagementErrorMessage`, matching siblings.

**Behavior preserved**: search-param parsing, head/meta tags, title/description/submit-label switching for duplicate vs. create, post-submit navigation to `/events/$eventId` with `created: "1"`.

### 3. `src/routes/events.$eventId.edit.tsx` — same treatment (consistency)

This file uses the identical legacy pattern (`useEffect` + `useState<EventFormPayload | null>` + manual error state). Apply the same refactor:
- `useAuthorizedQuery` with `queryKeys.events.formPayload({ eventId, clubId: "", templateId: "", duplicateFrom: "" })`
- `useAuthorizedMutation` for `updateEvent` and `deleteEvent`, invalidating `queryKeys.events.all`, `queryKeys.events.detail(eventId)`, and `queryKeys.clubs.all`
- Upgrade `EventEditError` to the `{ error, reset }` shape with retry button

This keeps the create and edit screens symmetrical — both currently share the legacy pattern, and updating only one would create a new inconsistency.

## Why

- **Cache reuse**: a `useAuthorizedQuery`-driven form payload becomes invalidatable. After creating/duplicating an event the cache is bumped automatically, so back-navigating to `/events` shows the new event without a manual refetch.
- **Pattern parity**: every other host route already uses this exact shape. New contributors won't have to learn two data-loading idioms.
- **Cleaner error UX**: error state surfaces in a styled `ios-card` with a Try-again button instead of a bare grey paragraph.
- **Smaller component**: `events.new.tsx` shrinks from ~97 lines to ~70, with no `useState`/`useEffect` plumbing.

## Files touched

- `src/lib/query-keys.ts` — add `events.formPayload` key
- `src/routes/events.new.tsx` — refactor to query + mutation pattern
- `src/routes/events.$eventId.edit.tsx` — same refactor for consistency

## Out of scope

- No changes to `EventForm`, `getEventFormPayload`, `createEvent`, `updateEvent`, `duplicateEvent`, or any server function.
- No visual / copy changes — purely an internal pattern alignment.
- No new dependencies.


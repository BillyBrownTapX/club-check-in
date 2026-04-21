

## Make the "Create Event" failure visible (and fix the silent ones)

### Goal

When a host clicks **Create Event** and nothing happens, the form must tell them exactly why. Today, validation errors on hidden or unstyled fields (`clubId`, `checkInOpensAt`, `checkInClosesAt`) silently block submission with no UI feedback, so the button briefly flips to "Saving…" and reverts.

### Changes

**1. `src/components/attendance-hq/host-management.tsx` — `SelectInput` shows errors**

Add an optional `error?: string` prop. Render the message under the trigger using the same `text-sm text-destructive` style used by `TextInput`. Apply a `border-destructive` ring on the trigger when an error is present so it's visually obvious which select is invalid.

**2. `EventForm` — wire the new error prop and surface form-wide errors**

- Pass `error={form.formState.errors.clubId?.message}` to the Club `SelectInput`.
- Add a small **form-error summary** rendered just above the sticky submit bar. It iterates `form.formState.errors` and lists any messages whose field doesn't already have an inline error rendered (covers `clubId`, `checkInOpensAt`, `checkInClosesAt`, and any future additions). Format: a single rounded destructive banner with a short heading ("Fix these before saving") and a bulleted list of messages.
- Replace `form.handleSubmit(success)` with `form.handleSubmit(success, onError)` where `onError` sets `error` to "Some fields need attention — see highlighted errors above." so the sticky bar always shows feedback even when the success branch never fires. This is the user-facing fix for the "nothing happens" symptom.

**3. Defensive: guarantee `checkInOpensAt`/`checkInClosesAt` are populated at submit time**

The current `useEffect` that derives these only runs when `eventDate`, `startTime`, and `endTime` are all set. If the user edits in an order that triggers a submit before the effect commits, the hidden fields can be empty and Zod fails silently. Inside `submit`, before calling `form.handleSubmit`, recompute and `form.setValue` both fields synchronously from the latest `eventDate`/`startTime`/`endTime`/`offsets`. This makes the timing fields always consistent with the visible inputs at submit time.

**4. Apply the same `SelectInput` error pattern to other forms in the file**

Update the Club form's University select and the Template form's Club select (lines ~647, template form) to pass `error={form.formState.errors.universityId?.message}` and `error={form.formState.errors.clubId?.message}` respectively. Same root cause applies there.

### Behavior after the change

- Click **Create Event** with a missing club → red ring on the Club select, inline message under it, and a banner above the submit bar listing every blocking field. No more "nothing happens."
- Click **Create Event** with valid input → request fires as before, redirects to the new event page.
- All other forms using `SelectInput` (Club edit, Template edit) get the same treatment for consistency.

### Files touched

- `src/components/attendance-hq/host-management.tsx` — `SelectInput` accepts `error`; `EventForm` passes errors, adds `onError`, adds form-error summary, syncs hidden datetime fields at submit time; sibling forms pass `error` to their selects.

### Out of scope

- No schema changes in `attendance-hq-schemas.ts`.
- No change to server functions, routing, or the `/events/new` route file.
- No styling overhaul — reuses existing destructive/error tokens.


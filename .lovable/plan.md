

## Fix duplicate club creation on submit

### Root cause

The Create Club form has no submit guard. The network log shows two POST `createClubManagement` calls ~1 second apart (16:30:26 and 16:30:27), creating `sales-club-rhfy` and `sales-club-s8cp` with identical payloads. This is a classic double-submit — a second click, Enter press, or fast retry fires before the first request finishes, and both succeed.

`ClubDialog.submit` in `src/components/attendance-hq/host-management.tsx` awaits `onSubmit(values)` but the button stays enabled the whole time, and there's no in-flight flag.

### What I'll change

**1. Block the double-submit at the form layer (primary fix).**

In `ClubDialog` (`src/components/attendance-hq/host-management.tsx`):
- Track an `isSubmitting` state (or use `form.formState.isSubmitting`).
- Disable the "Create Club" / "Save Club" button while a submission is in flight.
- Early-return from `submit` if it's already running, so rapid Enter + click can't queue two calls.
- Show a subtle spinner/label change ("Creating…") so the user gets feedback.

Apply the same guard to `TemplateDialog`, `EventDialog`, and any other dialogs in this file that take an async `onSubmit` — this is a general class of bug, not just clubs.

**2. Clean up the duplicate clubs that already exist.**

The account currently has two "Sales Club" rows pointing at the same logo path (`sales-club-rhfy` and `sales-club-s8cp`) from the duplicate submit, plus older `SalesClub` / `SalesCLub` from earlier testing. I'll delete `sales-club-s8cp` (the second of the duplicate pair) via a scoped migration so the list looks correct immediately. I'll leave the earlier test clubs alone unless you want those cleared too.

**3. No schema or server changes.**

I considered adding a DB-level unique constraint on `(host_id, club_name, university_id)`, but clubs legitimately can share names across universities and hosts may want two clubs with similar names. A client-side submit guard is the correct fix; a DB constraint would cause false errors.

### Files touched

- `src/components/attendance-hq/host-management.tsx` — add `isSubmitting` guard + disabled button state to `ClubDialog`; same treatment for `TemplateDialog` and `EventDialog` submit handlers.
- `supabase/migrations/<new>.sql` — delete the duplicate `sales-club-s8cp` row for the current host.

### What you'll see after

- Creating a club produces exactly one row, even with a double-click or Enter-then-click.
- The button shows "Creating…" and is disabled until the server responds.
- The stray duplicate on your `/clubs` list is gone.
- Edit, template, and event dialogs get the same protection, so this doesn't resurface elsewhere.


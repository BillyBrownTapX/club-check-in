# Why "Save Club" appears to do nothing

Reproduced against the live DB. The club you're editing (`Sales Club`,
`7b6a85c7-…`) has `university_id = NULL`. When the edit dialog opens, the
form prefills the University select as empty (`""`). The Zod
`clubUpdateSchema` requires `universityId` to be a UUID, so
`handleSubmit` fails validation before any network call — no request is
sent, the button toggles "Saving…" back to "Save Club" almost instantly,
and the only feedback is a small error list at the bottom of the dialog
(often below the fold) plus a toast that's easy to miss above the modal.

DB confirms the state:

```text
clubs.university_id IS NULL for 2 rows:
  - 7b6a85c7-… "Sales Club" (your club)
  - 37950483-… "Sales Club" (another host)
clubs.university_id column: nullable = YES
```

Legacy rows exist because the column is nullable at the DB level even
though the app schema forbids it. Any host who lands on one of these
clubs hits the exact same dead-end.

## Fix (workorder)

### 1. Make the blocker visible in the ClubDialog

File: `src/components/attendance-hq/host-management.tsx` (`ClubDialog`).

- Move the missing-fields error banner ABOVE the form fields, not below
  the submit button, so validation errors are always visible.
- Add a top-of-dialog callout when `isEdit && !form.watch("universityId")`:
  "This club is missing a university. Pick one to continue." — styled
  like the existing "Add a university first" block.
- After the invalid callback fires, scroll the dialog to the top and
  focus the University select (via a ref on `SelectInput`), so the user
  is taken straight to the blocker.
- Keep the existing `toast.error` + inline banner.

### 2. Backfill and lock down `clubs.university_id`

New migration.

- Backfill: for each `clubs` row where `university_id IS NULL`, set it
  to the host's first available university (via `host_profiles` /
  existing university → host relationship the app already uses in
  `getUniversitiesForHost`). If a host has no university, leave the row
  and log it — do not delete.
- Add `ALTER TABLE public.clubs ALTER COLUMN university_id SET NOT NULL`
  after backfill. This matches the Zod contract and prevents recurrence.
- Verify existing GRANTs and RLS remain intact (no schema-level policy
  changes needed).

### 3. Close the create-time hole in onboarding

File: `src/routes/onboarding.club.tsx` (verify) and
`src/lib/attendance-hq.functions.ts` (`createClubManagement` /
onboarding equivalents).

- Confirm every server fn that inserts into `clubs` requires
  `universityId` (Zod uuid). The current `createClubManagement` already
  does; audit the onboarding fn to match.
- If onboarding can currently insert without a university, remove that
  path — with step 2's NOT NULL constraint it would crash at insert.

### 4. Small adjacent bugs surfaced during audit

- **Toaster visibility inside dialogs**: `Toaster` is mounted at
  `top-center` in `__root.tsx`. Radix Dialog uses a z-index that can
  cover it. Bump `Toaster` z-index (or wrap in a portal above dialog)
  so error toasts fired from inside a modal are actually seen.
- **`initialValues` for edit dialog**: when the DB returns `null` for
  `universityId`, `description`, `logoPath`, the form falls back to
  `""` / `null`. That's fine EXCEPT for `universityId` where `""` is
  invalid. Step 1 makes this loud; step 2 removes the possibility.
- **`toast.success` on club create/update**: `createClub.mutateAsync`
  in `clubs.index.tsx` has no success toast (edit path in
  `clubs.$clubId.tsx` also lacks one). Add success toasts consistent
  with the template flow to reduce future "did it save?" confusion.
- **Silent 401 during token refresh**: `useAuthorizedServerFn` throws
  on 401 and triggers sign-out, but `useAuthorizedMutation` swallows
  the error unless the caller shows one. ClubDialog already surfaces
  it via `getManagementErrorMessage`; verify create dialog in
  `clubs.index.tsx` does the same — it currently doesn't (no
  try/catch in its `onSubmit`). Wrap the create submit in a
  try/catch/toast like edit does.

### 5. Verification

- Reload `/clubs/7b6a85c7-…` after the migration → University field is
  pre-filled with the host's university, `Save Club` works.
- New client-side test: open Edit on any club, blank the University
  field, click Save → visible top banner + focused select + toast.
- `supabase--linter` after migration to confirm no new warnings.
- Manual: create a new club without picking a university → blocked with
  a clear message (already true; keep test).

## Technical details

- Zod schemas live in `src/lib/attendance-hq-schemas.ts`. No schema
  changes needed — the DB is what needs to catch up to Zod.
- `ClubDialog` uses `react-hook-form` + `zodResolver`. `isSubmitting`
  briefly flips true during validation, which is why the button
  "cycles" even when no network call is made. This is expected RHF
  behavior; UX fix in step 1 explains it to the user.
- Migration must run in the required order: `CREATE`/backfill →
  `ALTER … SET NOT NULL`. Keep the existing GRANT/RLS block untouched
  (public schema grants for `clubs` are already in place).
- Out of scope for this workorder: broader production-readiness pass
  (rate limits, monitoring, email deliverability). Happy to plan those
  in a follow-up — call it out and I'll scope separately.



## Add club logo upload to Club creation

Let hosts attach a logo when creating a club — both in the `/clubs` "New Club" dialog and in the `/onboarding/club` first-run screen — with the upload field placed above the University selector as requested.

## What you'll see

**In the Create Club dialog and the onboarding club step:**
1. **Club logo** (new, at the top) — square dropzone showing a preview, with "Upload logo" / "Replace" / "Remove" actions. Optional field.
2. University (existing)
3. Club name (existing)
4. Description (existing)

**On club cards / club detail header:** the uploaded logo replaces the default initials avatar.

## Technical approach

### 1. Database
Add an optional `logo_url` column to `public.clubs` to mirror what `host_profiles` already does. It stores the storage object path (not a public URL), so we keep the bucket private and serve via signed URLs.

```sql
alter table public.clubs add column logo_url text;
```

No RLS changes — existing "Hosts can manage own clubs" policy already covers updates to this column.

### 2. Storage
Reuse the existing private `host-logos` bucket with a path convention:
- Host logos: `{userId}/logo-{ts}.{ext}` (unchanged)
- Club logos: `{userId}/clubs/{clubId-or-draft}/logo-{ts}.{ext}`

Scoping every path under `{userId}/` means the existing bucket policies (host owns its folder) keep working without new policies. For the **create** flow, the clubId doesn't exist yet, so we upload to a `draft-{random}` subfolder first and write `logo_url` on insert.

Add storage RLS policies (if not already in place) to allow the owner to `insert/select/update/delete` objects under their own `{auth.uid()}/...` prefix in `host-logos`. I'll verify and add any missing policies in the migration.

### 3. Schema and server
- `clubSchema` and `clubUpdateSchema` in `src/lib/attendance-hq-schemas.ts` get an optional `logoPath: string | null`.
- `createClubManagement` writes `logo_url` on insert.
- `updateClub` writes `logo_url` on update (null clears it).
- `Club` type already comes from generated Supabase types and will include `logo_url` automatically after the migration.

### 4. UI

**New component** `ClubLogoField` in `host-management.tsx` (mirrors the pattern in `AttendanceLogo` but is a controlled form field, not a profile-bound uploader):
- Accepts `value` (storage path) + `onChange`.
- Internally uploads to `host-logos` via the browser Supabase client, returns the path, and shows a signed-URL preview.
- Validates: image/*, ≤ 3 MB.
- Shows spinner, error toast on failure, "Remove" to clear.

**Wire it into both surfaces:**
- `ClubDialog` — render `ClubLogoField` as the first form row, above the University `SelectInput`.
- `src/routes/onboarding.club.tsx` — render the same field above the University `Select`, included in the `createClub` payload.

**Display the logo where the club appears:**
- `ClubRowCard` in `src/routes/clubs.index.tsx` — if `club.logo_url` is set, show the signed image instead of the initials gradient tile.
- Club detail header in `src/routes/clubs.$clubId.tsx` — small logo next to the club name.

A tiny hook `useSignedLogoUrl(path)` (new, in `primitives.tsx` or a new `hooks/use-signed-logo.ts`) centralizes signed-URL resolution with caching, so `ClubRowCard` isn't hammering storage per render.

## Files changed

- `supabase/migrations/<new>.sql` — add `logo_url` column, add any missing `host-logos` storage policies.
- `src/lib/attendance-hq-schemas.ts` — add optional `logoPath` to `clubSchema` / `clubUpdateSchema`.
- `src/lib/attendance-hq.functions.ts` — write `logo_url` in `createClubManagement` and `updateClub`.
- `src/components/attendance-hq/host-management.tsx` — new `ClubLogoField`; `ClubDialog` renders it above University.
- `src/routes/onboarding.club.tsx` — render `ClubLogoField` above the University select; pass `logoPath` to `createClub`.
- `src/routes/clubs.index.tsx` — `ClubRowCard` renders the uploaded logo when present.
- `src/routes/clubs.$clubId.tsx` — show logo in the club detail header.
- (optional) `src/hooks/use-signed-logo.ts` — small signed-URL hook with in-memory cache.

## Out of scope

- No changes to the public check-in page's logo (that's the host profile logo, already handled).
- No bulk logo migration or cropping/resizing UI — file is uploaded as-is (with size cap) and rendered `object-cover`.
- No change to host profile logo behavior.


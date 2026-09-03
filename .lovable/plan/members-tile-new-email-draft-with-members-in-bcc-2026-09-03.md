# Members tile → new email draft with members in BCC

## Goal
Clicking the "Members" tile on Home opens a new draft in the host's own default mail app with every club member's email pre-filled in BCC. The CSV export stays only on the "View roster" quick action.

## Changes

### 1. Server function: member email list (`src/lib/attendance-hq.functions.ts`)
- Add `getHostMemberEmails` (authenticated, same `requireSupabaseAuth` pattern as `getHostMemberMetrics`).
- Resolves the host's accessible clubs via the existing `getAccessibleClubIds` helper, then collects unique non-empty `student_email` values from `attendance_records` + `pre_check_ins` across all events in those clubs (reusing the same pagination pattern as `getHostMemberMetricsForUser` — or extracting a shared helper to avoid duplication).
- Returns a sorted, deduplicated `string[]`.

### 2. Home tile behavior (`src/routes/home.tsx`)
- Replace the Members tile's `onClick={handleExportMembers}` with a new `handleEmailMembers`:
  - Calls `getHostMemberEmails` (via `useServerFn`/direct call with the session).
  - If no emails: toast "No member emails yet."
  - Builds `mailto:?bcc=<comma-separated emails>` and opens it via `window.location.href`.
  - Length safety: `mailto:` URLs break around ~2000 chars. If the encoded URL exceeds a safe threshold (~1800 chars), fall back to copying the full BCC list to the clipboard and toast "List too long for one draft — member emails copied to clipboard." (Optional refinement: open the draft with as many as fit and copy the remainder; default to clipboard-only fallback for simplicity.)
  - Loading state on the tile while fetching (spinner hint), error toast on failure.
- The tile hint text updates from "tap to export" to "tap to email all".
- `handleExportMembers` stays, still wired to the "View roster" quick action — unchanged.

### 3. Cleanup
- Remove the "View roster" CSV references only if they become unused (they won't — View roster keeps it).

## What does NOT change
- CSV export endpoint (`/api/host/members.csv`) and the View roster quick action.
- Metrics server function, tiles layout, greeting, featured event, recent events.
- No schema changes, no Gmail connector — drafts open in whatever mail app the host uses.

## Verification
- TypeScript check passes.
- Manual check: Members tile opens a mail draft with BCC populated (small roster), clipboard fallback triggers correctly for oversized lists, View roster still downloads the CSV.

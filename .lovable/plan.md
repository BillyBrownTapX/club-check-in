

## Make "Create Club" surface its failure (and harden the dialog)

### Why "Create Club" does nothing

The Create Club button calls `form.handleSubmit(success)` in `ClubDialog`. When validation fails, react-hook-form silently skips the success branch — no `onError` is wired. The only validation feedback today is an inline message under the field. In the session that triggered this report, the user filled `clubName` + `description` but never selected a **University** (the schema requires `universityId: z.string().uuid("Choose a university")`). Result: Zod fails on `universityId`, the success handler never runs, the button briefly disables, and the dialog appears frozen. There is no banner, no toast, no scroll-to-error, no `onError` callback — exactly the same class of bug we fixed in `EventForm`, just left unfixed in `ClubDialog`.

Two adjacent risks make this worse:

1. **No-universities guard.** If `getUniversitiesForHost()` returns an empty array, the University select renders with no options. Submitting is impossible and the dialog gives no explanation.
2. **`EMPTY_SELECT_VALUE` leak.** `SelectInput` substitutes `"__empty__"` when `value === ""`. The handler maps it back to `""`, but `SelectItem` reuses the same sentinel for any option whose `value` is falsy. If a row ever lands in `universities` with an empty id (data error), picking it sets `universityId = ""` and the user can't tell why submit fails.

### Fixes (single file: `src/components/attendance-hq/host-management.tsx`)

**1. `ClubDialog` — wire the same error UX `EventForm` got.**

- Replace `form.handleSubmit(success)` with `form.handleSubmit(success, onError)`. `onError` sets the dialog-level `error` state to "Please fix the highlighted fields before saving." This is the exact symptom fix — submit always produces visible feedback.
- Add a small **inline error summary** above the submit button that lists every blocking field by friendly label. Use a static map: `universityId → "University"`, `clubName → "Club name"`, `description → "Description"`, `logoPath → "Logo"`. The summary renders only when `Object.keys(form.formState.errors).length > 0`.
- Render the summary in a `rounded-2xl bg-destructive/10 text-destructive` block so it reads as the same destructive token used elsewhere.

**2. Empty-universities guard.**

- When `universities.length === 0`, render a tonal info card inside the dialog ("Add a university first to your workspace before creating a club.") and disable the Create button. This converts an unsolvable form into a clear, actionable state instead of "nothing happens."
- Pass an `onAddUniversity` opt-in path later if needed; for now the message is sufficient.

**3. Harden `SelectInput` against the empty-value sentinel.**

- Filter `options` to drop any entry where `option.value` is empty before rendering. This prevents the `EMPTY_SELECT_VALUE` collision entirely. An empty-value option in a "Choose X" select is always a data bug; silently dropping it is safer than letting the user pick "nothing" by accident.
- Add a `disabled` prop forwarded to `SelectTrigger` so the dialog can disable the field cleanly when there are zero universities.

**4. Same treatment for `TemplateDialog`.**

- `TemplateDialog` has the identical `form.handleSubmit(success)` shape with no `onError`, no summary banner, and a required `clubId` UUID. Apply the same `onError` + summary pattern there using a label map (`templateName`, `defaultEventName`, `defaultLocation`, `defaultStartTime`, `defaultEndTime`, `defaultCheckInOpenOffsetMinutes`, `defaultCheckInCloseOffsetMinutes`). Prevents the next "nothing happens" report on Templates.

**5. Toast on unexpected server failure.**

- In `ClubDialog`'s success branch, the `catch` already sets local `error`. Also fire `toast.error(...)` so the failure is visible even if the user has already scrolled away from the inline banner. Mirrors the `DeleteConfirmButton` pattern already in this file.

### Behavior after the fix

- Click **Create Club** without picking a university → red ring on the University select, inline message under it, **and a destructive banner above the button** listing "University" as the missing field. The button is no longer a dead end.
- Open the Create Club dialog with zero universities loaded → see an explanatory card and a disabled submit, instead of an unsolvable form.
- Picking a university with a malformed empty id is no longer possible (filtered out at render).
- Same fix lands on `TemplateDialog` so the same class of bug doesn't resurface there.

### Out of scope

- No schema changes in `attendance-hq-schemas.ts`.
- No changes to `createClubManagement`, `updateClub`, or any server function.
- No changes to `clubs.index.tsx`, `clubs.$clubId.tsx`, or `onboarding.club.tsx`.
- No new dependencies; reuses existing tokens, `Button`, `Select`, `toast`.

### Files touched

- `src/components/attendance-hq/host-management.tsx` — `ClubDialog` (`onError` + summary + empty-universities guard + toast), `TemplateDialog` (same `onError` + summary), `SelectInput` (drop empty-value options + `disabled` prop).


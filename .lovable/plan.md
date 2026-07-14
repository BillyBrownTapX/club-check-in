## Diagnosis

You are not reaching the backend create-club action when the button is clicked. The network trace shows logo uploads and read requests, but no create-club server request after repeated “Create Club” clicks. That means the form is failing client-side validation first, so the button briefly flips to “Creating…” and then resets.

The most likely blocker is the required University value. The club schema requires `universityId` to be a valid ID, and the create dialog starts with `universityId: ""`. If the University select is still empty, stale, disabled, or visually unclear on mobile, the form refuses to submit before any database write happens. The current UI can still feel like “nothing happened” because the invalid-submit handler only shows a generic message/toast and does not scroll/focus the user to the exact blocker.

## Workorder

### 1. Make the create-club blocker obvious
- Update `ClubDialog` so create and edit validation errors appear at the top of the visible dialog immediately after submit.
- On invalid submit, scroll the dialog content to the top and focus/highlight the first invalid field, especially University.
- Add a direct message for create mode when University is missing: “Choose a university to create this club.”
- Keep the submit button disabled only when creation truly cannot proceed, and show the reason next to the button.

### 2. Prevent missing University from being a silent failure
- If the host has exactly one available university, preselect it automatically for create-club and onboarding-club forms.
- If the host has zero universities, show a blocking state before the rest of the form instead of letting the user fill fields that cannot be submitted.
- Make the University select placeholder and error state visually stronger on mobile.

### 3. Harden the create submit path
- Wrap the `clubs.index.tsx` create submit in explicit `try/catch` so backend errors are always shown as a toast and inline dialog error.
- Ensure a successful create closes the dialog, shows a success toast, invalidates club lists, and navigates or visibly shows the new club.
- Prevent duplicate click loops while validation or submission is in progress.

### 4. Check backend consistency
- Confirm the `clubs.university_id` column is now required and that all existing club rows have valid universities.
- Confirm the create-club server function validates `universityId`, sets `host_id` from the signed-in user, and returns clear errors if a write is rejected.
- Verify the current user can read available universities and create clubs under the existing access rules.

### 5. Add regression coverage for production readiness
- Add a focused browser test for: open New Club, leave University blank, click Create, see visible University error and focus.
- Add a focused browser test for: create a valid club, see success feedback, and verify the club appears in the list.
- Add a backend/data check to ensure future migrations cannot reintroduce nullable club universities.

## Acceptance criteria

- Clicking “Create Club” with missing University visibly explains the issue and moves the user to the University field.
- Clicking “Create Club” with all valid fields actually sends the create request and creates the club.
- Hosts with one university do not need to manually select it.
- Hosts with no universities get a clear blocking message instead of a dead form.
- The club list updates immediately after creation.
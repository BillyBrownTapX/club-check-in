

## Why nothing seems to happen on "Create Event"

Diagnosis from your session replay + the bootstrap network response:

- The button flashes **"Saving…" → "Create Event" within ~5ms** on every click. That's faster than any network call — it means React Hook Form ran sync validation, found errors, and called the *invalid* branch of `handleSubmit` without ever invoking `onSubmit`.
- The bootstrap `initialValues` from `getEventFormPayload` come back with `eventName: ""` (and `location: ""`). The Zod schema requires `eventName.trim().min(2, "Enter an event name")`.
- So validation fails on `eventName`, the in-field error appears next to the Event name input, and an error banner ("Fix these before saving") gets rendered — but **both are above the fold of a long form, while the Create button is in a sticky bar pinned to the bottom of the viewport**. From the user's perspective, the click does nothing.

The data layer is fine. This is purely a feedback / discoverability problem after the recent refactor — the form is silently rejecting the submit with no visible signal near the button.

## What to change

### `src/components/attendance-hq/host-management.tsx` — `EventForm`

**1. Surface the blocking errors near the button**

Inside `StickyCtaBar`, above the `<Button>`, render a compact one-line error pill whenever `Object.keys(form.formState.errors).length > 0`:

```
"Fix highlighted fields above" + a count
```

This is the minimum signal so a user clicking the bottom CTA immediately sees *why* nothing happened, even if the full error summary is scrolled out of view.

**2. Auto-scroll to the first error on failed submit**

In the existing `handleSubmit` invalid branch (line 1091-1093), in addition to setting the local `error` string, find the first errored field name and scroll its input into view, focused:

```ts
() => {
  setError("Some fields need attention — see highlighted errors above.");
  const firstField = Object.keys(form.formState.errors)[0];
  if (firstField) {
    form.setFocus(firstField as keyof EventFormValues);
  }
}
```

`form.setFocus` from RHF both focuses the input and (because all our inputs are real DOM inputs) the browser scrolls them into view. This single line fixes the "click does nothing" feeling for both create and edit flows.

**3. Default the event name when creating from scratch**

In `getEventFormPayload`'s create-from-scratch path (no template, no duplicate source), seed `eventName` with a sensible default like `"Untitled event"` so a host can submit immediately and rename later. This matches how most calendar apps behave and removes the most common foot-gun — but it's optional and only worth doing if you want a frictionless first-create. If you'd rather keep an explicit name requirement, skip this step; #1 and #2 alone solve the "nothing happens" complaint.

## Files touched

- `src/components/attendance-hq/host-management.tsx` — `EventForm` (sticky-bar error pill + auto-focus first error)
- `src/lib/attendance-hq.functions.ts` — *only if* you want #3 (default event name in `getEventFormPayload`)

## Out of scope

- No schema relaxation — `eventName.min(2)` is the right rule.
- No changes to mutations, query keys, or server functions.
- No changes to the `EventForm` layout or visual design beyond the sticky-bar inline error.

## Open question

Do you want option #3 (default `"Untitled event"` so hosts can submit instantly), or keep the explicit-name requirement and rely solely on the inline error feedback from #1 + #2?


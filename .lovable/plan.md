## What's happening

Walking the "New Template" flow from `src/routes/clubs.$clubId.tsx` → `TemplateDialog` in `src/components/attendance-hq/host-management.tsx` → `createEventTemplate` server fn, the code path is wired correctly. The mutation fires, the server fn inserts the row, and the dialog is closed on success.

The reason it *looks* like "nothing happened" is a **missing user-feedback path on the template create/update mutations only** — every other write in this file toasts on success (`toast.success("Event created", …)`, `toast.success("Club deleted")`, etc.) but the template `onSubmit` handler passed into `TemplateDialog` from `clubs.$clubId.tsx` does not:

```tsx
onSubmit={async (values) => {
  if (editingTemplate) await updateTemplateMutation.mutateAsync(values as never);
  else await createTemplateMutation.mutateAsync(values as never);
}}
```

Combined with a few smaller UX gaps, from the host's chair this reads as a dead button:

1. **No success toast.** Dialog just closes with no confirmation.
2. **The Templates list is far below the fold** on `/clubs/:clubId` (stats → 2×2 tiles → upcoming events → past events → templates). After the dialog closes the viewport is still on the tiles, so the new card is invisible without scrolling.
3. **Silent validation failures are easy to miss.** If any number field (open/close offset) is cleared, `valueAsNumber` yields `NaN`, Zod rejects it, and the invalid handler only sets an inline banner — no toast, and the banner renders inside the dialog area the user just scrolled past.
4. **Server errors are caught inside `TemplateDialog` and toasted there**, which is fine — but because there's no success toast, the *absence* of a toast is indistinguishable from success. So a caught error and a real success look identical to the user.

The network log window we have ends before the click, so I can't 100% rule out a request that actually failed — but based on the schema (all fields except `templateName` are optional-or-empty-string, `clubId` defaults from props to a valid uuid, offsets default to 15/20) and the RLS/GRANTs already in place for `event_templates`, the create request itself should succeed for the signed-in host on this route. The bug we can prove from the code alone is the feedback gap.

## Fix

Scoped, presentation-only — no server fn / schema / DB changes.

**1. Add success + error feedback in `src/routes/clubs.$clubId.tsx`**

Rewrite the `TemplateDialog` `onSubmit` prop so both branches surface a toast, mirroring the club/event flows already in the same file:

```tsx
onSubmit={async (values) => {
  if (editingTemplate) {
    const t = await updateTemplateMutation.mutateAsync(values as never);
    toast.success("Template saved", { description: t.template_name });
  } else {
    const t = await createTemplateMutation.mutateAsync(values as never);
    toast.success("Template created", { description: t.template_name });
  }
}}
```

`TemplateDialog` already re-throws on failure (its own catch toasts + keeps the dialog open), so this doesn't double-toast errors.

**2. Make validation failures loud in `TemplateDialog` (`src/components/attendance-hq/host-management.tsx`)**

In the `form.handleSubmit(..., onInvalid)` callback, also fire `toast.error("Please fix the highlighted fields before saving.")` in addition to the inline banner, and scroll the first error field into view. This category-fixes the same silent-failure risk on the Club dialog's invalid handler too, which has the identical pattern.

**3. Harden the number inputs**

Change the two offset registers from `valueAsNumber: true` to `setValueAs: (v) => v === "" ? undefined : Number(v)` so a cleared field becomes a Zod "Required" error with a clear message instead of a silent `NaN` rejection. Same treatment on the club dialog if it has numeric fields.

## Verification

- Sign in as the current host, open a club, click **New**, fill all fields, submit → expect a green "Template created" toast, the dialog to close, and the new card to appear in Templates.
- Edit an existing template → "Template saved" toast, updated fields render.
- Clear the "Open offset minutes" field and submit → red toast + inline banner naming the field, dialog stays open.
- No new deps, no server-side changes; typecheck + build must stay clean.

## Out of scope

- Restructuring the `/clubs/:clubId` page order so Templates aren't below the fold (larger UX change; not required to fix the reported bug).
- Adding an animated highlight on the newly-created template card (nice-to-have follow-up).
- Any change to `createEventTemplate` / `updateEventTemplate` server fns or the `event_templates` schema.

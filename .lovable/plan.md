
Build out the event-management surface so hosts can reliably run 50–200 person meetings with live monitoring, fast issue correction, clean QR projection, and strong post-event review.

1. Strengthen the event detail page into a real operations console
- Update `src/routes/events.$eventId.tsx` to support high-usage host workflows instead of only showing a raw attendance list.
- Add attendance tools for:
  - roster search by student name, email, or 900 number
  - method filter (first scan, returning, remembered)
  - sort modes such as newest first / oldest first
- Add a “recent check-ins” emphasis so hosts can quickly see who just arrived during active meetings.
- Keep the current live polling, QR tools, export, duplicate, and close-check-in actions intact.

2. Add host correction workflows for attendance issues
- Extend the event page with safe manual workflows for common operational problems:
  - manual add/check-in when a student cannot complete mobile check-in
  - restore attendance after accidental removal
  - clearer remove/restore confirmations and success feedback
- Add server-side support in `src/lib/attendance-hq.functions.ts` for these correction flows with the same ownership checks already used elsewhere.
- Reuse existing student validation rules from `src/lib/attendance-hq-schemas.ts`, especially email validation and 9-digit 900 number rules.
- Show these actions directly in the event ops UI so hosts can fix issues fast without leaving the page.

3. Improve event settings so hosts can control the check-in window strategically
- Upgrade the shared `EventForm` in `src/components/attendance-hq/host-management.tsx` so event setup is not limited to hidden derived timestamps.
- Expose clear controls for check-in timing behavior:
  - open minutes before start
  - close minutes after end
  - computed read-only timestamps preview
- Keep sane defaults, but let hosts tune the event for realistic student arrival patterns.
- Preserve existing create/edit/duplicate flows in:
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.edit.tsx`
  - `src/routes/onboarding.event.tsx`

4. Add event lifecycle controls that match real operations
- Expand event management so a host can clearly see and control status:
  - open / upcoming / closed / inactive / archived
  - reopen by editing the window
  - archive old events intentionally
- Keep current close-early support, but make the event page messaging and controls more explicit so hosts understand what students can or cannot do at that moment.
- Improve empty and blocked states so they explain what the next operator action should be.

5. Improve the QR projection and room display experience
- Refine `src/routes/events.$eventId.display.tsx` for live meeting use:
  - stronger attendance count prominence
  - “last updated” visibility
  - clearer status when check-in is upcoming or closed
  - safer full-screen presentation behavior
- Keep the current fast polling model, but align the display copy with the event’s real status so hosts can project it confidently in the room.

6. Make event list pages more useful for ongoing operations
- Improve `src/routes/events.index.tsx` so the event list works as a real control center:
  - better status grouping for upcoming vs active vs past
  - more actionable summary cards
  - clearer attendance totals and event state labels
- Ensure the list helps a host jump into the correct active event quickly during a busy meeting day.

7. Add post-event review visibility
- Extend the event detail page with simple review tools for after the meeting:
  - total attendance summary
  - attendance method breakdown
  - event metadata summary
  - CSV export kept as the canonical record
- Keep this lightweight and operational, not a full analytics module.

8. Backend and data changes needed
- Review `attendance_actions` support and extend server functions to write/read operational history needed for restore/manual-change flows.
- Use migrations only if a schema change is truly needed for event ops history or manual attendance support; otherwise prefer existing tables and server functions.
- Preserve current ownership protections:
  - event ownership via club ownership
  - host-only event management
  - public student check-in kept separate from host tools

9. Files most likely to change
- `src/routes/events.index.tsx`
- `src/routes/events.$eventId.tsx`
- `src/routes/events.$eventId.edit.tsx`
- `src/routes/events.$eventId.display.tsx`
- `src/routes/events.new.tsx`
- `src/routes/onboarding.event.tsx`
- `src/components/attendance-hq/host-management.tsx`
- `src/lib/attendance-hq.functions.ts`
- `src/lib/attendance-hq-schemas.ts`
- possibly `src/lib/attendance-hq.ts` for new event ops types

10. Technical implementation notes
- Keep the existing architecture: TanStack route pages + shared management components + server functions.
- Do not redesign authentication or public QR check-in flows.
- Prefer focused additions over broad rewrites.
- For 50–200 student events, optimize UX around operator speed:
  - fewer page hops
  - clear filters
  - fast corrections
  - readable live state
- Continue using host-authorized server functions for all protected event actions.

11. Validation after implementation
- Create, edit, duplicate, and open an event end-to-end.
- Verify the event detail page loads once, polls cleanly, and stays responsive.
- Test live attendance monitoring with search/filter on the roster.
- Test remove and restore/manual correction flows.
- Test QR display mode and projected count updates.
- Test true closed/upcoming/inactive states.
- Export CSV and verify data accuracy after attendance changes.
- Check the flow on mobile and desktop for both hosts and students.

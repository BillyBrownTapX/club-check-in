
Build the authenticated clubs/events management layer as the host’s operational workspace after onboarding, reusing the current visual system and event-detail handoff while adding the missing routes, ownership-safe data access, and lightweight CRUD flows.

1. Route structure and navigation
- Add host-only management routes:
  - `/clubs`
  - `/clubs/$clubId`
  - `/events`
  - `/events/new`
  - `/events/$eventId/edit`
- Keep `/events/$eventId` as the post-create/post-duplicate destination.
- Update host navigation so it only links to real routes:
  - remove or replace the current broken `/dashboard` nav target
  - use Clubs and Events as the primary workspace entry points
- Add auth guards to all management routes using the existing auth provider pattern so unauthenticated users are redirected to `/sign-in`.

2. Shared management UI system
- Extend the existing host primitives into a dedicated management set:
  - `ManagementPageShell`
  - `PageHeader`
  - `ClubCard`
  - `EventCard`
  - `TemplateCard`
  - `StatsCard`
  - `FilterBar`
  - `FormCard`
  - `EmptyStateBlock`
  - `PrimaryButton`
  - `SecondaryButton`
  - `StatusBadge`
  - `SearchInput`
  - `DateInput`
  - `TimeInput`
  - `TextInput`
  - `TextAreaInput`
  - `SelectInput`
- Reuse current cards/buttons where possible instead of creating a second design language.
- Keep mobile-first behavior:
  - stacked cards on phones
  - compact responsive grids on desktop
  - no dense data tables as the default UI

3. Backend/query foundation for management
- Add new server functions for host management data instead of relying on ad hoc client queries:
  - get all host clubs with event counts
  - get one club detail with upcoming events, past events, and templates
  - get host events list with club join and attendance counts
  - get event form payload for edit/duplicate
  - create club for non-onboarding use
  - update club
  - update event
  - duplicate event
  - update template
  - duplicate template
- Keep ownership checks server-side by verifying the authenticated host owns the club or the event’s parent club before returning or mutating data.
- Preserve current use of backend-generated QR tokens for new and duplicated events.

4. Clubs page: `/clubs`
- Build a focused list/grid page with:
  - title and short supporting copy
  - `Create Club` primary action
  - responsive club cards
- Each club card should show:
  - club name
  - description
  - active/inactive status if useful
  - upcoming event count
  - past event count
  - actions: Manage Club, Create Event
- Add empty state:
  - “No clubs yet”
  - CTA to create a club
- Implement club creation as a lightweight inline form, dialog, or dedicated card on the page to avoid unnecessary route sprawl.

5. Club detail page: `/clubs/$clubId`
- Build this as the control center for one club with:
  - compact club header card
  - quick action row
  - quick stats
  - upcoming events section
  - past events section
  - templates section
- Quick actions:
  - Create Event
  - Create Template
  - Edit Club
- Stats:
  - Upcoming Events
  - Past Events
  - Total Check-Ins if easily derived from joined attendance counts
- Sections:
  - upcoming events with manage/edit links
  - past events with duplicate action
  - template cards with Use, Edit, Duplicate
- Add dedicated empty states for missing upcoming events, past events, and templates.

6. Events page: `/events`
- Build a centralized cross-club event list with:
  - page header
  - `Create Event` primary action
  - optional `Use Template` helper action
  - lightweight filter row
  - events list/cards
- Filters:
  - club selector
  - status selector: upcoming / past / all
  - optional name search if it stays visually clean
- Each event item shows:
  - event name
  - club name
  - date/time
  - location
  - attendance count
  - check-in status
  - actions: Manage Event, Edit, Duplicate
- Add empty states for:
  - no events at all
  - no filter matches

7. Create event flow: `/events/new`
- Build a general-purpose event form that works beyond onboarding:
  - club selector
  - template shortcut block if templates exist
  - event fields
  - full-width primary CTA
- Reuse current event defaults behavior:
  - suggest check-in opens 15 minutes before start
  - suggest check-in closes 20 minutes after start
  - keep values editable
- Add support for prefilled creation from:
  - selected club
  - chosen template
  - duplicate source event
- On success, redirect directly to `/events/$eventId`.

8. Edit event flow: `/events/$eventId/edit`
- Reuse the same event form shell with prefilled values.
- Keep the UI focused:
  - title “Edit Event”
  - save changes CTA
  - cancel action
- Validate ownership server-side before loading or saving.
- Preserve the existing event’s QR token on edit; only duplicates get a new token.

9. Duplicate event flow
- Implement duplicate as a shortcut, not a separate complex workflow.
- Trigger from:
  - events page
  - club detail past/upcoming event cards
  - optionally event detail later via reuse
- Behavior:
  - load source event
  - prefill create-event form with copied values
  - allow host to adjust date/time/location
  - create a brand-new event with a fresh QR token
  - redirect to the new event detail page
- Support duplication either via:
  - `/events/new?duplicateFrom=<eventId>`
  - or a dedicated server function that returns prefill data for the create form

10. Lightweight template management
- Keep templates secondary to events and scoped to club context.
- Manage templates inside the club detail page using dialogs or inline form cards.
- Support:
  - create template
  - edit template
  - duplicate template
  - use template to prefill `/events/new`
- Template cards should show:
  - template name
  - default location
  - default time
  - open/close offset summary
- “Use Template” should send the host into a prefilled create-event flow, not create an event instantly.

11. Club editing
- Add a minimal edit-club flow within the club detail page.
- Fields:
  - club name
  - description
  - is_active if included
- Keep slug generation/update logic server-side and predictable.
- Avoid deep settings or secondary club configuration.

12. Schema and validation updates
- Extend the existing Zod schema layer with:
  - club update schema
  - event update schema
  - template update schema
  - lightweight filters/search schema if needed
- Reuse the existing `eventSchema`/`validatedEventSchema` base for create/edit event forms.
- Keep all validation inline in forms with concise errors.

13. Routing, loaders, and boundaries
- For any management route using loaders, add both:
  - `errorComponent`
  - `notFoundComponent`
- Use server functions in route loaders for initial data so ownership failures and missing records resolve cleanly.
- Ensure links use TanStack typed params consistently for `/clubs/$clubId` and `/events/$eventId`.

14. Technical details
- Prefer server functions over direct client-side multi-query orchestration for the new management layer.
- Reuse existing types in `attendance-hq.ts`, but add focused derived types for:
  - club summary with counts
  - club detail payload
  - event management list item
  - template summary
- Avoid editing generated route tree files manually.
- Keep all new routes/components in the existing Attendance HQ namespace for consistency.

15. Acceptance checks
- Authenticated host can:
  - view all owned clubs
  - open a club detail page
  - create another club
  - view centralized events
  - filter events by club and upcoming/past
  - create an event from scratch
  - edit an event
  - duplicate an event into a new record
  - create/edit/duplicate/use templates from a club
  - land on `/events/$eventId` after create/duplicate
- Unauthorized hosts cannot access another host’s club/event/template data.
- Mobile layout remains card-first and action-oriented with no critical horizontal scrolling.

16. Known fixes to include while implementing
- Replace the broken `/dashboard` navigation target in `HostAppShell`.
- Wire the currently nonfunctional template buttons (`Use`, `Edit`, `Duplicate`) to real behaviors.
- Introduce proper post-onboarding workspace landing behavior so authenticated hosts can move into Clubs or Events instead of relying only on the onboarding event redirect.

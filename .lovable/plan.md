

## Rebuild `/clubs/$clubId` with the full mobile iOS layout

### Goal

Bring the Club detail page in line with the rest of the app (Home / Events / Event detail) at 390×844: large title, ios-card hero, tap-friendly action tiles, horizontally-scrolling stats, and grouped sections — without changing any logic, server calls, or data flow.

### Layout (top → bottom)

```text
┌─────────────────────────────────────┐
│  LargeTitleHeader                   │
│  eyebrow: University name           │
│  title:   {club name}               │
│  trailing: ✎ Edit (icon button)     │
├─────────────────────────────────────┤
│  ios-card hero                      │
│  [logo 56×56] {name} • Active chip  │
│  description text (or placeholder)  │
├─────────────────────────────────────┤
│  Stats — horizontal scroll          │
│  [Upcoming] [Past] [Check-ins]      │
├─────────────────────────────────────┤
│  2×2 ActionTile grid                │
│  [Create Event ★gold] [New Template]│
│  [Edit Club]          [Delete Club] │
├─────────────────────────────────────┤
│  Section: Upcoming events    View → │
│  EventCard list (mobile variant)    │
├─────────────────────────────────────┤
│  Section: Past events        View → │
│  EventCard list                     │
├─────────────────────────────────────┤
│  Section: Templates       + Create  │
│  TemplateCard list (single column)  │
└─────────────────────────────────────┘
```

### Changes to `src/routes/clubs.$clubId.tsx`

1. **Header** — replace `PageHeader` with `LargeTitleHeader`:
   - `eyebrow = data.club.universities?.name ?? "University needed"`
   - `title  = data.club.club_name`
   - `trailing = <Button variant="tonal" size="icon" className="rounded-full" aria-label="Edit club" onClick={() => setClubDialogOpen(true)}><Pencil/></Button>`

2. **Hero card** — replace the `FormCard` block with a single `ios-card rounded-[1.75rem] p-5`:
   - Row: existing `ClubHeaderLogo` (kept as-is) + name + iOS `<Chip tone={is_active ? "success" : "muted"}>` for status.
   - Description paragraph (or muted placeholder).
   - Remove the inline 4-button row entirely (actions move to the ActionTile grid below).

3. **Stats strip** — replace the stacked `StatsCard` grid with a horizontal scroller using `StatTile` (same primitive Home uses):
   ```tsx
   <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
     <div className="flex gap-3 pb-1">
       <StatTile label="Upcoming" value={data.stats.upcomingEvents} icon={CalendarDays} />
       <StatTile label="Past"     value={data.stats.pastEvents}     icon={History} />
       <StatTile label="Check-ins" value={data.stats.totalCheckIns} tone="blue" icon={Users} />
     </div>
   </div>
   ```

4. **2×2 ActionTile grid** — primary commands, each with icon + visible label + hint:
   - `Create Event` — tone `gold`, links to `/events/new` with current `clubId`.
   - `New Template` — tone `default`, opens `TemplateDialog`.
   - `Edit Club` — tone `default`, opens `ClubDialog`.
   - `Delete Club` — tone `default` but rendered with destructive accent; on tap, opens an `ActionSheet` (already exists in `host-management.tsx`) with a destructive `ActionSheetItem` → `handleDeleteClub`. Uses `ActionSheet` instead of `DeleteConfirmButton` so confirmation is mobile-native.

5. **Sections** — `SectionLabel` instead of `<h2>` headings, and a small inline trailing link/button on the right of each section header:
   - `Upcoming events` → "View all" `Link` to `/events?clubId=…&status=upcoming`.
   - `Past events`     → "View all" link.
   - `Templates`       → small `+` button that opens `TemplateDialog`.
   
   Each section list becomes a single-column stack of the existing mobile-first `EventCard` / `TemplateCard` (no `xl:grid-cols-3` for templates).

6. **Empty states** — keep `EmptyStateBlock` but call it from inside the new layout so spacing matches.

7. **Dialogs (`ClubDialog`, `TemplateDialog`) and all server-fn handlers** — kept exactly as they are. Only the JSX tree above them is rewritten.

8. **Imports cleanup** — drop `PageHeader`, `FormCard`, `PrimaryButton`, `SecondaryButton`, `StatsCard`, `DeleteConfirmButton`, `Trash2`, `Button`. Add `LargeTitleHeader`, `SectionLabel`, `Chip`, `StatTile`, `ActionTile` from `@/components/attendance-hq/ios`, plus `ActionSheet`, `ActionSheetItem` from `host-management`, and `Pencil`, `History`, `Users`, `WandSparkles`, `Plus` icons from `lucide-react`.

### Files touched

- `src/routes/clubs.$clubId.tsx` — full JSX rebuild; logic, state, effects, and server calls untouched.

### Out of scope

- No changes to `host-management.tsx` (EventCard / TemplateCard / dialogs already mobile-first from previous step).
- No changes to `getClubDetail`, `updateClub`, `deleteClub`, template mutations, or routing.
- No new dependencies; reuses primitives from `ios.tsx` and `host-management.tsx`.
- Desktop view stays graceful — single column centered in the existing 480–520px shell.


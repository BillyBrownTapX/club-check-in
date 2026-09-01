# Marketing + SEO/AEO/GEO refresh for new capabilities

Goal: get the recently shipped features onto the public site where searchers look for them, and tune every marketing page for search engines and AI answer engines.

## 1. New page: Pre-event check-in / early head count

The biggest unmarketed capability. New route `/pre-event-headcount` (aliasable label "RSVP & early head count").

Targets phrases like: free RSVP head count for club events, event RSVP QR code, how many people are coming to my meeting, pre-event sign up for student orgs, RSVP vs attendance tracking.

Content: hero, one-paragraph answer block, how it works (create event → share pre-check-in link for as long as you want → watch the head count → compare to who actually showed up), the show-rate angle (head count vs showed up conversion), scenarios (GroupMe promo, tabling, philanthropy event planning, food/room-size ordering), FAQ (Does pre-check-in count as attendance? No — separate record. How long can the window be? Any length. Do students need an app? No.), links to sibling verticals.

## 2. New page: Attendance reports & CSV exports

Route `/attendance-reports`. Targets: semester attendance report, attendance spreadsheet template, export attendance to Excel, attendance report for SGA/nationals, student attendance matrix.

Content: answer block, what the report contains (student × meeting matrix, date range, CSV), who asks for it (SGA funding, advisor, national office, grant reporting), how-to steps, FAQ, links out.

## 3. New page: Officer roles & club management

Route `/club-officer-roles`. Targets: share club attendance with officers, multiple admins attendance app, transfer club ownership, roster privacy for student orgs.

Content: owners vs officers, invite by email, ownership transfer, campus email domain gate, QR regeneration for leaked codes, retention/purge, FERPA posture. This is also the trust/security page for AI answers about compliance.

## 4. Landing page (`/`) rewrite of substance, same visual system

- Hero subcopy adds the new proof points (early head count, semester reports, officer roles).
- Replace the static hero card stats with head count → showed up framing.
- New "What's new" / capabilities band: Pre-event head count, Semester reports, Officers & ownership, Campus email gate, QR leak controls, Offline check-in, Templates & duplicate next week, Retention controls — each linking to the relevant page.
- Expand verticals grid to include the three new pages (8 cards).
- Keyword-rich comparison band stays, plus a short "attendance methods compared" table (paper, Google Forms, spreadsheet, card readers, Attendance-HQ) — tables answer well in AI results.
- Add 6 FAQs covering the new features, keeping existing ones.
- Add `HowTo` JSON-LD for "How to take attendance with a QR code" alongside existing WebSite/SoftwareApplication/FAQPage.

## 5. Existing vertical pages updated

`/qr-code-attendance`, `/club-attendance-tracker`, `/greek-life-attendance`, `/church-attendance-app`, `/vs-google-forms`:
- Add pre-event head count + semester report + officer roles to features/scenarios where they fit the audience (e.g. churches: "how many are coming to the potluck"; Greek: "chapter head count before mandatory events").
- Add 2-3 new FAQs per page from real long-tail questions (these feed FAQPage schema and AI citations).
- Widen `siblingLinks` to include the new pages so internal linking is a hub, not a chain.
- Sharpen each title/description to stay under length limits with the primary keyword first.

## 6. Site-wide marketing plumbing

- Nav: condense to a "Product" set that includes the new pages without overflowing — nav shows QR check-in, Head count, Reports, For clubs, Greek life, Churches, plus a compare link; footer carries the full list in Product / Solutions / Company columns.
- Footer gains a Solutions column and the new pages.
- `/help`: add short how-to entries for pre-event check-in, semester report export, officer invites, and QR regeneration so support content also ranks.
- `sitemap.xml`: add the three new routes.
- Keep `robots.txt` as-is (already AI-crawler friendly).

## Technical notes

- All pages reuse `MarketingShell`, `Section`, `FaqBlock`, `buildPageMeta`, `faqSchema`, `breadcrumbSchema` and the existing `VerticalPage` component; `VerticalPage`'s `siblingLinks` union type is widened for the new routes.
- Each new route gets its own `head()` with unique title, description, og:title/description, og:type, canonical and og:url self-referencing `https://attendance-hq.com/<path>`, plus the shared OG image already in the project.
- New JSON-LD: `HowTo` on `/` and `/pre-event-headcount`, `BreadcrumbList` on every new page, existing FAQPage blocks preserved.
- No database, server function, or app (host/student) behavior changes — marketing routes and components only.

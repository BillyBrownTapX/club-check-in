# Attendance HQ — FERPA / DPA notes for campus IT

**Status:** Working notes for campus IT / student-organization office review.
**Not legal advice.** Campus counsel and your registrar have the final say on
what qualifies as an education record under FERPA at your institution and what
retention / disclosure rules apply. Use this doc as a starting point for a
formal review; don't treat it as a signed DPA.

---

## Purpose

Attendance HQ is a check-in tool for campus student organizations. Officers
create a club, schedule events, and collect attendance rosters. Students check
in at the event by scanning a QR code and entering their name, university
email, and student ID number.

## Data categories

- **Host accounts** — full name, email, password (hashed) for club owners /
  officers.
- **Student check-ins** — first name, last name, university email, student ID
  number (e.g. 900 number), event id, timestamp, and check-in method
  (`qr_scan`, `returning_lookup`, `remembered_device`, `host_correction`).
- **Device tokens** — random opaque tokens stored on a student's device so
  returning students can check in faster. Tokens expire on age + idle windows.
- **Club / event metadata** — club name, university id, event name, date,
  location, check-in window.
- **Host activity** — coarse-grained milestone rows (first check-in, threshold
  reached, check-in closed). No student PII.
- **Aggregate metrics** — for admin overview only (counts, no rosters).

## Roles (intended model)

- **Institution / hosting club:** controller of student attendance records
  under institutional policy. Hosts operate under the campus student-org
  office's direction as school officials with a legitimate educational
  interest.
- **Attendance HQ:** processor for the hosted service. Processes data on
  behalf of the club under normal operation of the product.
- **Attendance HQ campus staff (admin role):** limited internal access to
  aggregate metrics and abuse controls (disable a host, deactivate a club).
  Admins do **not** get access to student rosters through the admin console.

## Access controls in the product today

- **Row-Level Security (RLS)** on every table containing user or student
  data. Owner-scoped policies mean a host of Club A cannot read attendance
  rows for Club B, even via the Data API.
- **No public student UUIDs.** Public check-in surfaces expose only the QR
  token; student ids are never returned to unauthenticated clients.
- **Rate limiting** on check-in lookup / register / fast paths, keyed by QR
  token, to blunt scripted enumeration.
- **No password-reset user oracle.** Reset flows respond identically whether
  or not an account exists.
- **Admin role separation.** Admin abilities are backed by `user_roles` +
  `has_role()` security-definer function, not by client-side flags.
- **Disable trigger.** A `BEFORE UPDATE` trigger on `host_profiles` blocks
  non-admins from changing their own disabled status.

## Retention and deletion

- **Default retention:** 730 days (about two academic years) for attendance
  history. This is a product default; campus policy may impose shorter or
  longer requirements.
- **Host-driven export.** Every host can export a per-event CSV or a
  club-wide semester report CSV at any time. Hosts should export before any
  destructive action.
- **Host-driven purge.** Club **owners** can delete attendance history for
  events dated before a chosen cutoff via the club's *Data & privacy* panel.
  The purge:
  - Requires typing the exact club name to confirm.
  - Rejects any date newer than today − 730 days.
  - Deletes `attendance_actions`, `attendance_records`, and
    `host_activity` rows tied to eligible events.
  - Does **not** delete events, templates, clubs, students, or device
    sessions (students are university-scoped and may attend other clubs).
  - Logs counts only (no emails, no student names, no 900 numbers).
- **No nightly auto-wipe.** Retention purges are host-initiated. This is
  deliberate — silent auto-delete on production data without dry-run /
  admin kill switch is too risky.
- **Student-initiated deletion.** Students should contact the hosting club
  or campus student-org office; the club owner can purge or (case by case)
  export + hand-remove a specific record via the event roster.

## Subprocessors

- **Supabase** — managed Postgres database, auth, and storage (host club
  logos). Data resides in the Supabase project region.
- **Lovable Cloud / edge hosting (Cloudflare Workers runtime)** — SSR and
  server functions run on edge workers; there is no traditional Node server
  fleet under our control.

## Security posture (high level)

- TLS everywhere (managed by hosting).
- Server-side secrets (service role key, Sentry DSN) are stored in the
  Worker secret store and never exposed to browser code.
- Client-side monitoring (optional Sentry) scrubs emails, 900 numbers,
  bearer tokens, and query-string secrets before send.
- Health probes at `/api/health`, `/api/health/ready`,
  `/api/health/check-in` return JSON with no PII.

## Breach / incident posture

Incidents affecting the hosted service will be routed through the campus
student-organization office contact of record. Institutions should surface
this contact during onboarding so we know who to notify.

## Disclaimer

This document describes intended posture and enabled controls. It is not a
certification, not a signed DPA, and not legal advice. Campus counsel must
review before this doc is relied on for any FERPA compliance determination.

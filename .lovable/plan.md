## Goal

Turn the landing page + a small hub of SEO subpages into a discovery engine for "QR attendance", "club attendance tracker", "sorority/fraternity chapter attendance", "church attendance app", etc. — surfaced by Google, Bing/Safari, and AI answer engines (ChatGPT, Perplexity, Gemini, Google AI Overviews). Re-skin around the new Attendance-HQ logo (navy `#0B1F44` + electric blue `#2563EB`), keep Inter + Plus Jakarta Sans.

## Scope

**Audiences to target:** college clubs, Greek life, campus departments/Student Affairs, and general orgs (churches, nonprofits, gyms, K-12 clubs). Each gets a dedicated vertical page so search engines see a distinct entity per query cluster.

**Depth:** Landing + 4 SEO subpages + 1 comparison page (5 new pages total).

## New pages

```
/                              (revamped landing — hub)
/qr-code-attendance            (product vertical — the flagship keyword)
/club-attendance-tracker       (audience: college clubs & student orgs)
/greek-life-attendance         (audience: fraternities / sororities / chapters)
/church-attendance-app         (audience: churches, nonprofits, small orgs)
/vs-google-forms               (comparison — steals high-intent "alternative" traffic)
```

Each page ships with its own `head()` (unique title, description, og:title/description, canonical, og:url), a leaf-only `og:image`, and inline JSON-LD.

## SEO / GEO / AI-visibility layer (applies to every new page)

1. **Metadata**: unique 55-char titles + 150-char descriptions per page, keyword-front-loaded ("QR Code Attendance App for College Clubs — Attendance-HQ").
2. **Structured data (JSON-LD)** injected via `head().scripts`:
   - Root: `Organization` + `SoftwareApplication` (name, url, logo, applicationCategory, offers free, aggregateRating placeholder-safe omitted).
   - Landing: `WebSite` + `SearchAction`.
   - Vertical pages: `Product` / `Service` + `FAQPage` (5–8 Q&As each — the format AI answer engines quote verbatim).
   - Comparison: `FAQPage` + `BreadcrumbList`.
3. **AI-answer-engine optimization (GEO)**: each page has a 40-word "TL;DR" answer block near the top written in Q&A form, plus a plain-language "How it works in 3 steps" block. These are what ChatGPT/Perplexity/Gemini quote. Add clean H2/H3 hierarchy, definition sentences ("Attendance-HQ is a QR-code attendance app that…"), and use lists over paragraphs.
4. **Sitemap + robots**: extend `src/routes/sitemap[.]xml.ts` with all new routes (priorities: `/` 1.0, verticals 0.9, comparison 0.7). Confirm `public/robots.txt` allows all + points to sitemap.
5. **Internal linking**: landing links to all verticals; each vertical cross-links to 2 sibling verticals + comparison page. Anchor text uses target keywords.
6. **Semantic HTML**: single H1 per page, `<article>` for content sections, `<nav aria-label>` for footer, alt text on every image, `hreflang` skipped (English-only).
7. **Update root `__root.tsx`** brand meta (`theme-color` → new blue, `apple-mobile-web-app-title`, twitter site handle omitted if unknown, remove landing-specific title so leaves override cleanly).

## Design refresh (fonts kept, colors from new logo)

- Update `src/styles.css` tokens: primary `#2563EB` (electric blue) with primary-glow lighter, secondary/foreground `#0B1F44` (deep navy), accent stays warm gold for CTAs/success. New `hero-wash` = navy→electric-blue diagonal with subtle grid pattern.
- Swap `BrandMark` component to render the new logo (upload logo as Lovable asset from `user-uploads://Generated_image_1.png`).
- New favicon + og-image derived from the logo (blue navy backdrop, checkmark centered).
- Retain iOS card / rounded shell language on the app itself; the marketing pages get a **wider, editorial** feel (max-w 1200, multi-column at ≥md) so they read as a real website — not a phone shell.

## New landing page structure

```
Sticky header (logo · Product ▾ · For · Compare · Pricing · Sign in · Get started)
Hero
  H1: "QR code attendance, built for college clubs and student orgs"
  Sub: 1-line pitch + "Free forever for the first club"
  Dual CTA: Start free · See it in 60 seconds (anchor)
  Trust row: "Used by clubs at [university logos placeholder]" + FERPA-aware badge
"How it works" 3-step visual (Create event → Share QR → Watch roster fill)
"Built for every kind of org" — 4 vertical cards → /qr-code-attendance, /club-attendance-tracker, /greek-life-attendance, /church-attendance-app
Feature grid (8): QR check-in, roster CSV, semester report, offline resilience, live ops, templates, officers/roles, admin console
"Attendance-HQ vs Google Forms / paper sign-in" teaser → /vs-google-forms
FAQ (8 Q&As — powers FAQPage schema)
Final CTA band
Footer with sitemap-style link block (all verticals + legal)
```

## Vertical page template (reused)

- Hero with audience-specific H1 ("Fraternity & sorority chapter attendance, in seconds")
- TL;DR answer block (GEO)
- 3-step how-it-works
- 4-feature grid tuned to the audience (Greek: risk mgmt / national reporting; Church: recurring services; Clubs: SGA reporting; General: unlimited events)
- Use-case scenarios (3 short stories)
- Testimonial placeholder slot (safe empty state — no fake reviews)
- FAQ (6 Q&As, audience-specific → FAQPage schema)
- Cross-links to sibling verticals + CTA

## Comparison page (`/vs-google-forms`)

Side-by-side table (Attendance-HQ vs Google Forms vs Paper sign-in vs Excel), migration guide, FAQ. Also good for AI answer engines when users ask "best alternative to Google Forms for attendance."

## Technical notes

- All 5 new routes use `createFileRoute` with `head()` returning meta/links/scripts. Canonical + og:url self-reference the route on `https://attendance-hq.com`.
- `og:image` only on leaf routes (never `__root`). Generate one 1200×630 branded card per page via `generate_image` (premium tier for text legibility) — 6 images total.
- No new dependencies. No backend/schema changes. No auth/RLS changes.
- Reuse existing `Button`, `Chip`, `BrandMark`. Add lightweight `<MarketingShell>` component under `src/components/marketing/` (header, footer, container) so subpages stay consistent without touching the app shell used by hosts.

## Out of scope

- Blog / CMS scaffold (can add later if we want compounding SEO).
- Real testimonials or university logos (design leaves clean empty states; you can drop them in later).
- Multi-language / hreflang.
- Paid ads landing variants.
- Backend, DB, auth changes.

## Deliverables checklist

1. Upload logo → Lovable asset; new `BrandMark` renders it.
2. Refreshed color tokens in `src/styles.css`.
3. New `MarketingShell` + shared `FaqBlock`, `SeoJsonLd` helpers.
4. Rewritten `src/routes/index.tsx`.
5. 5 new route files: `qr-code-attendance.tsx`, `club-attendance-tracker.tsx`, `greek-life-attendance.tsx`, `church-attendance-app.tsx`, `vs-google-forms.tsx`.
6. Updated `sitemap[.]xml.ts` + verified `robots.txt`.
7. Updated root meta + new favicon + 6 og-images.
8. Root `__root.tsx` theme-color updated; landing-only tags moved to `/`.

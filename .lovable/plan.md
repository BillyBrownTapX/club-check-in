
Add a sign-in CTA to the home page and wire it to the existing `/sign-in` route using the project’s TanStack Router patterns.

1. Update `src/routes/index.tsx`
- Import `Link` from `@tanstack/react-router`.
- Import the shared `Button` from `@/components/ui/button`.
- Add a visible “Sign in” button on the landing page, ideally in the header next to the logo so it is easy to find.

2. Use the existing design system
- Render the button with the shared button component rather than a raw anchor/button.
- Use `asChild` so the router link gets button styling while preserving client-side navigation:
  - `Button asChild`
  - inner `Link to="/sign-in"`

3. Keep navigation type-safe
- Point the CTA to the already-existing `/sign-in` route.
- Do not use a raw `<a href>`; use TanStack `Link` so navigation stays inside the SPA and matches the rest of the app architecture.

4. Preserve landing-page layout quality
- Keep the header responsive and balanced on small screens.
- If needed, slightly adjust header spacing so the logo and button fit cleanly without wrapping awkwardly.

5. Verify after implementation
- Confirm the `/` page renders with the new button.
- Confirm clicking “Sign in” navigates to `/sign-in`.
- Confirm there are no TypeScript route-typing issues introduced by the new link.

6. Expected result
- The homepage gets a clear host-entry CTA.
- Users can move directly from the landing page to the sign-in screen without broken navigation or inconsistent styling.

Remove UNG-branded sign-in subtitle

## Goal
Replace the sign-in page subtitle that references a specific university brand (UNG) with generic, platform-neutral copy.

## What will change
- `src/routes/sign-in.tsx` line 60: remove the `description` prop value `"Return to your UNG-branded event workspace and keep mobile attendance moving without delay."` from `<PageHeadingBlock />`.
- Keep the `eyebrow` ("Welcome back") and `title` ("Sign in") unchanged.

## Technical details
- The `description` prop is optional on `PageHeadingBlock`, so the component will render without a subtitle.
- No other files reference this string.
- No navigation, auth logic, or SEO metadata is affected.

import type { ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttendanceLogo } from "@/components/attendance-hq/primitives";
import { AttendanceAuthProvider } from "@/components/attendance-hq/auth-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { PRODUCT_NAME } from "@/lib/attendance-hq";
import appCss from "../styles.css?url";

export interface AppRouterContext {
  queryClient: QueryClient;
}

function BrandedShellCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-card/95 p-8 shadow-[0_28px_72px_-36px_color-mix(in_oklab,var(--color-primary)_28%,transparent)] backdrop-blur">
      <div className="blur-orb-white -left-10 -top-10 h-28 w-28" />
      <div className="blur-orb-blue -bottom-8 -right-8 h-32 w-32" />
      <div className="relative">{children}</div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <BrandedShellCard>
          <div className="flex flex-col items-center text-center">
            <AttendanceLogo />
            <div className="mt-8 inline-flex rounded-full bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">404</div>
            <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-foreground">Page not found</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">The page you tried to open is unavailable. Head back to the main workspace and continue from there.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="lg"><Link to="/">Go home</Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/sign-in">Host sign in</Link></Button>
            </div>
          </div>
        </BrandedShellCard>
      </div>
    </div>
  );
}

function RootErrorComponent({ error }: { error: Error }) {
  if (typeof console !== "undefined") console.error("[root-error]", error);
  const isConfigError = /supabase environment variables/i.test(error?.message ?? "");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <BrandedShellCard>
          <div className="flex flex-col items-center text-center">
            <AttendanceLogo />
            <div className="mt-8 inline-flex rounded-full bg-destructive/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Attention</div>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-foreground">
              {isConfigError ? `${PRODUCT_NAME} isn’t configured` : "Something went wrong"}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {isConfigError
                ? "The app is missing required backend settings. Please check back shortly."
                : "An unexpected error interrupted the page. Refresh and try again."}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="hero" size="lg" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}>
                Reload
              </Button>
              <Button asChild variant="outline" size="lg"><Link to="/">Go home</Link></Button>
            </div>
          </div>
        </BrandedShellCard>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Attendance HQ — QR attendance for college clubs" },
      { name: "description", content: "Fast attendance tracking for college clubs with QR check-ins, live event views, and exportable records." },
      { property: "og:title", content: "Attendance HQ — QR attendance for college clubs" },
      { property: "og:description", content: "Replace paper sign-in sheets with QR check-ins, live attendance tracking, and exportable records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://attendance-hq.com" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="app-shell overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AttendanceAuthProvider>
        <div className="min-h-screen bg-app-shell text-app-shell-foreground antialiased">
          <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
          <main id="main-content" className="mx-auto min-h-screen w-full max-w-[100rem] px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-center" richColors closeButton />
      </AttendanceAuthProvider>
    </QueryClientProvider>
  );
}

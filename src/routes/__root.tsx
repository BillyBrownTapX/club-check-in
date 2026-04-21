import type { ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { AttendanceAuthProvider } from "@/components/attendance-hq/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { PRODUCT_NAME } from "@/lib/attendance-hq";

export interface AppRouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you’re looking for doesn’t exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Last-chance error wall for anything that escaped a route's own
// errorComponent — most importantly the supabase client throwing during
// boot when SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are missing. Without
// this, a misconfigured deploy renders a blank screen + console stack
// instead of an actionable message.
function RootErrorComponent({ error }: { error: Error }) {
  if (typeof console !== "undefined") {
    console.error("[root-error]", error);
  }
  // Detect the well-known "missing env" signal so we can show config-
  // specific copy. Anything else falls back to the generic "we hit a snag"
  // screen — we never echo the raw .message into the page.
  const isConfigError = /supabase environment variables/i.test(error?.message ?? "");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {isConfigError ? `${PRODUCT_NAME} isn’t configured` : "Something went wrong"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isConfigError
            ? "The site is missing required server settings. The team has been notified — please check back shortly."
            : "An unexpected error happened. Please refresh the page or try again in a moment."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Go home
          </Link>
        </div>
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
      <body>
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
        <div className="min-h-screen bg-background text-foreground antialiased">
          <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
          <main id="main-content">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-center" richColors closeButton />
      </AttendanceAuthProvider>
    </QueryClientProvider>
  );
}

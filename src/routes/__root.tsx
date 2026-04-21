import { useEffect, type ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttendanceAuthProvider } from "@/components/attendance-hq/auth-provider";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { BrandMark } from "@/components/attendance-hq/ios";
import appCss from "../styles.css?url";

export interface AppRouterContext {
  queryClient: QueryClient;
}

function FallbackShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-md overflow-hidden">
        <div className="blur-orb-blue -left-12 -top-10 h-32 w-32" />
        <div className="blur-orb-gold -bottom-10 -right-8 h-32 w-32" />
        <div className="ios-card relative rounded-[2rem] p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <FallbackShell>
      <div className="flex flex-col items-center text-center">
        <BrandMark size="md" />
        <span className="mt-7 inline-flex rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">404</span>
        <h1 className="mt-4 ios-screen-title">Page not found</h1>
        <p className="mt-2.5 max-w-sm text-[14px] leading-6 text-muted-foreground">The page you tried to open is unavailable. Head back to the main workspace.</p>
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Button asChild variant="hero" size="lg"><Link to="/">Go home</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/sign-in">Host sign in</Link></Button>
        </div>
      </div>
    </FallbackShell>
  );
}

function RootErrorComponent({ error }: { error: Error }) {
  if (typeof console !== "undefined") console.error("[root-error]", error?.message, error?.stack);

  return (
    <FallbackShell>
      <div className="flex flex-col items-center text-center">
        <BrandMark size="md" />
        <span className="mt-7 inline-flex rounded-full bg-destructive/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">Attention</span>
        <h1 className="mt-4 ios-screen-title">Something went wrong</h1>
        <p className="mt-2.5 max-w-sm text-[14px] leading-6 text-muted-foreground">
          An unexpected error interrupted the page. Refresh and try again.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Button type="button" variant="hero" size="lg" onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}>Reload</Button>
          <Button asChild variant="outline" size="lg"><Link to="/">Go home</Link></Button>
        </div>
      </div>
    </FallbackShell>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Attendance HQ — premium event check-in" },
      { name: "description", content: "Run live events, manage clubs, and capture attendance from a premium iPhone-native workspace." },
      { name: "theme-color", content: "#0F3FA0" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Attendance" },
      { name: "application-name", content: "Attendance HQ" },
      { property: "og:title", content: "Attendance HQ — premium event check-in" },
      { property: "og:description", content: "Run live events, manage clubs, and capture attendance from a premium iPhone-native workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Attendance HQ — premium event check-in" },
      { name: "twitter:description", content: "Run live events, manage clubs, and capture attendance from a premium iPhone-native workspace." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/939531dd-86f5-4198-8d93-569cf0bcab93" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/939531dd-86f5-4198-8d93-569cf0bcab93" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://attendance-hq.com" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/icons/icon-512.png" },
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
      <body className="overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      document.documentElement.classList.toggle("pwa-standalone", Boolean(standalone));
    };
    apply();
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", apply);
    return () => mq?.removeEventListener?.("change", apply);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AttendanceAuthProvider>
        <div className="min-h-screen text-foreground antialiased">
          <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
          <main id="main-content" className="min-h-screen">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-center" richColors closeButton />
      </AttendanceAuthProvider>
    </QueryClientProvider>
  );
}

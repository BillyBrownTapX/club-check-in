import { QueryClient } from "@tanstack/react-query";
import { Link, createRouter, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/attendance-hq/ios";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  if (typeof console !== "undefined") console.error("[route-error]", error?.message, error?.stack);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-md">
        <div className="blur-orb-blue -left-10 -top-10 h-28 w-28" />
        <div className="blur-orb-gold -bottom-8 -right-8 h-28 w-28" />
        <div className="ios-card relative rounded-[2rem] p-7 text-center">
          <BrandMark size="md" />
          <div className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="mt-4 ios-screen-title">Something went wrong</h1>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">An unexpected error interrupted the app.</p>
          {error?.message ? (
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-muted p-3 text-left font-mono text-[11px] text-destructive whitespace-pre-wrap break-words">{error.message}</pre>
          ) : null}
          <div className="mt-6 flex flex-col gap-2.5">
            <Button type="button" variant="hero" size="lg" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
            <Button asChild variant="outline" size="lg"><Link to="/">Go home</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
};

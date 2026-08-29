// Public "early head count" page.
//
// Separate from /check-in/$qrToken on purpose: it resolves a distinct
// pre_check_in_token, writes to pre_check_ins, and is explicit that this is
// NOT attendance. Hosts share this link in marketing (group chat, flyer QR,
// Instagram story) weeks ahead of the event.

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck2, Users } from "lucide-react";
import {
  CheckInFormCard,
  ErrorStateCard,
  MobileInputField,
  MobileNumericField,
  OfflineBanner,
  PrimaryButton,
  PublicCheckInShell,
  SecondaryTextButton,
} from "@/components/attendance-hq/public-check-in";
import { getPublicPreCheckInEvent, submitPreCheckIn, submitReturningPreCheckIn } from "@/lib/attendance-hq.functions";
import { DEVICE_TOKEN_KEY, PRE_CHECK_IN_COPY } from "@/lib/attendance-hq";
import { returningLookupSchema, studentRegistrationSchema } from "@/lib/attendance-hq-schemas";
import { isLikelyOfflineError, useOnlineStatus } from "@/hooks/use-online-status";

type Screen = "first-time" | "returning" | "success" | "blocked";

function formatEventDate(date: string, startTime: string) {
  const parsed = new Date(`${date}T${startTime}`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RouteErrorComponent({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PublicCheckInShell>
      <ErrorStateCard
        title="Unable to load early check-in"
        description="Something went wrong loading this event. Please try again."
        action={<PrimaryButton onClick={() => { router.invalidate(); reset(); }}>Try again</PrimaryButton>}
      />
    </PublicCheckInShell>
  );
}

export const Route = createFileRoute("/pre-check-in/$preToken")({
  head: () => ({
    meta: [
      { title: "Early Head Count — Attendance HQ" },
      { name: "description", content: "Let your club know you're planning to attend an upcoming event." },
      { property: "og:title", content: "Early Head Count — Attendance HQ" },
      { property: "og:description", content: "Tap once to tell the host you're coming to this upcoming event." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Early Head Count — Attendance HQ" },
      { name: "twitter:description", content: "Tap once to tell the host you're coming to this upcoming event." },
    ],
  }),
  errorComponent: RouteErrorComponent,
  notFoundComponent: () => (
    <PublicCheckInShell>
      <ErrorStateCard title="Invalid link" description="This early check-in link is invalid or no longer available." />
    </PublicCheckInShell>
  ),
  loader: async ({ params }) => {
    const result = await getPublicPreCheckInEvent({ data: { preToken: params.preToken } });
    return { result };
  },
  component: PreCheckInRoute,
});

function PreCheckInRoute() {
  const { preToken } = Route.useParams();
  const { result } = Route.useLoaderData();
  const isOnline = useOnlineStatus();

  const submit = useServerFn(submitPreCheckIn);
  const submitReturning = useServerFn(submitReturningPreCheckIn);

  const [screen, setScreen] = useState<Screen>(result.ok ? "first-time" : "blocked");
  const [blocked, setBlocked] = useState<string | null>(result.ok ? null : result.state);
  const [count, setCount] = useState(result.preCheckInCount ?? 0);
  const [formError, setFormError] = useState("");
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    setScreen(result.ok ? "first-time" : "blocked");
    setBlocked(result.ok ? null : result.state);
    setCount(result.preCheckInCount ?? 0);
  }, [result]);

  const registrationForm = useForm({
    resolver: zodResolver(studentRegistrationSchema),
    defaultValues: { firstName: "", lastName: "", studentEmail: "", nineHundredNumber: "", rememberDevice: true },
  });
  const returningForm = useForm({
    resolver: zodResolver(returningLookupSchema),
    defaultValues: { nineHundredNumber: "" },
  });

  const event = result.event ?? null;

  const handleFailure = (error: unknown) => {
    setNetworkError(isLikelyOfflineError(error));
    setFormError(
      isLikelyOfflineError(error)
        ? "We couldn't reach the server. Check your connection and try again."
        : (error as Error)?.message || "Something went wrong. Please try again.",
    );
  };

  const applyResult = (
    outcome: { ok: boolean; state?: string; deviceToken?: string | null },
  ) => {
    if (outcome.ok) {
      if (outcome.deviceToken && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DEVICE_TOKEN_KEY, outcome.deviceToken);
        } catch {
          /* private mode — ignore */
        }
      }
      setCount((prev) => prev + 1);
      setScreen("success");
      return;
    }
    if (outcome.state === "already_pre_checked_in") {
      setScreen("success");
      return;
    }
    if (outcome.state === "student_not_found") {
      setFormError("We couldn't find that 900 number. Use the first-time form below.");
      return;
    }
    setBlocked(outcome.state ?? "closed");
    setScreen("blocked");
  };

  if (screen === "blocked" || !event) {
    const copy = blocked === "not_open_yet"
      ? { title: PRE_CHECK_IN_COPY.notOpenTitle, description: PRE_CHECK_IN_COPY.notOpenBody }
      : blocked === "closed"
        ? { title: PRE_CHECK_IN_COPY.closedTitle, description: PRE_CHECK_IN_COPY.closedBody }
        : { title: "Invalid link", description: "This early check-in link is invalid or no longer available." };
    return (
      <PublicCheckInShell>
        <ErrorStateCard title={copy.title} description={copy.description} />
      </PublicCheckInShell>
    );
  }

  return (
    <PublicCheckInShell>
      {!isOnline ? <OfflineBanner /> : networkError ? <OfflineBanner variant="network-error" /> : null}

      <div className="ios-card rounded-3xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{event.club_name}</p>
        <h1 className="mt-1 text-xl font-bold leading-tight text-foreground">{event.event_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatEventDate(event.event_date, event.start_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-foreground">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-semibold">{count}</span>
          <span className="text-muted-foreground">planning to attend</span>
        </div>
      </div>

      {screen === "success" ? (
        <div className="ios-card mt-4 rounded-3xl p-6 text-center">
          <CalendarCheck2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-bold text-foreground">{PRE_CHECK_IN_COPY.successTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{PRE_CHECK_IN_COPY.successBody}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 px-1">
            <h2 className="text-base font-bold text-foreground">{PRE_CHECK_IN_COPY.heading}</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{PRE_CHECK_IN_COPY.subheading}</p>
          </div>

          {screen === "returning" ? (
            <CheckInFormCard>
              <form
                className="space-y-4"
                onSubmit={returningForm.handleSubmit(async (values) => {
                  setFormError("");
                  setNetworkError(false);
                  try {
                    const outcome = await submitReturning({ data: { preToken, nineHundredNumber: values.nineHundredNumber } });
                    applyResult(outcome as { ok: boolean; state?: string });
                  } catch (error) {
                    handleFailure(error);
                  }
                })}
              >
                <MobileNumericField
                  label="900 number"
                  placeholder="900123456"
                  error={returningForm.formState.errors.nineHundredNumber?.message}
                  {...returningForm.register("nineHundredNumber")}
                />
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                <PrimaryButton type="submit" className="w-full" disabled={returningForm.formState.isSubmitting}>
                  {returningForm.formState.isSubmitting ? "Saving…" : "I'm coming"}
                </PrimaryButton>
                <SecondaryTextButton type="button" className="w-full" onClick={() => { setFormError(""); setScreen("first-time"); }}>
                  First time here
                </SecondaryTextButton>
              </form>
            </CheckInFormCard>
          ) : (
            <CheckInFormCard>
              <form
                className="space-y-4"
                onSubmit={registrationForm.handleSubmit(async (values) => {
                  setFormError("");
                  setNetworkError(false);
                  try {
                    const outcome = await submit({ data: { ...values, preToken } });
                    applyResult(outcome as { ok: boolean; state?: string; deviceToken?: string | null });
                  } catch (error) {
                    handleFailure(error);
                  }
                })}
              >
                <MobileInputField label="First name" error={registrationForm.formState.errors.firstName?.message} {...registrationForm.register("firstName")} />
                <MobileInputField label="Last name" error={registrationForm.formState.errors.lastName?.message} {...registrationForm.register("lastName")} />
                <MobileInputField
                  label="University email"
                  type="email"
                  inputMode="email"
                  error={registrationForm.formState.errors.studentEmail?.message}
                  {...registrationForm.register("studentEmail")}
                />
                <MobileNumericField
                  label="900 number"
                  placeholder="900123456"
                  error={registrationForm.formState.errors.nineHundredNumber?.message}
                  {...registrationForm.register("nineHundredNumber")}
                />
                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                <PrimaryButton type="submit" className="w-full" disabled={registrationForm.formState.isSubmitting}>
                  {registrationForm.formState.isSubmitting ? "Saving…" : "I'm coming"}
                </PrimaryButton>
                <SecondaryTextButton type="button" className="w-full" onClick={() => { setFormError(""); setScreen("returning"); }}>
                  I've checked in before
                </SecondaryTextButton>
              </form>
            </CheckInFormCard>
          )}
        </>
      )}
    </PublicCheckInShell>
  );
}

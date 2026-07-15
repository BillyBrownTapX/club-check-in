import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  CheckInFormCard,
  ErrorStateCard,
  EventContextRow,
  EventInfoCard,
  IdentityConfirmationCard,
  MobileInputField,
  MobileNumericField,
  OfflineBanner,
  PrimaryButton,
  PublicCheckInShell,
  SecondaryTextButton,
  SuccessStateCard,
} from "@/components/attendance-hq/public-check-in";
import { getPublicEventByQr, getRememberedStudent, studentCheckIn, lookupStudent, confirmReturningStudent, fastCheckIn } from "@/lib/attendance-hq.functions";
import {
  DEVICE_TOKEN_KEY,
  getBlockedStateCopy,
  getCheckInStatus,
  getPublicBlockedState,
  type PublicBlockedState,
  type PublicStudentPreview,
} from "@/lib/attendance-hq";
import { returningLookupSchema, studentRegistrationSchema } from "@/lib/attendance-hq-schemas";
import { isLikelyOfflineError, useOnlineStatus } from "@/hooks/use-online-status";

// sessionStorage key for the first-time registration draft. Scoped per-QR
// so re-scanning a different event doesn't restore stale values. We
// intentionally use sessionStorage (not localStorage) so drafts don't
// outlive the browser tab — no long-term PII persistence.
const REGISTRATION_DRAFT_KEY = (qrToken: string) => `ahq:checkin-draft:${qrToken}`;
const RETURNING_DRAFT_KEY = (qrToken: string) => `ahq:checkin-return-draft:${qrToken}`;

type RegistrationDraft = {
  firstName: string;
  lastName: string;
  studentEmail: string;
  nineHundredNumber: string;
};

function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}


type FlowScreen = "first-time" | "returning" | "confirm" | "success" | "blocked";
type ConfirmMode = "returning" | "remembered";

function RouteErrorComponent({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  // Never surface raw error.message to the public flow. Server stack
  // traces, Supabase row references, or transport errors must not be
  // shown on a page anyone with the QR link can hit.
  return (
    <PublicCheckInShell>
      <ErrorStateCard
        title="Unable to load check-in"
        description="Something went wrong loading this event. Please try again."
        action={<PrimaryButton onClick={() => { router.invalidate(); reset(); }}>Try again</PrimaryButton>}
      />
    </PublicCheckInShell>
  );
}

function RouteNotFoundComponent() {
  const copy = getBlockedStateCopy("invalid_link");
  return (
    <PublicCheckInShell>
      <ErrorStateCard title={copy.title} description={copy.description} />
    </PublicCheckInShell>
  );
}

export const Route = createFileRoute("/check-in/$qrToken")({
  head: () => ({
    meta: [
      { title: "Event Check-In — Attendance HQ" },
      { name: "description", content: "Mobile check-in for college club events with Attendance HQ." },
      { property: "og:title", content: "Event Check-In — Attendance HQ" },
      { property: "og:description", content: "Fast mobile check-in for college club events." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Event Check-In — Attendance HQ" },
      { name: "twitter:description", content: "Fast mobile check-in for college club events." },
    ],
  }),
  loader: async ({ params }) => {
    const event = await getPublicEventByQr({ data: { qrToken: params.qrToken } });
    if (!event) throw notFound();
    return { event };
  },
  errorComponent: RouteErrorComponent,
  notFoundComponent: RouteNotFoundComponent,
  component: CheckInRouteComponent,
});

function CheckInRouteComponent() {
  const { event } = Route.useLoaderData();
  const { qrToken } = Route.useParams();
  const status = getCheckInStatus(event);
  const initialBlockedState = getPublicBlockedState(status);
  const submitStudentCheckIn = useServerFn(studentCheckIn);
  const lookupReturningStudent = useServerFn(lookupStudent);
  const confirmReturning = useServerFn(confirmReturningStudent);
  const confirmRemembered = useServerFn(fastCheckIn);
  const resolveRememberedStudent = useServerFn(getRememberedStudent);

  const [screen, setScreen] = useState<FlowScreen>(initialBlockedState ? "blocked" : "first-time");
  const [blockedState, setBlockedState] = useState<PublicBlockedState | null>(initialBlockedState);
  const [pendingStudent, setPendingStudent] = useState<PublicStudentPreview | null>(null);
  // Pre-fix this state held a raw student UUID returned by the server. We now
  // hold the 900 number the user just typed in, so confirm re-proves identity
  // server-side instead of trusting a client-supplied id.
  const [pendingNineHundredNumber, setPendingNineHundredNumber] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("returning");
  const [rememberedDeviceToken, setRememberedDeviceToken] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<string | null>(null);
  const [rememberedStudent, setRememberedStudent] = useState<PublicStudentPreview | null>(null);
  const [rememberedLoading, setRememberedLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // Distinguish "no network path" from "server said no". The offline banner
  // is driven off `useOnlineStatus()` OR a sticky flag set when the last
  // submit threw a transport-shaped error, so we can prompt the student to
  // retry after switching to cellular without the toast lying about state.
  const [lastFailureWasNetwork, setLastFailureWasNetwork] = useState(false);
  const online = useOnlineStatus();
  const wasOfflineRef = useRef(false);

  const registrationForm = useForm({
    resolver: zodResolver(studentRegistrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      studentEmail: "",
      nineHundredNumber: "",
      rememberDevice: true,
    },
  });

  const returningForm = useForm({
    resolver: zodResolver(returningLookupSchema),
    defaultValues: { nineHundredNumber: "" },
  });

  // Restore any draft the student left in this browser tab for this QR.
  // Runs once on mount — we don't want later form.reset() calls to fight
  // with what the student is currently typing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reg = readDraft<RegistrationDraft>(REGISTRATION_DRAFT_KEY(qrToken));
    if (reg) {
      registrationForm.reset({
        firstName: reg.firstName ?? "",
        lastName: reg.lastName ?? "",
        studentEmail: reg.studentEmail ?? "",
        nineHundredNumber: reg.nineHundredNumber ?? "",
        rememberDevice: true,
      });
    }
    const ret = readDraft<{ nineHundredNumber: string }>(RETURNING_DRAFT_KEY(qrToken));
    if (ret?.nineHundredNumber) {
      returningForm.reset({ nineHundredNumber: ret.nineHundredNumber });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  // Persist first-time draft on every change so a mid-flow reload / tab
  // switch doesn't lose what the student typed. We deliberately exclude
  // `rememberDevice` (UI toggle, not identity) and never touch localStorage.
  useEffect(() => {
    const sub = registrationForm.watch((values) => {
      writeDraft(REGISTRATION_DRAFT_KEY(qrToken), {
        firstName: values.firstName ?? "",
        lastName: values.lastName ?? "",
        studentEmail: values.studentEmail ?? "",
        nineHundredNumber: values.nineHundredNumber ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [registrationForm, qrToken]);

  useEffect(() => {
    const sub = returningForm.watch((values) => {
      writeDraft(RETURNING_DRAFT_KEY(qrToken), {
        nineHundredNumber: values.nineHundredNumber ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [returningForm, qrToken]);

  // Soft "back online" nudge — non-blocking, no auto-submit.
  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setLastFailureWasNetwork(false);
      toast.success("Back online — you can check in now.");
    }
  }, [online]);

  useEffect(() => {
    if (initialBlockedState || typeof window === "undefined") return;
    const storedDeviceToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!storedDeviceToken) return;

    setRememberedLoading(true);
    resolveRememberedStudent({ data: { qrToken, deviceToken: storedDeviceToken } })
      .then((result) => {
        if (!result.ok) {
          if (result.state === "already_checked_in") {
            openBlockedState(result.state);
            return;
          }
          // student_not_found here means the session row is gone (server
          // deleted it because it was expired/idle, or it never existed).
          // Clear the stale token so we don't keep offering the fast path,
          // and let the user proceed as first-time / returning.
          if (result.state === "student_not_found" && typeof window !== "undefined") {
            window.localStorage.removeItem(DEVICE_TOKEN_KEY);
          }
          return;
        }
        setRememberedDeviceToken(storedDeviceToken);
        setRememberedStudent(result.student);
      })
      .catch(() => undefined)
      .finally(() => setRememberedLoading(false));
  }, [qrToken, initialBlockedState, resolveRememberedStudent]);

  const blockedCopy = useMemo(() => (blockedState ? getBlockedStateCopy(blockedState) : null), [blockedState]);
  const blockedDescription = useMemo(() => {
    if (!blockedCopy) return null;
    if (blockedState === "not_open_yet") {
      return "Check-in has not opened for this event yet. Please wait for the host to open student check-in and then scan the QR code again.";
    }
    if (blockedState === "closed") {
      return "This event is not accepting student check-ins right now. If you expected it to be open, please check with the event host.";
    }
    return blockedCopy.description;
  }, [blockedCopy, blockedState]);

  const openBlockedState = (state: PublicBlockedState) => {
    setBlockedState(state);
    setScreen("blocked");
  };

  const clearStoredDeviceToken = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    }
    setRememberedDeviceToken(null);
    setRememberedStudent(null);
  };

  const clearTransientState = () => {
    setGlobalError(null);
    setPendingStudent(null);
    setPendingNineHundredNumber(null);
  };

  // Single sanitized message for any thrown server-fn error in the public
  // flow. Students must NEVER see backend strings — Supabase errors,
  // network failures, and unexpected 5xx all collapse into the same
  // mobile-friendly retry copy. Any logical "blocked" state (closed event,
  // already checked in, etc.) is returned as `{ ok: false, state }` and
  // handled separately, so this path only fires on transport / panic.
  const PUBLIC_TRANSIENT_ERROR = "Something went wrong. Please try again.";
  const PUBLIC_RATE_LIMIT_ERROR = "Too many attempts. Please wait a moment and try again.";
  const PUBLIC_OFFLINE_ERROR = "You appear to be offline. Turn on cellular or reconnect to Wi-Fi, then tap Try again.";
  const PUBLIC_NETWORK_ERROR = "Couldn't reach the server. Check your connection and tap Try again — your info is saved.";

  // Rate-limit errors are thrown by the server (RateLimitedError) and
  // arrive here through TanStack Start's RPC serialization, which may
  // preserve `code`, flatten to a plain object, or leave only `message`.
  // Match any of those shapes; fall back to the generic transient copy
  // for everything else so backend detail never leaks.
  function getPublicCheckInErrorMessage(err: unknown): string {
    if (err && typeof err === "object") {
      const e = err as { code?: unknown; message?: unknown };
      if (e.code === "rate_limited") return PUBLIC_RATE_LIMIT_ERROR;
      if (typeof e.message === "string" && e.message.includes("Too many attempts")) {
        return PUBLIC_RATE_LIMIT_ERROR;
      }
      if (e.code === "invalid_email_domain") return e.message as string;
      if (
        typeof e.message === "string" &&
        (e.message.startsWith("Use your university email") ||
          e.message.includes("university email"))
      ) {
        return e.message;
      }
    }
    if (isLikelyOfflineError(err)) {
      return typeof navigator !== "undefined" && navigator.onLine === false
        ? PUBLIC_OFFLINE_ERROR
        : PUBLIC_NETWORK_ERROR;
    }
    return PUBLIC_TRANSIENT_ERROR;
  }

  // Centralize submit-error handling so every flow (first-time, returning,
  // confirm) sets the sticky "was network" flag consistently — this drives
  // the offline banner even after the student comes back online but hasn't
  // retried yet.
  function handleSubmitError(err: unknown) {
    const networkish = isLikelyOfflineError(err);
    setLastFailureWasNetwork(networkish);
    setGlobalError(getPublicCheckInErrorMessage(err));
  }

  const handleFirstTimeSubmit = registrationForm.handleSubmit(async (values) => {
    setGlobalError(null);
    setLastFailureWasNetwork(false);
    try {
      const result = await submitStudentCheckIn({ data: { ...values, qrToken } });
      if (!result.ok) {
        if (result.state === "student_exists") {
          setPendingStudent(result.student);
          // Carry forward the 900 number the user just submitted so confirm
          // can re-prove identity server-side.
          setPendingNineHundredNumber(values.nineHundredNumber);
          setConfirmMode("returning");
          setScreen("confirm");
          return;
        }
        openBlockedState(result.state);
        return;
      }

      if (typeof window !== "undefined" && result.deviceToken) {
        window.localStorage.setItem(DEVICE_TOKEN_KEY, result.deviceToken);
      }
      // Successful commit — clear any saved draft for this QR.
      clearDraft(REGISTRATION_DRAFT_KEY(qrToken));
      clearDraft(RETURNING_DRAFT_KEY(qrToken));
      setSuccessAt(result.attendance.checked_in_at);
      setScreen("success");
    } catch (err) {
      handleSubmitError(err);
    }
  });

  const handleReturningSubmit = returningForm.handleSubmit(async (values) => {
    setGlobalError(null);
    setLastFailureWasNetwork(false);
    try {
      const result = await lookupReturningStudent({ data: { ...values, qrToken } });
      if (!result.ok) {
        openBlockedState(result.state);
        return;
      }

      setPendingStudent(result.student);
      setPendingNineHundredNumber(values.nineHundredNumber);
      setConfirmMode("returning");
      setScreen("confirm");
    } catch (err) {
      handleSubmitError(err);
    }
  });

  async function handleConfirmCheckIn() {
    if (!pendingStudent) return;
    setGlobalError(null);
    setLastFailureWasNetwork(false);

    try {
      if (confirmMode === "remembered") {
        if (!rememberedDeviceToken) return;
        const result = await confirmRemembered({ data: { qrToken, deviceToken: rememberedDeviceToken } });
        if (!result.ok) {
          if (result.state === "student_not_found") {
            // Session expired or vanished between the welcome-back peek
            // and confirm. Drop the stale token and send the student
            // back to first-time / returning instead of stranding them.
            clearStoredDeviceToken();
            clearTransientState();
            setScreen("first-time");
            return;
          }
          openBlockedState(result.state);
          return;
        }
        setSuccessAt(result.attendance.checked_in_at);
        clearDraft(REGISTRATION_DRAFT_KEY(qrToken));
        clearDraft(RETURNING_DRAFT_KEY(qrToken));
        setScreen("success");
        return;
      }

      if (!pendingNineHundredNumber) return;
      const result = await confirmReturning({
        data: { qrToken, nineHundredNumber: pendingNineHundredNumber },
      });
      if (!result.ok) {
        openBlockedState(result.state);
        return;
      }
      setSuccessAt(result.attendance.checked_in_at);
      clearDraft(REGISTRATION_DRAFT_KEY(qrToken));
      clearDraft(RETURNING_DRAFT_KEY(qrToken));
      setScreen("success");
    } catch (err) {
      handleSubmitError(err);
    }
  }

  const showOfflineBanner = !online || lastFailureWasNetwork;
  const offlineBannerVariant: "offline" | "network-error" = !online ? "offline" : "network-error";
  const submitDisabledByNetwork = !online;
  const primaryCtaLabel = !online ? "You're offline" : "Save and Check In";
  const returningCtaLabel = !online ? "You're offline" : "Continue";
  const confirmCtaLabel = !online ? "You're offline" : "Check In";

  function renderFirstTimeScreen() {
    const errors = registrationForm.formState.errors;
    return (
      <>
        <EventInfoCard event={event} status={status} />
        <EventContextRow event={event} />
        {showOfflineBanner ? <OfflineBanner variant={offlineBannerVariant} /> : null}
        <section className="space-y-2 px-1">
          <h1 className="text-[2.25rem] font-semibold leading-tight text-foreground">Student check-in</h1>
          <p className="text-sm leading-6 text-muted-foreground">Enter your first name, last name, student email, and 9-digit 900 number to record your attendance.</p>
        </section>
        {rememberedStudent && rememberedDeviceToken ? (
          <CheckInFormCard>
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-[1.6rem] border border-border/80 bg-secondary p-4 text-left">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/12 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">Welcome back, {rememberedStudent.firstName} {rememberedStudent.lastInitial}.</p>
                  <p className="text-sm text-muted-foreground">Use the fast path on this device or complete the form below.</p>
                </div>
              </div>
              <PrimaryButton
                type="button"
                onClick={() => {
                  setPendingStudent(rememberedStudent);
                  setPendingNineHundredNumber(null);
                  setConfirmMode("remembered");
                  setScreen("confirm");
                }}
              >
                {rememberedLoading ? "Checking this device..." : `Check in as ${rememberedStudent.firstName}`}
              </PrimaryButton>
            </div>
          </CheckInFormCard>
        ) : rememberedLoading ? (
          <p className="px-1 text-sm text-muted-foreground">Checking this device...</p>
        ) : null}
        <CheckInFormCard>
          <form className="space-y-4" onSubmit={(event) => void handleFirstTimeSubmit(event)}>
            <MobileInputField label="First name" placeholder="First name" error={errors.firstName?.message} {...registrationForm.register("firstName")} />
            <MobileInputField label="Last name" placeholder="Last name" error={errors.lastName?.message} {...registrationForm.register("lastName")} />
            <MobileInputField label="Student email" type="email" autoComplete="email" placeholder="name@college.edu" error={errors.studentEmail?.message} {...registrationForm.register("studentEmail")} />
            <MobileNumericField label="900 number" placeholder="900123456" maxLength={9} error={errors.nineHundredNumber?.message} {...registrationForm.register("nineHundredNumber")} />
            {globalError ? <p className="text-sm font-medium text-destructive">{globalError}</p> : null}
            <PrimaryButton type="submit" disabled={registrationForm.formState.isSubmitting || submitDisabledByNetwork}>{primaryCtaLabel}</PrimaryButton>
          </form>
        </CheckInFormCard>
        <SecondaryTextButton type="button" onClick={() => { clearTransientState(); setScreen("returning"); }}>Already used Attendance HQ before?</SecondaryTextButton>
      </>
    );
  }

  function renderReturningScreen() {
    const errors = returningForm.formState.errors;
    return (
      <>
        <EventContextRow event={event} />
        <section className="space-y-2 px-1">
          <h1 className="text-[2.25rem] font-semibold leading-tight text-foreground">Returning check-in</h1>
          <p className="text-sm leading-6 text-muted-foreground">Enter your 900 number to continue.</p>
        </section>
        <CheckInFormCard>
          <form className="space-y-4" onSubmit={(event) => void handleReturningSubmit(event)}>
            <MobileNumericField label="900 number" placeholder="900123456" maxLength={9} error={errors.nineHundredNumber?.message} {...returningForm.register("nineHundredNumber")} />
            {globalError ? <p className="text-sm font-medium text-destructive">{globalError}</p> : null}
            <PrimaryButton type="submit" disabled={returningForm.formState.isSubmitting}>Continue</PrimaryButton>
          </form>
        </CheckInFormCard>
        <SecondaryTextButton type="button" onClick={() => setScreen("first-time")}>First time using Attendance HQ?</SecondaryTextButton>
      </>
    );
  }

  function renderConfirmScreen() {
    if (!pendingStudent) return null;
    return (
      <>
        <section className="space-y-2 px-1 pt-2">
          <h1 className="text-[2.1rem] font-semibold leading-tight text-foreground">Is this you?</h1>
        </section>
        <IdentityConfirmationCard student={pendingStudent} />
        {globalError ? <p className="px-1 text-sm font-medium text-destructive">{globalError}</p> : null}
        <div className="space-y-3">
          <PrimaryButton type="button" onClick={() => void handleConfirmCheckIn()}>Check In</PrimaryButton>
          <SecondaryTextButton type="button" onClick={() => { clearTransientState(); setScreen(confirmMode === "remembered" ? "first-time" : "returning"); }}>This is not me</SecondaryTextButton>
        </div>
      </>
    );
  }

  function renderSuccessScreen() {
    if (!successAt) return null;
    return (
      <>
        <SuccessStateCard event={event} checkedInAt={successAt} />
        <PrimaryButton type="button" onClick={() => { clearTransientState(); setBlockedState(null); setScreen("first-time"); }}>Done</PrimaryButton>
      </>
    );
  }

  function renderBlockedScreen() {
    if (!blockedCopy) return null;
    return (
      <>
        <EventInfoCard event={event} status={status} />
        <ErrorStateCard
          title={blockedCopy.title}
          description={blockedDescription ?? blockedCopy.description}
          action={<PrimaryButton type="button" onClick={() => { setBlockedState(initialBlockedState); setScreen(initialBlockedState ? "blocked" : "first-time"); }}>Return to check-in</PrimaryButton>}
        />
        {!initialBlockedState && (blockedState === "student_not_found" || blockedState === "invalid_900_number") ? (
          <SecondaryTextButton type="button" onClick={() => setScreen(blockedState === "student_not_found" ? "first-time" : "returning")}>{blockedState === "student_not_found" ? "Register as first-time user" : "Try again"}</SecondaryTextButton>
        ) : null}
      </>
    );
  }

  return (
    <PublicCheckInShell>
      {screen === "first-time" ? renderFirstTimeScreen() : null}
      {screen === "returning" ? renderReturningScreen() : null}
      {screen === "confirm" ? renderConfirmScreen() : null}
      {screen === "success" ? renderSuccessScreen() : null}
      {screen === "blocked" ? renderBlockedScreen() : null}
    </PublicCheckInShell>
  );
}
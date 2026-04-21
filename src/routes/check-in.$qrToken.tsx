import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, IdCard, UserPlus } from "lucide-react";
import {
  ActionChoiceCard,
  CheckInFormCard,
  ErrorStateCard,
  EventContextRow,
  EventInfoCard,
  IdentityConfirmationCard,
  MobileInputField,
  MobileNumericField,
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

type FlowScreen = "entry" | "first-time" | "returning" | "confirm" | "success" | "blocked";
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

  const [screen, setScreen] = useState<FlowScreen>(initialBlockedState ? "blocked" : "entry");
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

  useEffect(() => {
    if (initialBlockedState || typeof window === "undefined") return;
    const storedDeviceToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!storedDeviceToken) return;

    setRememberedLoading(true);
    resolveRememberedStudent({ data: { qrToken, deviceToken: storedDeviceToken } })
      .then((result) => {
        if (!result.ok) {
          // The remembered device peek already proved this student exists
          // for this event. The most common non-ok state is
          // already_checked_in — pre-fix we silently dropped that and the
          // student was offered the entry buttons again, then bounced
          // when they tried to check in. Surface it directly so they know
          // they are already in.
          if (result.state === "already_checked_in") {
            openBlockedState(result.state);
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

  const openBlockedState = (state: PublicBlockedState) => {
    setBlockedState(state);
    setScreen("blocked");
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

  const handleFirstTimeSubmit = registrationForm.handleSubmit(async (values) => {
    setGlobalError(null);
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
      setSuccessAt(result.attendance.checked_in_at);
      setScreen("success");
    } catch {
      setGlobalError(PUBLIC_TRANSIENT_ERROR);
    }
  });

  const handleReturningSubmit = returningForm.handleSubmit(async (values) => {
    setGlobalError(null);
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
    } catch {
      setGlobalError(PUBLIC_TRANSIENT_ERROR);
    }
  });

  async function handleConfirmCheckIn() {
    if (!pendingStudent) return;
    setGlobalError(null);

    try {
      if (confirmMode === "remembered") {
        if (!rememberedDeviceToken) return;
        const result = await confirmRemembered({ data: { qrToken, deviceToken: rememberedDeviceToken } });
        if (!result.ok) {
          openBlockedState(result.state);
          return;
        }
        setSuccessAt(result.attendance.checked_in_at);
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
      setScreen("success");
    } catch {
      setGlobalError(PUBLIC_TRANSIENT_ERROR);
    }
  }

  function renderEntryScreen() {
    return (
      <>
        <EventInfoCard event={event} status={status} />
        <section className="space-y-3 px-1 pt-2">
          <h1 className="text-[2rem] font-semibold leading-tight text-foreground">Check in for this event</h1>
          <p className="text-sm text-muted-foreground">Choose how you’d like to continue</p>
        </section>
        <div className="space-y-3">
          {rememberedStudent && rememberedDeviceToken ? (
            <ActionChoiceCard
              title={`Check in as ${rememberedStudent.firstName} ${rememberedStudent.lastInitial}.`}
              description="Fast path on this device"
              icon={<CheckCircle2 className="h-5 w-5" />}
              onClick={() => {
                setPendingStudent(rememberedStudent);
                setPendingNineHundredNumber(null);
                setConfirmMode("remembered");
                setScreen("confirm");
              }}
            />
          ) : null}
          <ActionChoiceCard
            title="First time using Attendance HQ"
            description="Save your info and check in"
            icon={<UserPlus className="h-5 w-5" />}
            onClick={() => {
              clearTransientState();
              setScreen("first-time");
            }}
          />
          <ActionChoiceCard
            title="I’ve checked in before"
            description="Use your 900 number to continue"
            icon={<IdCard className="h-5 w-5" />}
            onClick={() => {
              clearTransientState();
              setScreen("returning");
            }}
          />
        </div>
        <p className="px-1 text-sm text-muted-foreground">{rememberedLoading ? "Checking this device…" : "One quick confirmation tap is always required before check-in."}</p>
      </>
    );
  }

  function renderFirstTimeScreen() {
    const errors = registrationForm.formState.errors;
    return (
      <>
        <EventContextRow event={event} />
        <section className="space-y-2 px-1">
          <h1 className="text-[2rem] font-semibold leading-tight text-foreground">First-time check-in</h1>
          <p className="text-sm text-muted-foreground">Enter your information to save your profile and record your attendance.</p>
        </section>
        <CheckInFormCard>
          <form className="space-y-4" onSubmit={(event) => void handleFirstTimeSubmit(event)}>
            <MobileInputField label="First name" placeholder="First name" error={errors.firstName?.message} {...registrationForm.register("firstName")} />
            <MobileInputField label="Last name" placeholder="Last name" error={errors.lastName?.message} {...registrationForm.register("lastName")} />
            <MobileInputField label="Student email" type="email" autoComplete="email" placeholder="name@college.edu" error={errors.studentEmail?.message} {...registrationForm.register("studentEmail")} />
            <MobileNumericField label="900 number" placeholder="900123456" maxLength={9} error={errors.nineHundredNumber?.message} {...registrationForm.register("nineHundredNumber")} />
            {globalError ? <p className="text-sm font-medium text-destructive">{globalError}</p> : null}
            <PrimaryButton type="submit" disabled={registrationForm.formState.isSubmitting}>Save and Check In</PrimaryButton>
          </form>
        </CheckInFormCard>
        <SecondaryTextButton type="button" onClick={() => setScreen("returning")}>Already used Attendance HQ before?</SecondaryTextButton>
      </>
    );
  }

  function renderReturningScreen() {
    const errors = returningForm.formState.errors;
    return (
      <>
        <EventContextRow event={event} />
        <section className="space-y-2 px-1">
          <h1 className="text-[2rem] font-semibold leading-tight text-foreground">Returning check-in</h1>
          <p className="text-sm text-muted-foreground">Enter your 900 number to continue</p>
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
          <h1 className="text-[2rem] font-semibold leading-tight text-foreground">Is this you?</h1>
        </section>
        <IdentityConfirmationCard student={pendingStudent} />
        {globalError ? <p className="px-1 text-sm font-medium text-destructive">{globalError}</p> : null}
        <div className="space-y-3">
          <PrimaryButton type="button" onClick={() => void handleConfirmCheckIn()}>Check In</PrimaryButton>
          <SecondaryTextButton type="button" onClick={() => { clearTransientState(); setScreen(confirmMode === "remembered" ? "entry" : "returning"); }}>This is not me</SecondaryTextButton>
        </div>
      </>
    );
  }

  function renderSuccessScreen() {
    if (!successAt) return null;
    return (
      <>
        <SuccessStateCard event={event} checkedInAt={successAt} />
        <PrimaryButton type="button" onClick={() => { clearTransientState(); setBlockedState(null); setScreen("entry"); }}>Done</PrimaryButton>
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
          description={blockedCopy.description}
          action={<PrimaryButton type="button" onClick={() => { setBlockedState(initialBlockedState); setScreen(initialBlockedState ? "blocked" : "entry"); }}>Return to event screen</PrimaryButton>}
        />
        {!initialBlockedState && (blockedState === "student_not_found" || blockedState === "invalid_900_number") ? (
          <SecondaryTextButton type="button" onClick={() => setScreen(blockedState === "student_not_found" ? "first-time" : "returning")}>{blockedState === "student_not_found" ? "Register as first-time user" : "Try again"}</SecondaryTextButton>
        ) : null}
      </>
    );
  }

  return (
    <PublicCheckInShell>
      {screen === "entry" ? renderEntryScreen() : null}
      {screen === "first-time" ? renderFirstTimeScreen() : null}
      {screen === "returning" ? renderReturningScreen() : null}
      {screen === "confirm" ? renderConfirmScreen() : null}
      {screen === "success" ? renderSuccessScreen() : null}
      {screen === "blocked" ? renderBlockedScreen() : null}
    </PublicCheckInShell>
  );
}
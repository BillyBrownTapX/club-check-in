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

function RouteErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PublicCheckInShell>
      <ErrorStateCard
        title="Unable to load check-in"
        description={error.message || "Please try again."}
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
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("returning");
  const [rememberedDeviceToken, setRememberedDeviceToken] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<string | null>(null);
  const [rememberedStudent, setRememberedStudent] = useState<PublicStudentPreview | null>(null);
  const [rememberedStudentId, setRememberedStudentId] = useState<string | null>(null);
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
    resolveRememberedStudent({ data: { eventId: event.id, deviceToken: storedDeviceToken } })
      .then((result) => {
        if (!result.ok) return;
        setRememberedDeviceToken(storedDeviceToken);
        setRememberedStudent(result.student);
        setRememberedStudentId(result.studentId);
      })
      .catch(() => undefined)
      .finally(() => setRememberedLoading(false));
  }, [event.id, initialBlockedState, resolveRememberedStudent]);

  const blockedCopy = useMemo(() => (blockedState ? getBlockedStateCopy(blockedState) : null), [blockedState]);

  const openBlockedState = (state: PublicBlockedState) => {
    setBlockedState(state);
    setScreen("blocked");
  };

  const clearTransientState = () => {
    setGlobalError(null);
    setPendingStudent(null);
    setPendingStudentId(null);
  };

  const handleFirstTimeSubmit = registrationForm.handleSubmit(async (values) => {
    setGlobalError(null);
    const result = await submitStudentCheckIn({ data: { ...values, eventId: event.id } });
    if (!result.ok) {
      if (result.state === "student_exists") {
        setPendingStudent(result.student);
        setPendingStudentId(result.student.id);
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
  });

  const handleReturningSubmit = returningForm.handleSubmit(async (values) => {
    setGlobalError(null);
    const result = await lookupReturningStudent({ data: { ...values, eventId: event.id } });
    if (!result.ok) {
      openBlockedState(result.state);
      return;
    }

    setPendingStudent(result.student);
    setPendingStudentId(result.student.id);
    setConfirmMode("returning");
    setScreen("confirm");
  });

  async function handleConfirmCheckIn() {
    if (!pendingStudent || !pendingStudentId) return;
    setGlobalError(null);
    const result = confirmMode === "remembered" && rememberedDeviceToken
      ? await confirmRemembered({ data: { eventId: event.id, studentId: pendingStudentId, deviceToken: rememberedDeviceToken } })
      : await confirmReturning({ data: { eventId: event.id, studentId: pendingStudentId } });

    if (!result.ok) {
      openBlockedState(result.state);
      return;
    }

    setSuccessAt(result.attendance.checked_in_at);
    setScreen("success");
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
          {rememberedStudent && rememberedStudentId ? (
            <ActionChoiceCard
              title={`Check in as ${rememberedStudent.firstName} ${rememberedStudent.lastInitial}.`}
              description="Fast path on this device"
              icon={<CheckCircle2 className="h-5 w-5" />}
              onClick={() => {
                setPendingStudent(rememberedStudent);
                setPendingStudentId(rememberedStudentId);
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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AttendanceAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    // Centralized state setter so the first source of truth (whichever
    // resolves first — getSession() or the initial onAuthStateChange event)
    // wins, and we only flip loading=false once. Prevents the race where
    // routes briefly see `loading=false, user=null` and bounce to /sign-in
    // even though a valid session was about to hydrate from localStorage.
    const applySession = (next: Session | null) => {
      if (!mounted) return;
      setSession(next);
      setUser(next?.user ?? null);
      if (!initialized) {
        initialized = true;
        setLoading(false);
      }
    };

    // Subscribe BEFORE reading the persisted session so we never miss an
    // event that fires between the two calls.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data }) => {
      applySession(data.session ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  }), [loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAttendanceAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAttendanceAuth must be used within AttendanceAuthProvider");
  return value;
}

// Detect a "session is gone" error from a server fn invocation. TanStack
// Start serializes thrown Responses into either an actual Response on the
// client or an Error-like object whose `.status` mirrors the HTTP status —
// we accept both shapes here so callers don't have to special-case.
function isAuthExpired(error: unknown): boolean {
  if (!error) return false;
  if (typeof Response !== "undefined" && error instanceof Response) {
    return error.status === 401;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status?: number }).status === 401;
  }
  return false;
}

export function useAuthorizedServerFn<T extends (...args: any[]) => Promise<any>>(serverFn: T) {
  const { session, signOut } = useAttendanceAuth();
  const navigate = useNavigate();
  const invoke = useServerFn(serverFn) as (...args: Parameters<T>) => ReturnType<T>;
  // Make sure two simultaneous 401s (e.g. polling + a button click) don't
  // race to trigger two redirects. The first one wins; the second silently
  // continues to surface its error so callers can still toast/log if they
  // want to.
  const expiredRef = useRef(false);

  const handleAuthExpired = useCallback(async () => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    try {
      await signOut();
    } catch {
      // signOut failure here is non-fatal — we're about to bounce them to
      // /sign-in anyway and the auth listener will reconcile state.
    }
    navigate({ to: "/sign-in", search: { reason: "expired" } });
  }, [navigate, signOut]);

  return async (options?: Parameters<T>[0]) => {
    let accessToken = session?.access_token;

    if (!accessToken) {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token;
    }

    if (!accessToken) {
      // Defer the redirect to the next tick so callers can still attach
      // their own error handling without losing the navigation.
      void handleAuthExpired();
      throw new Error("Your session expired. Please sign in again.");
    }

    const nextOptions = {
      ...options,
      headers: {
        ...(options && typeof options === "object" && "headers" in options && options.headers ? options.headers : {}),
        authorization: `Bearer ${accessToken}`,
      },
    } as Parameters<T>[0];

    const result = invoke(...([nextOptions] as unknown as Parameters<T>));
    return result.then(
      (value) => value,
      (error: unknown) => {
        if (isAuthExpired(error)) {
          void handleAuthExpired();
        }
        throw error;
      },
    ) as ReturnType<T>;
  };
}

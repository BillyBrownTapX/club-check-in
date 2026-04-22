import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

type AuthorizedServerFn<T extends (...args: any[]) => Promise<any>> = (options?: Parameters<T>[0]) => ReturnType<T>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AttendanceAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

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
    signOut,
  }), [loading, session, signOut, user]);

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
  const invoke = useServerFn(serverFn) as unknown as AuthorizedServerFn<T>;
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

  const authorizedInvoke = useCallback((options?: Parameters<T>[0]) => {
    const resolveAccessToken = async () => {
      if (session?.access_token) return session.access_token;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };

    const result = resolveAccessToken().then((accessToken) => {
      if (!accessToken) {
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

      return invoke(...([nextOptions] as unknown as Parameters<T>));
    });

    return result.then(
      (value) => value,
      (error: unknown) => {
        if (isAuthExpired(error)) {
          void handleAuthExpired();
        }
        throw error;
      },
    ) as ReturnType<T>;
  }, [handleAuthExpired, invoke, session?.access_token]);

  return authorizedInvoke;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Why these wrappers exist:
//  - Every authorized server fn must run through `useAuthorizedServerFn` so a
//    401 triggers the centralized sign-out + redirect path.
//  - Every authorized query must wait until the auth context is hydrated
//    (`!loading && !!user`) — otherwise we fire a request without a bearer
//    token, the server returns 401, and the redirect path bounces a user who
//    is in fact signed in. Today every route guards with `loading || !user`
//    in a useEffect; this hook centralizes that gate.
//  - Mutations need a `queryClient.invalidateQueries` helper so write paths
//    are one-liners. Returning the queryClient also lets call sites do
//    optimistic updates when needed.

type AuthorizedQueryOptions<TData, TError = Error> = Omit<
  UseQueryOptions<TData, TError, TData, QueryKey>,
  "queryKey" | "queryFn" | "enabled"
> & {
  /**
   * Additional gate beyond the auth-hydrated check. When false, the query is
   * disabled even if the user is signed in (e.g. waiting on a route param).
   */
  enabled?: boolean;
};

/**
 * Run an authorized server fn through TanStack Query.
 *
 * The query is automatically gated on auth hydration so it never fires a
 * tokenless request. The `queryFn` calls the server fn through
 * `useAuthorizedServerFn`, so a 401 still triggers the central sign-out path.
 */
// We type `serverFn` loosely (any[] args) because TanStack Start's
// RequiredFetcher is stricter than `(opts?: { data }) => …`. Mirroring it
// would force casts at every call site. Runtime contract is stable: every
// server fn accepts `({ data })` (or zero args when no validator).
export function useAuthorizedQuery<TData, TPayload = void>(
  queryKey: QueryKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverFn: (...args: any[]) => Promise<TData>,
  payload?: TPayload,
  options?: AuthorizedQueryOptions<TData>,
) {
  const { loading, user } = useAttendanceAuth();
  const invoke = useAuthorizedServerFn(serverFn);
  const externalEnabled = options?.enabled ?? true;

  return useQuery<TData, Error, TData, QueryKey>({
    ...options,
    queryKey,
    enabled: !loading && !!user && externalEnabled,
    queryFn: async () => {
      if (payload === undefined) {
        return (await (invoke as () => Promise<TData>)()) as TData;
      }
      return (await (invoke as (opts: { data: TPayload }) => Promise<TData>)({ data: payload })) as TData;
    },
  });
}

type AuthorizedMutationOptions<TData, TVariables, TError = Error> = Omit<
  UseMutationOptions<TData, TError, TVariables, unknown>,
  "mutationFn"
> & {
  /**
   * Query key prefixes to invalidate after a successful mutation. Prefix
   * matching means `['events']` invalidates both `['events', 'list', ...]`
   * and `['events', 'detail', id]` — typos in deep keys still recover.
   */
  invalidate?: ReadonlyArray<QueryKey>;
};

/**
 * Run an authorized server fn as a TanStack Query mutation. After a
 * successful mutation, every key in `invalidate` is invalidated by prefix.
 */
export function useAuthorizedMutation<TData, TVariables = void>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverFn: (...args: any[]) => Promise<TData>,
  options?: AuthorizedMutationOptions<TData, TVariables>,
) {
  const invoke = useAuthorizedServerFn(serverFn);
  const queryClient = useQueryClient();
  const { invalidate, onSuccess, ...rest } = options ?? {};

  return useMutation<TData, Error, TVariables, unknown>({
    ...rest,
    mutationFn: async (variables: TVariables) => {
      if (variables === undefined) {
        return (await (invoke as () => Promise<TData>)()) as TData;
      }
      return (await invoke({ data: variables } as { data: TVariables })) as TData;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      if (invalidate?.length) {
        for (const key of invalidate) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      return onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}


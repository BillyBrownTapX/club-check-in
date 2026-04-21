import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
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

type ServerFnCallOptions<T extends (...args: any[]) => Promise<any>> = Parameters<T>[0];

export function useAuthorizedServerFn<T extends (...args: any[]) => Promise<any>>(serverFn: T) {
  const { session } = useAttendanceAuth();
  const invoke = useServerFn(serverFn);

  return (options?: ServerFnCallOptions<T>) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Your session expired. Please sign in again.");
    }

    return invoke({
      ...options,
      headers: {
        ...(options && typeof options === "object" && "headers" in options && options.headers ? options.headers : {}),
        authorization: `Bearer ${accessToken}`,
      },
    } as ServerFnCallOptions<T>);
  };
}

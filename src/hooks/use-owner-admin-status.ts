// Shared owner-admin probe. Returns a boolean only; the real authorization
// happens server-side (authoritative email lookup) and in SQL (reports revoked
// from the `authenticated` role).
//
// Lives in its own module so both the owner console UI and the host-side
// guards can consume it without importing each other.

import { useAttendanceAuth, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { getOwnerAdminMe } from "@/lib/owner-admin.functions";

export const OWNER_ADMIN_ME_KEY = ["owner-admin", "me"] as const;

export function useOwnerAdminStatus() {
  const { loading, user, session } = useAttendanceAuth();
  const authLoading = loading || (!!user && !session);

  const me = useAuthorizedQuery<{ isOwnerAdmin: boolean }>(
    // Scoped to the signed-in user id: a different account can never read
    // another account's cached owner answer after an in-session switch.
    [...OWNER_ADMIN_ME_KEY, user?.id ?? "anonymous"],
    getOwnerAdminMe,
    undefined,
    { staleTime: 300_000, retry: false, enabled: !authLoading && !!user && !!session },
  );


  return {
    isOwner: !!me.data?.isOwnerAdmin,
    // "checking" stays true until we have a definitive answer, so callers can
    // hold rendering instead of flashing the wrong experience.
    checking: authLoading || (!!user && !me.isError && me.data === undefined),
    isError: me.isError,
  };
}

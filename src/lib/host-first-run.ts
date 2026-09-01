// First-run guidance marker for brand-new host accounts.
//
// Set at sign-up, read by the post-auth redirect and the two guided screens
// (/clubs -> /events/new), cleared as soon as the run finishes or the host
// closes out of it. Browser-only, keyed by user id, so existing accounts are
// never marked and nothing about this is server-enforced.

const runKey = (userId: string) => `ahq.first-run.${userId}`;
const PENDING_KEY = "ahq.first-run.pending-email";

function safeSession(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeLocal(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function startFirstRun(userId: string) {
  safeSession()?.setItem(runKey(userId), "1");
}

export function clearFirstRun(userId: string | null | undefined) {
  if (!userId) return;
  safeSession()?.removeItem(runKey(userId));
}

export function isFirstRunActive(userId: string | null | undefined) {
  if (!userId) return false;
  return safeSession()?.getItem(runKey(userId)) === "1";
}

// Email-confirmation flow: the session only exists on the first sign-in after
// sign-up, so remember the address at sign-up time and convert it to a
// first-run marker when that user finally lands with a session.
export function rememberPendingSignUp(email: string) {
  safeLocal()?.setItem(PENDING_KEY, email.trim().toLowerCase());
}

export function claimFirstRun(user: { id: string; email?: string | null } | null | undefined) {
  if (!user) return false;
  if (isFirstRunActive(user.id)) return true;
  const local = safeLocal();
  const pending = local?.getItem(PENDING_KEY);
  if (pending && user.email && pending === user.email.trim().toLowerCase()) {
    local?.removeItem(PENDING_KEY);
    startFirstRun(user.id);
    return true;
  }
  return false;
}

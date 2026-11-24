/**
 * Sign-in rules. These match the demo sign-in in apps/web
 * (services/auth-model.ts) so the experience is the same once connected.
 */
export const authPolicy = {
  /** Failed password attempts before the account is locked. */
  lockAfterFailures: 5,
  lockMinutes: 5,
  /** Signed out after this long without activity. */
  idleTimeoutMinutes: 15,
  /** Signed out after this long regardless of activity. */
  sessionMaxHours: 12,
  accessTokenMinutes: 15,
  codeMinutes: 10,
  codeAttempts: 5,
  resendSeconds: 30,
} as const;

export const refreshCookieName = "acadmaxis_rt";
export const refreshCookiePath = "/api/auth";
export const tokenIssuer = "acadmaxis-api";
export const tokenAudience = "acadmaxis-web";

export const messages = {
  signInFailed: "The email, student number or password is incorrect.",
  codeSent:
    "If the details match an account, a code is on its way. It expires in " +
    authPolicy.codeMinutes +
    " minutes.",
  codeInvalid: "That code is incorrect or has expired.",
  codeExpired: "This code has expired. Request a new one.",
  codeTooManyTries: "Too many incorrect codes. Request a new one.",
  sessionEnded: "Your session has ended. Please sign in again.",
  sessionIdle: "You were signed out after a period of inactivity.",
  wrongPassword: "Your current password is incorrect.",
} as const;

export function lockedMessage(minutes: number) {
  return (
    "Too many failed attempts. Try again in " +
    minutes +
    (minutes === 1 ? " minute." : " minutes.")
  );
}

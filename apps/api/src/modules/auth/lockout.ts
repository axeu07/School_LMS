import { authPolicy } from "./auth.policy";

export type LockState = { failedLoginCount: number; lockedUntil: Date | null };

export function minutesLocked(state: LockState, now: Date): number {
  if (!state.lockedUntil || state.lockedUntil <= now) return 0;
  return Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60_000);
}

/** The lock state after one more wrong password. */
export function afterFailedAttempt(state: LockState, now: Date): LockState {
  const lockExpired = Boolean(state.lockedUntil && state.lockedUntil <= now);
  const failedLoginCount = lockExpired ? 1 : state.failedLoginCount + 1;
  return {
    failedLoginCount,
    lockedUntil:
      failedLoginCount >= authPolicy.lockAfterFailures
        ? new Date(now.getTime() + authPolicy.lockMinutes * 60_000)
        : null,
  };
}

export const unlocked: LockState = { failedLoginCount: 0, lockedUntil: null };

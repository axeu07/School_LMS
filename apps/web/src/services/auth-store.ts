"use client";

import { authSeed, decodeAuthState, type AuthState } from "./auth-model";
import { createLocalStore, useLocalStore } from "./local-store";

/** Demo sign-in state for this browser: session, lockouts and demo inbox. */
const store = createLocalStore("school-lms-auth", authSeed, decodeAuthState);

export function useAuthState() {
  return useLocalStore(store);
}

export function getAuthSnapshot() {
  return store.snapshot();
}

export function updateAuthState(update: (state: AuthState) => AuthState) {
  const current = store.snapshot();
  const next = update(current);
  if (next !== current) store.update(() => next);
}

export function resetAuthState() {
  store.reset();
}

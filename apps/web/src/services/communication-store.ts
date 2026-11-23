"use client";

import {
  communicationSeed,
  decodeCommunicationState,
  type CommunicationState,
} from "./communication-model";
import { createLocalStore, useLocalStore } from "./local-store";

/**
 * Calendar, PTM, messaging and in-app notification records. Shared by every
 * role and tab in this browser only — nothing syncs across devices.
 */
const store = createLocalStore(
  "school-lms-communication",
  communicationSeed,
  decodeCommunicationState,
);

export function useCommunicationState() {
  return useLocalStore(store);
}

/** Applies a change; skips the write when the change returns the same state. */
export function updateCommunicationState(
  update: (state: CommunicationState) => CommunicationState,
) {
  const current = store.snapshot();
  const next = update(current);
  if (next !== current) store.update(() => next);
}

export function resetCommunicationState() {
  store.reset();
}

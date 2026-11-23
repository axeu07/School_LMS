"use client";

import {
  decodePrivacyState,
  privacySeed,
  type PrivacyState,
} from "./privacy-model";
import { createLocalStore, useLocalStore } from "./local-store";

const store = createLocalStore(
  "school-lms-privacy",
  privacySeed,
  decodePrivacyState,
);

export function usePrivacyState() {
  return useLocalStore(store);
}

export function updatePrivacyState(
  update: (state: PrivacyState) => PrivacyState,
) {
  store.update(update);
}

export function resetPrivacyState() {
  store.reset();
}

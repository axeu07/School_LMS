"use client";

import { decodeDoubtState, doubtSeed, type DoubtState } from "./doubt-model";
import { createLocalStore, useLocalStore } from "./local-store";

const store = createLocalStore(
  "school-lms-doubts",
  doubtSeed,
  decodeDoubtState,
);

export function useDoubtState() {
  return useLocalStore(store);
}

export function updateDoubtState(update: (state: DoubtState) => DoubtState) {
  store.update(update);
}

export function resetDoubtState() {
  store.reset();
}

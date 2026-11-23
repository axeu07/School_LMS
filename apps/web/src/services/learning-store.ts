"use client";

import { useSyncExternalStore } from "react";
import {
  decodeLearningState,
  learningSeed,
  type LearningState,
} from "./learning-model";
import { createLocalStore, useLocalStore } from "./local-store";
import { getAcademicSnapshot } from "./academic-store";
import { diffLearning } from "./audit-model";
import { recordAudit } from "./audit-store";

const store = createLocalStore(
  "school-lms-learning",
  learningSeed,
  decodeLearningState,
  (before, after) =>
    recordAudit(
      diffLearning(before, after, (id) => getAcademicSnapshot().schools[id]),
    ),
);

export function useLearningState() {
  return useLocalStore(store);
}

export function updateLearningState(
  update: (state: LearningState) => LearningState,
) {
  store.update(update);
}

export function resetLearningState() {
  store.reset();
}

/* A shared clock, so time-based states (open, closed, countdowns) stay in sync. */
const clocks = new Map<
  number,
  { value: number; subscribe: (callback: () => void) => () => void }
>();

function clock(interval: number) {
  let entry = clocks.get(interval);
  if (!entry) {
    const listeners = new Set<() => void>();
    let timer: ReturnType<typeof setInterval> | undefined;
    const created = {
      value: Date.now(),
      subscribe(callback: () => void) {
        listeners.add(callback);
        if (listeners.size === 1) {
          created.value = Date.now();
          timer = setInterval(() => {
            created.value = Date.now();
            listeners.forEach((listener) => listener());
          }, interval);
        }
        return () => {
          listeners.delete(callback);
          if (!listeners.size) clearInterval(timer);
        };
      },
    };
    entry = created;
    clocks.set(interval, entry);
  }
  return entry;
}

/**
 * The current time, refreshed every `interval` ms. Undefined during server
 * rendering and hydration so time-based text never mismatches.
 */
export function useNow(interval = 15_000) {
  const entry = clock(interval);
  const value = useSyncExternalStore(
    entry.subscribe,
    () => entry.value,
    () => 0,
  );
  return value ? new Date(value) : undefined;
}

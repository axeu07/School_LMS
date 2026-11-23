"use client";

import { useSyncExternalStore } from "react";
import { academicSeed, decodeAcademicState } from "./academic-seed";
import type { AcademicState } from "./academic-model";

const key = "school-lms-academics";
const updateEvent = "school-lms-academics-updated";
let cachedRaw: string | null | undefined;
let cachedState = academicSeed;
let memoryOnly = false;

function snapshot() {
  if (memoryOnly) return cachedState;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedState = decodeAcademicState(raw);
    }
  } catch {
    memoryOnly = true;
  }
  return cachedState;
}

function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) callback();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(updateEvent, callback);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(updateEvent, callback);
  };
}

export function useAcademicState() {
  return useSyncExternalStore(subscribe, snapshot, () => academicSeed);
}

export function updateAcademicState(
  update: (state: AcademicState) => AcademicState,
) {
  const state = update(snapshot());
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(key, raw);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  cachedRaw = raw;
  cachedState = state;
  window.dispatchEvent(new Event(updateEvent));
}

export function resetAcademicState() {
  updateAcademicState(() => academicSeed);
}

"use client";

import { useSyncExternalStore } from "react";
import "@/services/demo-reset";
import { academicDemoSeed, decodeAcademicState } from "./academic-seed";
import type { AcademicState } from "./academic-model";
import { diffAcademic } from "./audit-model";
import { recordAudit } from "./audit-store";

const key = "school-lms-academics";
const updateEvent = "school-lms-academics-updated";
let cachedRaw: string | null | undefined;
let cachedState = academicDemoSeed;
let memoryOnly = false;

function snapshot() {
  if (memoryOnly) return cachedState;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      // Nothing saved yet: start from the demo seed with full class rosters.
      cachedState = raw ? decodeAcademicState(raw) : academicDemoSeed;
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
  return useSyncExternalStore(subscribe, snapshot, () => academicDemoSeed);
}

/** The latest academic records, for non-React code such as audit labels. */
export function getAcademicSnapshot() {
  return snapshot();
}

export function updateAcademicState(
  update: (state: AcademicState) => AcademicState,
) {
  const before = snapshot();
  const state = update(before);
  write(state);
  if (state !== before) recordAudit(diffAcademic(before, state));
}

function write(state: AcademicState) {
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
  write(academicDemoSeed);
}

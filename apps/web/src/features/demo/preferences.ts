"use client";

import { useSyncExternalStore } from "react";

const preferencesChanged = "school-lms-demo-preferences";
const sessionPreferences = new Map<string, string>();

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(preferencesChanged, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferencesChanged, callback);
  };
}

export function setPreference(key: string, next: string) {
  try {
    localStorage.setItem(key, next);
    sessionPreferences.delete(key);
  } catch {
    sessionPreferences.set(key, next);
  }
  window.dispatchEvent(new Event(preferencesChanged));
}

/** A string preference persisted in localStorage and shared across routes. */
export function usePreference(key: string, fallback: string) {
  const getSnapshot = () => {
    if (sessionPreferences.has(key)) return sessionPreferences.get(key)!;
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  return [value, (next: string) => setPreference(key, next)] as const;
}

export const schoolPreferenceKey = "school-lms-demo-school";
export const childPreferenceKey = (school: string) =>
  "school-lms-demo-child-" + school;
/** Which demo student (by learner id) the student workspace shows. */
export const studentPreferenceKey = "school-lms-demo-student";
export const sidebarPreferenceKey = "school-lms-sidebar-collapsed";

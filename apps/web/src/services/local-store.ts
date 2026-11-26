"use client";

import { useSyncExternalStore } from "react";
import "@/services/demo-reset";

/**
 * A small localStorage-backed external store shared by every tab and route.
 * Falls back to in-memory state when storage is blocked.
 */
export function createLocalStore<T>(
  key: string,
  seed: T,
  decode: (raw: string | null) => T,
  /** Called after each update (not after reset), e.g. to write the audit log. */
  onChange?: (before: T, after: T) => void,
) {
  const updateEvent = key + "-updated";
  let cachedRaw: string | null | undefined;
  let cachedState = seed;
  let memoryOnly = false;

  function snapshot() {
    if (memoryOnly) return cachedState;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedState = decode(raw);
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

  function update(change: (state: T) => T) {
    const before = snapshot();
    const state = change(before);
    write(state);
    if (onChange && state !== before) onChange(before, state);
  }

  function write(state: T) {
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

  return {
    subscribe,
    snapshot,
    serverSnapshot: () => seed,
    update,
    reset: () => write(seed),
  };
}

export function useLocalStore<T>(store: {
  subscribe: (callback: () => void) => () => void;
  snapshot: () => T;
  serverSnapshot: () => T;
}) {
  return useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.serverSnapshot,
  );
}

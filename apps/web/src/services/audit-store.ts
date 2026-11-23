"use client";

import type { SchoolId } from "@/types/demo";
import {
  appendEntries,
  auditSeed,
  decodeAuditState,
  type AuditActor,
  type AuditArea,
  type AuditInput,
} from "./audit-model";
import { createLocalStore, useLocalStore } from "./local-store";

const store = createLocalStore("school-lms-audit", auditSeed, decodeAuditState);

/** The person using the app right now; set by the workspace shell. */
let currentActor: AuditActor = { role: "system", name: "System" };

export function setAuditActor(actor: AuditActor) {
  currentActor = actor;
}

export function useAuditState() {
  return useLocalStore(store);
}

export function recordAudit(inputs: AuditInput[], actor = currentActor) {
  if (!inputs.length) return;
  store.update((state) =>
    appendEntries(state, inputs, actor, new Date(), () => crypto.randomUUID()),
  );
}

export function logAudit(
  school: SchoolId | "platform",
  area: AuditArea,
  action: string,
  detail: string,
  actor = currentActor,
) {
  recordAudit([{ school, area, action, detail }], actor);
}

export function resetAuditState() {
  store.reset();
}

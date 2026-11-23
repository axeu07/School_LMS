"use client";

import type { SchoolId } from "@/types/demo";
import type { AcademicState, AttendanceStatus } from "./academic-model";
import { updateAcademicState } from "./academic-store";
import type { AssignmentActor } from "./assignment-model";
import { saveAttendance } from "./attendance-model";
import { createLocalStore, useLocalStore } from "./local-store";
import {
  leaveSchool,
  localStamp,
  syncAbsenceAlerts,
  type LeaveState,
} from "./leave-model";
import { decodeLeave, leaveSeed } from "./leave-seed";

/** Versioned, school-keyed leave records on the shared local-store layer. */
const store = createLocalStore("school-lms-leave", leaveSeed, decodeLeave);

export function useLeaveState() {
  return useLocalStore(store);
}

export function useLeaveSchool(school: SchoolId) {
  return leaveSchool(useLeaveState(), school);
}

export function updateLeaveState(update: (state: LeaveState) => LeaveState) {
  store.update(update);
}

export function resetLeaveState() {
  store.reset();
}

/**
 * Saves a section's attendance through the existing attendance service, then
 * reconciles parent absence alerts for exactly that record.
 */
export function recordAttendance(
  actor: AssignmentActor,
  section: string,
  date: string,
  marks: Record<string, AttendanceStatus>,
) {
  let saved: AcademicState | undefined;
  updateAcademicState((state) => {
    saved = saveAttendance(state, actor, section, date, marks);
    return saved;
  });
  const school = saved!.schools[actor.school];
  updateLeaveState((state) =>
    syncAbsenceAlerts(state, school, actor.school, localStamp(), {
      section,
      date,
    }),
  );
}

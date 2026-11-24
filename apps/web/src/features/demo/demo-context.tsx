"use client";

import { createContext, useContext, type ReactNode } from "react";
import { academicRecords, roleProfiles } from "@/mocks/academics";
import { getAcademicDashboard } from "@/services/academic-dashboard";
import type { AcademicSchool } from "@/services/academic-model";
import { useAcademicState } from "@/services/academic-store";
import type { AssignmentActor } from "@/services/assignment-model";
import { listDemoSchools } from "@/services/demo-service";
import { studentStage, type StudentStage } from "@/services/student-stage";
import type { DemoRole, School, SchoolId } from "@/types/demo";
import {
  childPreferenceKey,
  schoolPreferenceKey,
  studentPreferenceKey,
  usePreference,
} from "./preferences";
import { useWorkspaceSession } from "./session-guard";

const schools = listDemoSchools();
const defaultSchool = schools[0].id;

type DashboardData = NonNullable<ReturnType<typeof getAcademicDashboard>>;
export type DemoContextValue = {
  role: DemoRole;
  profile: (typeof roleProfiles)[DemoRole];
  schools: readonly School[];
  school: School;
  schoolId: SchoolId;
  /** Shared academic records for the selected school. */
  records: AcademicSchool;
  data: DashboardData;
  actor: AssignmentActor;
  /** Student workspaces only: playful up to Class 8, calm from Class 9. */
  stage?: StudentStage;
  /** Changes whenever the school or the parent's active child changes. */
  scopeKey: string;
  setSchool: (id: SchoolId) => void;
  setChild: (id: string) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider.");
  return value;
}

export function DemoProvider({
  role,
  fallback,
  children,
}: {
  role: DemoRole;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const [schoolPreference, setSchool] = usePreference(
    schoolPreferenceKey,
    defaultSchool,
  );
  const schoolId: SchoolId =
    schools.find(({ id }) => id === schoolPreference)?.id ?? defaultSchool;
  const [childId, setChild] = usePreference(childPreferenceKey(schoolId), "");
  const records = useAcademicState().schools[schoolId];
  // A signed-in student sees their own records; in demo mode the profile
  // picker chooses between the Class 8 and Class 10 demo students.
  const session = useWorkspaceSession(role, schoolId);
  const [studentChoice] = usePreference(studentPreferenceKey, "");
  const senior = academicRecords.find((item) => item.schoolId === schoolId)
    ?.senior.id;
  const studentId =
    session?.person ?? (studentChoice === "senior" ? (senior ?? "") : "");
  const data = getAcademicDashboard(
    role,
    schoolId,
    records,
    role === "student" ? studentId : childId,
  );
  if (!data) return fallback;
  const value: DemoContextValue = {
    role,
    profile: roleProfiles[role],
    schools,
    school: data.school,
    schoolId,
    records,
    data,
    actor: {
      role,
      school: schoolId,
      person: data.person.id,
      child: data.child?.id,
    },
    scopeKey:
      schoolId +
      "-" +
      (role === "parent"
        ? (data.child?.id ?? "none")
        : role === "student"
          ? data.person.id
          : role),
    stage:
      role === "student" ? studentStage(records, data.person.id) : undefined,
    setSchool,
    setChild,
  };
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

"use client";

import type { ComponentType } from "react";
import type { DemoRole } from "@/types/demo";
import { Dashboard, DashboardSkeleton } from "./dashboard/kit";
import { ParentDashboard } from "./dashboard/parent-dashboard";
import { SchoolAdminDashboard } from "./dashboard/school-admin-dashboard";
import { StudentDashboard } from "./dashboard/student-dashboard";
import { SuperAdminDashboard } from "./dashboard/super-admin-dashboard";
import { TeacherDashboard } from "./dashboard/teacher-dashboard";
import { preschool } from "@/features/preschool/config";
import {
  PreschoolAdminDashboard,
  PreschoolParentDashboard,
  PreschoolTeacherDashboard,
} from "@/features/preschool/dashboards";
import {
  useDashboardSources,
  type DashboardSources,
} from "./dashboard/use-dashboard";

/**
 * One dashboard per role, all built from the shared kit in ./dashboard.
 * To add a role, write its composition and register it here.
 */
const dashboards: Record<
  DemoRole,
  ComponentType<{ sources: DashboardSources }>
> = {
  "super-admin": SuperAdminDashboard,
  "school-admin": SchoolAdminDashboard,
  teacher: TeacherDashboard,
  student: StudentDashboard,
  parent: ParentDashboard,
};

/** Preschool mode swaps in day-care dashboards; the K-12 ones stay above. */
const preschoolDashboards: Partial<typeof dashboards> = {
  "school-admin": PreschoolAdminDashboard,
  teacher: PreschoolTeacherDashboard,
  parent: PreschoolParentDashboard,
};

export function RoleOverview() {
  const sources = useDashboardSources();
  // Time-based figures need the client clock; show the layout until then.
  if (!sources.now || !sources.today) return <DashboardSkeleton />;
  const View =
    (preschool.enabled && preschoolDashboards[sources.role]) ||
    dashboards[sources.role];
  return (
    <Dashboard>
      <View sources={sources as DashboardSources} />
    </Dashboard>
  );
}

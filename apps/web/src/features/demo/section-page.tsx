"use client";

import type { ReactNode } from "react";
import type { DemoRole } from "@/types/demo";
import { AssignmentWorkspace } from "./assignment-workspace";
import { AttendanceWorkspace } from "./attendance-workspace";
import { useDemo } from "./demo-context";
import { EmptyState } from "./dashboard-widgets";
import { findNavItem } from "./navigation";
import { PageHeader } from "./page-header";
import {
  AcademicPage,
  AdminAssignments,
  SchoolPerformance,
  SchoolSettings,
} from "./pages/admin-pages";
import { DoubtBoard } from "./pages/doubt-board";
import { ChildrenPage, LearnerProgress } from "./pages/family-pages";
import { PlatformAnalytics, SchoolsDirectory } from "./pages/platform-pages";
import {
  AiNotesPreview,
  AiTeachingPreview,
  AssessmentsPreview,
  BrandingPreview,
  CoursesPreview,
  DailyQuizPreview,
  HomeworkHelperPreview,
  MarketingPreview,
  MessagesPreview,
  PlatformSettingsPreview,
  SubscriptionsPreview,
} from "./pages/preview-pages";
import {
  AnnouncementsFeed,
  ClassPerformance,
  TeacherClasses,
  TimetableView,
} from "./pages/teaching-pages";

function Assignments() {
  const { records, actor, role, data } = useDemo();
  if (role === "parent" && !data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  return <AssignmentWorkspace school={records} actor={actor} />;
}

function Attendance() {
  const { records, actor, role, data } = useDemo();
  if (role === "parent" && !data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  return <AttendanceWorkspace school={records} actor={actor} />;
}

function renderSection(role: DemoRole, slug: string): ReactNode {
  switch (role + "/" + slug) {
    case "super-admin/schools":
      return <SchoolsDirectory />;
    case "super-admin/subscriptions":
      return <SubscriptionsPreview />;
    case "super-admin/analytics":
      return <PlatformAnalytics />;
    case "super-admin/branding":
      return <BrandingPreview />;
    case "super-admin/settings":
      return <PlatformSettingsPreview />;

    case "school-admin/academic-years":
      return <AcademicPage tables={["years"]} />;
    case "school-admin/classes":
      return <AcademicPage tables={["sections"]} />;
    case "school-admin/subjects":
      return <AcademicPage tables={["subjects"]} />;
    case "school-admin/allocations":
      return <AcademicPage tables={["allocations"]} />;
    case "school-admin/timetable":
      return <AcademicPage tables={["sessions"]} />;
    case "school-admin/teachers":
      return <AcademicPage tables={["teachers"]} />;
    case "school-admin/students":
      return <AcademicPage tables={["students", "enrollments"]} />;
    case "school-admin/parents":
      return <AcademicPage tables={["guardians", "links"]} />;
    case "school-admin/announcements":
      return <AcademicPage tables={["announcements"]} />;
    case "school-admin/assignments":
      return <AdminAssignments />;
    case "school-admin/attendance":
    case "teacher/attendance":
    case "student/attendance":
    case "parent/attendance":
      return <Attendance />;
    case "school-admin/performance":
      return <SchoolPerformance />;
    case "school-admin/marketing":
      return <MarketingPreview />;
    case "school-admin/settings":
      return <SchoolSettings />;

    case "teacher/timetable":
    case "student/timetable":
      return <TimetableView />;
    case "teacher/classes":
      return <TeacherClasses />;
    case "teacher/courses":
    case "student/courses":
      return <CoursesPreview />;
    case "teacher/assignments":
    case "student/assignments":
    case "parent/homework":
      return <Assignments />;
    case "teacher/assessments":
    case "student/quizzes":
    case "parent/assessments":
      return <AssessmentsPreview />;
    case "teacher/doubt-board":
    case "student/doubt-board":
      return <DoubtBoard />;
    case "teacher/ai-tools":
      return <AiTeachingPreview />;
    case "teacher/performance":
      return <ClassPerformance />;
    case "teacher/announcements":
    case "student/announcements":
    case "parent/announcements":
      return <AnnouncementsFeed />;

    case "student/ai-homework-helper":
      return <HomeworkHelperPreview />;
    case "student/ai-notes":
      return <AiNotesPreview />;
    case "student/daily-quiz":
      return <DailyQuizPreview />;
    case "student/progress":
    case "parent/performance":
      return <LearnerProgress />;

    case "parent/children":
      return <ChildrenPage />;
    case "parent/messages":
      return <MessagesPreview />;
  }
  return <EmptyState>This page is unavailable.</EmptyState>;
}

export function SectionPage({ slug }: { slug: string }) {
  const { role } = useDemo();
  const entry = findNavItem(role, slug);
  if (!entry) return <EmptyState>This page is unavailable.</EmptyState>;
  return (
    <>
      <PageHeader
        title={entry.title}
        description={entry.description}
        group={entry.group}
        preview={entry.status === "preview"}
      />
      <div className="page-body">{renderSection(role, slug)}</div>
    </>
  );
}

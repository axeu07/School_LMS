import { academicRecords } from "@/mocks/academics";
import type { DemoRole, SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  visibleAnnouncements,
  type AcademicSchool,
} from "./academic-model";
import { assignmentsFor, localCalendarDate } from "./assignment-model";
import { attendanceFor, attendancePercentage } from "./attendance-model";
import { getDemoDashboard } from "./demo-service";

export function getAcademicDashboard(
  role: DemoRole,
  schoolId: SchoolId,
  school: AcademicSchool,
  childId: string,
) {
  const source = academicRecords.find((item) => item.schoolId === schoolId);
  if (!source) return;
  const children = linkedStudents(school, source.parent.id);
  const child = children.find((item) => item.id === childId) ?? children[0];
  // A student workspace passes its own learner id in place of a child id.
  const base = getDemoDashboard(
    role,
    schoolId,
    role === "student" ? childId : child?.id,
  );
  if (!base) return;
  const person =
    role === "parent"
      ? (school.guardians.find((item) => item.id === source.parent.id) ??
        base.person)
      : role === "student"
        ? (school.students.find((item) => item.id === base.person.id) ??
          base.person)
        : role === "teacher"
          ? (school.teachers.find((item) => item.id === base.person.id) ??
            base.person)
          : base.person;

  const announcements = visibleAnnouncements(
    school,
    role,
    person.id,
    child?.id,
  ).map((item) => ({
    title: item.name,
    detail: item.message,
    meta: role === "school-admin" ? item.status : undefined,
  }));
  const announcementPanel = {
    id: "announcements",
    title: "Announcements",
    rows: announcements,
  };
  if (role === "parent" && !child) {
    return {
      ...base,
      person,
      child,
      children,
      courses: [],
      stats: [],
      notifications: announcements,
      panels: [announcementPanel],
      chart: {
        ...base.chart,
        title: "Academic performance",
        description: "Select a linked child to view results.",
        labels: [],
        values: [],
      },
    };
  }

  const enrollment = currentEnrollment(
    school,
    role === "parent" ? child!.id : person.id,
  );
  const allocations = school.allocations.filter((item) => {
    const section = school.sections.find((group) => group.id === item.section);
    return (
      section?.status === "Active" &&
      school.years.some(
        (year) => year.id === section.year && year.status === "Active",
      ) &&
      (role === "teacher"
        ? item.teacher === person.id
        : item.section === enrollment?.section)
    );
  });
  const classes = [...new Set(allocations.map((item) => item.section))].map(
    (id) => {
      const section = school.sections.find((item) => item.id === id)!;
      return {
        title: section.grade + " · " + section.name,
        detail: allocations
          .filter((item) => item.section === id)
          .map(
            (item) =>
              school.subjects.find((subject) => subject.id === item.subject)
                ?.name,
          )
          .join(" · "),
      };
    },
  );
  const schedule = school.sessions.flatMap((session) => {
    const allocation = allocations.find(
      (item) => item.id === session.allocation,
    );
    if (!allocation) return [];
    const subject = school.subjects.find(
      (item) => item.id === allocation.subject,
    );
    return [
      {
        title: subject?.name ?? "Class session",
        detail: session.day + " · " + session.room,
        meta: session.start + "–" + session.end,
      },
    ];
  });
  const assignments = assignmentsFor(school, {
    role,
    school: schoolId,
    person: person.id,
    child: child?.id,
  });
  const studentId = role === "parent" ? child?.id : person.id;
  const today = localCalendarDate();
  const pending = assignments.filter(
    (item) =>
      item.due >= today &&
      !school.submissions.some(
        (submission) =>
          submission.student === studentId &&
          submission.assignment === item.id &&
          (submission.status === "Submitted" || submission.status === "Graded"),
      ),
  );
  const reviews = school.submissions.filter(
    (item) =>
      item.status === "Submitted" &&
      assignments.some((assignment) => assignment.id === item.assignment),
  );
  const graded = school.submissions.filter(
    (item) =>
      item.student === studentId &&
      item.status === "Graded" &&
      assignments.some((assignment) => assignment.id === item.assignment),
  );
  const attendance = attendancePercentage(
    attendanceFor(school, {
      role,
      school: schoolId,
      person: person.id,
      child: child?.id,
    }),
  );
  const attendanceValue = attendance === undefined ? "—" : attendance + "%";
  const statValues: Record<string, [string, string]> = {
    ...(role === "school-admin"
      ? {
          "Total students": [
            String(
              school.students.filter((item) =>
                currentEnrollment(school, item.id),
              ).length,
            ),
            "Enrolled in the active academic year",
          ],
          "Total teachers": [
            String(
              school.teachers.filter((item) => item.status === "Active").length,
            ),
            "Active faculty",
          ],
          "Active classes": [
            String(
              school.sections.filter(
                (item) =>
                  item.status === "Active" &&
                  school.years.some(
                    (year) => year.id === item.year && year.status === "Active",
                  ),
              ).length,
            ),
            "Sections in the active academic year",
          ],
        }
      : {}),
    Attendance: [attendanceValue, "From recorded sessions"],
    "Today's attendance": [attendanceValue, "From recorded sessions"],
    "Pending homework": [String(pending.length), "Open assignments"],
    "To review": [String(reviews.length), "Submitted assignments"],
    "Homework completion": [
      assignments.length
        ? Math.round(
            (100 *
              school.submissions.filter(
                (item) =>
                  item.student === studentId &&
                  (item.status === "Graded" || item.status === "Submitted") &&
                  assignments.some(
                    (assignment) => assignment.id === item.assignment,
                  ),
              ).length) /
              assignments.length,
          ) + "%"
        : "—",
      "Published assignments submitted",
    ],
    "Linked children": [String(children.length), "In this school"],
    "Assigned classes": [String(classes.length), "In the active academic year"],
    "Today's lessons": [String(schedule.length), "On your weekly timetable"],
    "Today's classes": [String(schedule.length), "On your weekly timetable"],
  };
  const panels = base.panels
    .filter((panel) => panel.id !== "announcements")
    .map((panel) => {
      if (panel.id === "homework" || panel.id === "assignments") {
        const rows =
          panel.id === "homework"
            ? pending
            : assignments.filter((item) =>
                reviews.some((submission) => submission.assignment === item.id),
              );
        return {
          ...panel,
          rows: rows.map((item) => ({
            title: item.title,
            detail: item.instructions,
            meta: item.due,
          })),
        };
      }
      if (panel.id === "schedule")
        return { ...panel, title: "Weekly timetable", rows: schedule };
      if (panel.id === "classes") return { ...panel, rows: classes };
      if (panel.id === "children")
        return {
          ...panel,
          rows: children.map((item) => {
            const section = school.sections.find(
              (group) =>
                group.id === currentEnrollment(school, item.id)?.section,
            );
            return {
              title: item.name,
              detail: section
                ? section.grade + " · " + section.name
                : "No current enrollment",
            };
          }),
        };
      return panel;
    });
  if (role !== "super-admin") panels.push(announcementPanel);
  if (role === "parent" || role === "student")
    panels.push({
      id: "assignment-results",
      title: "Assignment results",
      rows: graded.map((item) => {
        const assignment = assignments.find(
          (entry) => entry.id === item.assignment,
        )!;
        return {
          title: assignment.title,
          detail: item.feedback ?? "",
          meta: item.marks + "/" + assignment.maximum,
        };
      }),
    });
  const newChild =
    role === "parent" && !source.learners.some((item) => item.id === child?.id);
  return {
    ...base,
    person,
    child,
    children,
    panels: newChild ? panels.filter((panel) => panel.id !== "exams") : panels,
    chart: newChild
      ? {
          ...base.chart,
          description: "No assessment history for this child.",
          labels: [],
          values: [],
        }
      : base.chart,
    notifications:
      role === "super-admin" ? base.notifications : announcements.slice(0, 5),
    stats: base.stats.flatMap((stat) => {
      if (newChild && stat.label !== "Linked children") return [];
      const values = statValues[stat.label];
      const label =
        stat.label === "Today's classes" || stat.label === "Today's lessons"
          ? "Weekly sessions"
          : stat.label === "Today's attendance"
            ? "Recorded attendance"
            : stat.label;
      return [
        {
          ...stat,
          label,
          value: values?.[0] ?? stat.value,
          note: values?.[1] ?? stat.note,
        },
      ];
    }),
  };
}

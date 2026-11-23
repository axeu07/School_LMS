import { currentEnrollment, type AcademicSchool } from "./academic-model";
import { attendancePercentage, attendanceRoster } from "./attendance-model";

export function percent(part: number, total: number) {
  return total ? Math.round((100 * part) / total) : undefined;
}

export function formatPercent(value: number | undefined) {
  return value === undefined ? "—" : value + "%";
}

/** Average graded score (as a percentage of maximum marks). */
export function gradeAverage(
  school: AcademicSchool,
  assignmentIds: Set<string>,
  student?: string,
) {
  const scores = school.submissions.flatMap((item) => {
    if (
      item.status !== "Graded" ||
      item.marks === undefined ||
      !assignmentIds.has(item.assignment) ||
      (student && item.student !== student)
    )
      return [];
    const assignment = school.assignments.find(
      (entry) => entry.id === item.assignment,
    );
    return assignment ? [(100 * item.marks) / assignment.maximum] : [];
  });
  return scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : undefined;
}

export function studentAttendance(school: AcademicSchool, student: string) {
  return attendancePercentage(
    school.attendance.flatMap((item) =>
      item.marks[student]
        ? [{ ...item, marks: { [student]: item.marks[student] } }]
        : [],
    ),
  );
}

export function sectionLabel(school: AcademicSchool, id: string) {
  const section = school.sections.find((item) => item.id === id);
  return section ? section.grade + " · " + section.name : "—";
}

export function subjectName(school: AcademicSchool, id: string) {
  return school.subjects.find((item) => item.id === id)?.name ?? "—";
}

/** Live figures for one section, derived from shared academic records. */
export function sectionSummary(school: AcademicSchool, sectionId: string) {
  const section = school.sections.find((item) => item.id === sectionId);
  const roster = attendanceRoster(school, sectionId);
  const allocations = school.allocations.filter(
    (item) => item.section === sectionId,
  );
  const assignments = school.assignments.filter(
    (item) =>
      item.published &&
      allocations.some((allocation) => allocation.id === item.allocation),
  );
  const ids = new Set(assignments.map((item) => item.id));
  const handedIn = school.submissions.filter(
    (item) =>
      ids.has(item.assignment) &&
      (item.status === "Submitted" || item.status === "Graded"),
  ).length;
  return {
    section,
    roster,
    capacity: Number(section?.capacity ?? 0),
    subjects: allocations.map((item) => subjectName(school, item.subject)),
    attendance: attendancePercentage(
      school.attendance.filter((item) => item.section === sectionId),
    ),
    assignments,
    submissionRate: percent(handedIn, assignments.length * roster.length),
    average: gradeAverage(school, ids),
    awaitingReview: school.submissions.filter(
      (item) => ids.has(item.assignment) && item.status === "Submitted",
    ).length,
  };
}

/** Live figures for one student across their current section. */
export function studentSummary(school: AcademicSchool, student: string) {
  const enrollment = currentEnrollment(school, student);
  const allocations = school.allocations.filter(
    (item) => item.section === enrollment?.section,
  );
  const assignments = school.assignments.filter(
    (item) =>
      item.published &&
      allocations.some((allocation) => allocation.id === item.allocation),
  );
  const ids = new Set(assignments.map((item) => item.id));
  const submissions = school.submissions.filter(
    (item) => item.student === student && ids.has(item.assignment),
  );
  const graded = submissions
    .filter((item) => item.status === "Graded")
    .map((item) => {
      const assignment = assignments.find(
        (entry) => entry.id === item.assignment,
      )!;
      const allocation = allocations.find(
        (entry) => entry.id === assignment.allocation,
      );
      return {
        assignment,
        subject: allocation ? subjectName(school, allocation.subject) : "—",
        marks: item.marks ?? 0,
        feedback: item.feedback ?? "",
        score: Math.round((100 * (item.marks ?? 0)) / assignment.maximum),
      };
    });
  return {
    enrollment,
    section: enrollment ? sectionLabel(school, enrollment.section) : undefined,
    attendance: studentAttendance(school, student),
    assignments,
    completion: percent(
      submissions.filter(
        (item) => item.status === "Submitted" || item.status === "Graded",
      ).length,
      assignments.length,
    ),
    graded,
    average: gradeAverage(school, ids, student),
  };
}

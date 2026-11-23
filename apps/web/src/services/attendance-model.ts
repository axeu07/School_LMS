import {
  activeAllocations,
  localCalendarDate,
  type AssignmentActor,
} from "./assignment-model";
import {
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
  type AcademicState,
  type Attendance,
  type AttendanceStatus,
} from "./academic-model";

export function attendanceRoster(school: AcademicSchool, section: string) {
  const ids = new Set(
    school.enrollments
      .filter((item) => item.section === section && item.status === "Enrolled")
      .map((item) => item.student),
  );
  return school.students.filter((item) => ids.has(item.id));
}

export function attendanceFor(
  school: AcademicSchool,
  actor: AssignmentActor,
): Attendance[] {
  if (actor.role === "school-admin") return school.attendance;
  if (actor.role === "teacher") {
    const sections = new Set(
      activeAllocations(school, actor).map((item) => item.section),
    );
    return school.attendance.filter((item) => sections.has(item.section));
  }
  const student =
    actor.role === "student" &&
    school.students.some((item) => item.id === actor.person)
      ? actor.person
      : actor.role === "parent" &&
          linkedStudents(school, actor.person).some(
            (item) => item.id === actor.child,
          )
        ? actor.child
        : undefined;
  return student
    ? school.attendance.flatMap((item) =>
        item.marks[student]
          ? [{ ...item, marks: { [student]: item.marks[student] } }]
          : [],
      )
    : [];
}

export function attendancePercentage(records: Attendance[]) {
  const marks = records.flatMap((item) => Object.values(item.marks));
  return marks.length
    ? Math.round(
        (100 * marks.filter((mark) => mark !== "Absent").length) / marks.length,
      )
    : undefined;
}

export function saveAttendance(
  state: AcademicState,
  actor: AssignmentActor,
  section: string,
  date: string,
  marks: Record<string, AttendanceStatus>,
  today = localCalendarDate(),
): AcademicState {
  const school = state.schools[actor.school];
  requireRule(
    actor.role === "teacher" &&
      school &&
      activeAllocations(school, actor).some((item) => item.section === section),
    "Choose one of your assigned sections.",
  );
  requireRule(
    validDate(date) && date <= today,
    "Choose a valid date through today.",
  );
  const group = school.sections.find((item) => item.id === section);
  const year = school.years.find((item) => item.id === group?.year);
  requireRule(
    year && date >= year.start && date <= year.end,
    "Choose a date within the section’s academic year.",
  );
  const roster = attendanceRoster(school, section);
  requireRule(
    roster.length &&
      roster.length === Object.keys(marks).length &&
      roster.every(({ id }) =>
        ["Present", "Absent", "Late"].includes(marks[id]),
      ),
    "Mark every student on the section roster.",
  );
  const previous = school.attendance.find(
    (item) => item.section === section && item.date === date,
  );
  const updated = { section, date, marks: { ...previous?.marks, ...marks } };
  return {
    ...state,
    schools: {
      ...state.schools,
      [actor.school]: {
        ...school,
        attendance: [
          ...school.attendance.filter((item) => item !== previous),
          updated,
        ],
      },
    },
  };
}

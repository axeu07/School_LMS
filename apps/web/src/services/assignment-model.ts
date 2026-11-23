import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
  type AcademicState,
  type Actor,
  type Assignment,
  type Submission,
} from "./academic-model";

export type AssignmentActor = Actor & { person: string; child?: string };

export function activeAllocations(
  school: AcademicSchool,
  actor: AssignmentActor,
) {
  if (actor.role === "teacher") {
    if (
      !school.teachers.some(
        (item) => item.id === actor.person && item.status === "Active",
      )
    )
      return [];
    return school.allocations.filter(
      (item) =>
        item.teacher === actor.person &&
        school.sections.some(
          (section) =>
            section.id === item.section &&
            section.status === "Active" &&
            school.years.some(
              (year) => year.id === section.year && year.status === "Active",
            ),
        ),
    );
  }
  const student =
    actor.role === "student"
      ? actor.person
      : actor.role === "parent"
        ? linkedStudents(school, actor.person).find(
            (item) => item.id === actor.child,
          )?.id
        : undefined;
  const enrollment = student ? currentEnrollment(school, student) : undefined;
  return school.allocations.filter(
    (item) => item.section === enrollment?.section,
  );
}

export function assignmentsFor(school: AcademicSchool, actor: AssignmentActor) {
  const ids = new Set(activeAllocations(school, actor).map((item) => item.id));
  return school.assignments.filter(
    (item) =>
      ids.has(item.allocation) && (actor.role === "teacher" || item.published),
  );
}

export function localCalendarDate(date = new Date()) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function replaceSchool(
  state: AcademicState,
  actor: Actor,
  school: AcademicSchool,
): AcademicState {
  return { ...state, schools: { ...state.schools, [actor.school]: school } };
}

export function saveAssignment(
  state: AcademicState,
  actor: AssignmentActor,
  value: Assignment,
) {
  const school = state.schools[actor.school];
  requireRule(
    actor.role === "teacher" &&
      school &&
      activeAllocations(school, actor).some(
        (item) => item.id === value.allocation,
      ),
    "Choose one of your teaching allocations.",
  );
  const existing = school.assignments.find((item) => item.id === value.id);
  requireRule(
    !existing ||
      assignmentsFor(school, actor).some((item) => item.id === existing.id),
    "This assignment belongs to another teacher.",
  );
  requireRule(
    value.title.trim() && value.instructions.trim(),
    "Enter a title and instructions.",
  );
  requireRule(validDate(value.due), "Enter a valid deadline.");
  requireRule(
    Number.isInteger(value.maximum) && value.maximum > 0,
    "Enter a positive whole number for maximum marks.",
  );
  requireRule(
    !school.submissions.some((item) => item.assignment === value.id) ||
      (existing?.allocation === value.allocation &&
        existing.maximum === value.maximum &&
        value.published),
    "Keep the class, maximum marks and publication status once students have started work.",
  );
  const assignment = {
    ...value,
    title: value.title.trim(),
    instructions: value.instructions.trim(),
  };
  const assignments = existing
    ? school.assignments.map((item) =>
        item.id === value.id ? assignment : item,
      )
    : [...school.assignments, assignment];
  return replaceSchool(state, actor, { ...school, assignments });
}

export function submitAssignment(
  state: AcademicState,
  actor: AssignmentActor,
  assignmentId: string,
  text: string,
  final: boolean,
  today = localCalendarDate(),
) {
  const school = state.schools[actor.school];
  requireRule(
    actor.role === "student" && school,
    "Only the enrolled student can submit work.",
  );
  const assignment = assignmentsFor(school, actor).find(
    (item) => item.id === assignmentId,
  );
  requireRule(assignment, "This assignment is unavailable for your section.");
  const existing = school.submissions.find(
    (item) => item.assignment === assignmentId && item.student === actor.person,
  );
  requireRule(
    !existing ||
      existing.status === "Draft" ||
      existing.status === "Revision required",
    "This submission has already been sent for review.",
  );
  requireRule(
    assignment.due >= today || existing?.status === "Revision required",
    "The submission deadline has passed.",
  );
  requireRule(text.trim(), "Enter a response first.");
  const submission: Submission = {
    assignment: assignmentId,
    student: actor.person,
    text: text.trim(),
    status: final ? "Submitted" : (existing?.status ?? "Draft"),
    feedback: final ? undefined : existing?.feedback,
  };
  return replaceSchool(state, actor, {
    ...school,
    submissions: [
      ...school.submissions.filter((item) => item !== existing),
      submission,
    ],
  });
}

export function reviewAssignment(
  state: AcademicState,
  actor: AssignmentActor,
  assignmentId: string,
  student: string,
  feedback: string,
  marks?: number,
) {
  const school = state.schools[actor.school];
  requireRule(
    actor.role === "teacher" && school,
    "Only the assigned teacher can review submissions.",
  );
  const assignment = assignmentsFor(school, actor).find(
    (item) => item.id === assignmentId,
  );
  requireRule(assignment, "This assignment is unavailable for review.");
  const submission = school.submissions.find(
    (item) => item.assignment === assignmentId && item.student === student,
  );
  requireRule(
    submission?.status === "Submitted",
    "Choose a submission awaiting review.",
  );
  requireRule(feedback.trim(), "Enter feedback for the student.");
  requireRule(
    marks === undefined ||
      (Number.isFinite(marks) && marks >= 0 && marks <= assignment.maximum),
    "Marks must be between zero and the maximum.",
  );
  return replaceSchool(state, actor, {
    ...school,
    submissions: school.submissions.map((item) =>
      item === submission
        ? {
            ...submission,
            status: marks === undefined ? "Revision required" : "Graded",
            feedback: feedback.trim(),
            marks,
          }
        : item,
    ),
  });
}

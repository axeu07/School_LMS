import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(
        new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href,
        context,
      );
    }
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    ) {
      return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});

const { academicSeed, decodeAcademicState } =
  await import("../src/services/academic-seed.ts");
const {
  linkedStudents,
  removeAcademicRecord,
  saveAcademicRecord,
  visibleAnnouncements,
} = await import("../src/services/academic-model.ts");
const { assignmentsFor, reviewAssignment, saveAssignment, submitAssignment } =
  await import("../src/services/assignment-model.ts");
const { getAcademicDashboard } =
  await import("../src/services/academic-dashboard.ts");
const admin = { school: "westfield", role: "school-admin" };
const teacher = { ...admin, role: "teacher", person: "westfield-teacher" };
const student = { ...admin, role: "student", person: "westfield-student-0" };
const parent = {
  ...admin,
  role: "parent",
  person: "westfield-parent",
  child: student.person,
};
const school = academicSeed.schools.westfield;
const assignment = school.assignments[0];

test("academic years validate dates and names and activate exclusively", () => {
  const year = {
    id: "next",
    name: "2027–2028",
    start: "2027-06-01",
    end: "2028-05-31",
    status: "Active",
  };
  assert.throws(
    () =>
      saveAcademicRecord(academicSeed, admin, "years", {
        ...year,
        start: "2027-02-30",
      }),
    /valid dates/,
  );
  assert.throws(
    () =>
      saveAcademicRecord(academicSeed, admin, "years", {
        ...year,
        name: school.years[0].name,
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      saveAcademicRecord(academicSeed, admin, "years", {
        ...school.years[1],
        status: "Active",
      }),
    /Restore/,
  );
  const result = saveAcademicRecord(academicSeed, admin, "years", year);
  assert.deepEqual(
    result.schools.westfield.years.filter((item) => item.status === "Active"),
    [year],
  );
  assert.equal(result.schools.harborview, academicSeed.schools.harborview);
});

test("enrollments reject duplicates and foreign sections and allow another year", () => {
  const enrollment = { ...school.enrollments[0], id: "new-enrollment" };
  assert.throws(
    () => saveAcademicRecord(academicSeed, admin, "enrollments", enrollment),
    /already has an enrollment/,
  );
  assert.throws(
    () =>
      saveAcademicRecord(academicSeed, admin, "enrollments", {
        ...enrollment,
        section: "cedar-class-0",
      }),
    /this school/,
  );
  let next = saveAcademicRecord(academicSeed, admin, "years", {
    id: "next",
    name: "Next year",
    start: "2027-06-01",
    end: "2028-05-31",
    status: "Draft",
  });
  next = saveAcademicRecord(next, admin, "sections", {
    ...school.sections[0],
    id: "next-section",
    year: "next",
  });
  next = saveAcademicRecord(next, admin, "enrollments", {
    ...enrollment,
    section: "next-section",
  });
  assert.equal(
    next.schools.westfield.enrollments.filter(
      (item) => item.student === student.person,
    ).length,
    2,
  );
});

test("timetable rejects overlapping sessions for the same teacher and permits adjacent sessions", () => {
  const session = {
    ...school.sessions[0],
    id: "extra",
    allocation: school.allocations[1].id,
  };
  assert.throws(
    () => saveAcademicRecord(academicSeed, admin, "sessions", session),
    /overlapping/,
  );
  const next = saveAcademicRecord(academicSeed, admin, "sessions", {
    ...session,
    start: "09:45",
    end: "10:30",
  });
  assert.equal(
    next.schools.westfield.sessions.length,
    school.sessions.length + 1,
  );
});

test("published announcements reach allowed roles and the targeted section", () => {
  const notice = {
    id: "notice",
    name: "Extra tutorial",
    message: "Bring notes.",
    section: school.sections[0].id,
    audience: "All",
    status: "Draft",
  };
  let next = saveAcademicRecord(academicSeed, admin, "announcements", notice);
  assert.equal(
    visibleAnnouncements(
      next.schools.westfield,
      "teacher",
      teacher.person,
    ).some((item) => item.id === notice.id),
    false,
  );
  next = saveAcademicRecord(next, admin, "announcements", {
    ...notice,
    status: "Published",
  });
  for (const actor of [teacher, student, parent]) {
    const data = getAcademicDashboard(
      actor.role,
      actor.school,
      next.schools.westfield,
      actor.child ?? "",
    );
    assert.ok(data.notifications.some((item) => item.title === notice.name));
  }
  const otherChild = getAcademicDashboard(
    "parent",
    "westfield",
    next.schools.westfield,
    "westfield-student-1",
  );
  assert.ok(
    !otherChild.notifications.some((item) => item.title === notice.name),
  );
  assert.ok(
    !getAcademicDashboard(
      "student",
      "cedar",
      next.schools.cedar,
      "",
    ).notifications.some((item) => item.title === notice.name),
  );
  assert.throws(
    () => removeAcademicRecord(next, student, "announcements", notice.id),
    /administrator/,
  );
});

test("guardian links constrain child access", () => {
  assert.equal(linkedStudents(school, parent.person).length, 2);
  assert.equal(
    assignmentsFor(school, { ...parent, child: "cedar-student-0" }).length,
    0,
  );
  const next = removeAcademicRecord(
    academicSeed,
    admin,
    "links",
    student.person + "-link",
  );
  const view = getAcademicDashboard(
    "parent",
    "westfield",
    next.schools.westfield,
    student.person,
  );
  assert.equal(view.child.id, "westfield-student-1");
  assert.equal(assignmentsFor(next.schools.westfield, parent).length, 0);
});

test("assignment publication, draft, submission, revision and grading share records", () => {
  const draft = { ...assignment, id: "assignment-test", published: false };
  let next = saveAssignment(academicSeed, teacher, draft);
  assert.ok(
    !assignmentsFor(next.schools.westfield, student).some(
      (item) => item.id === draft.id,
    ),
  );
  next = saveAssignment(next, teacher, { ...draft, published: true });
  const today = "2026-11-23";
  assert.throws(
    () =>
      submitAssignment(
        next,
        { ...student, person: "westfield-student-1" },
        draft.id,
        "Text",
        true,
        today,
      ),
    /section/,
  );
  assert.throws(
    () => submitAssignment(next, student, draft.id, "Text", true, "2028-01-01"),
    /deadline/,
  );
  next = submitAssignment(
    next,
    student,
    draft.id,
    "Initial response",
    false,
    today,
  );
  assert.equal(next.schools.westfield.submissions[0].status, "Draft");
  next = submitAssignment(
    next,
    student,
    draft.id,
    "Final response",
    true,
    today,
  );
  assert.equal(
    getAcademicDashboard(
      "teacher",
      "westfield",
      next.schools.westfield,
      "",
    ).stats.find((item) => item.label === "To review").value,
    "1",
  );
  assert.throws(
    () =>
      reviewAssignment(next, teacher, draft.id, student.person, "Feedback", 21),
    /maximum/,
  );
  next = reviewAssignment(
    next,
    teacher,
    draft.id,
    student.person,
    "Add an example.",
  );
  next = submitAssignment(
    next,
    student,
    draft.id,
    "Revised response with example.",
    true,
    "2028-01-01",
  );
  next = reviewAssignment(
    next,
    teacher,
    draft.id,
    student.person,
    "Good example.",
    19,
  );
  for (const actor of [student, parent]) {
    const view = getAcademicDashboard(
      actor.role,
      actor.school,
      next.schools.westfield,
      actor.child ?? "",
    );
    assert.deepEqual(
      view.panels.find((panel) => panel.id === "assignment-results").rows,
      [{ title: assignment.title, detail: "Good example.", meta: "19/20" }],
    );
  }
});

test("versioned records round trip and malformed payloads restore seed data", () => {
  assert.deepEqual(
    decodeAcademicState(JSON.stringify(academicSeed)),
    academicSeed,
  );
  for (const raw of [
    null,
    "{",
    '{"version":0}',
    '{"version":1,"schools":{}}',
  ]) {
    assert.equal(decodeAcademicState(raw), academicSeed);
  }
});

test("attendance edits update the school, student and linked parent without duplicating sessions", async () => {
  const { attendanceFor, attendancePercentage, saveAttendance } =
    await import("../src/services/attendance-model.ts");
  const section = school.sections[0].id;
  const date = "2026-11-20";
  const marks = { [student.person]: "Absent" };
  assert.throws(
    () =>
      saveAttendance(
        academicSeed,
        teacher,
        section,
        date,
        { unknown: "Present" },
        date,
      ),
    /roster/,
  );
  assert.throws(
    () =>
      saveAttendance(academicSeed, teacher, "cedar-class-0", date, marks, date),
    /assigned/,
  );
  const state = saveAttendance(
    academicSeed,
    teacher,
    section,
    date,
    marks,
    date,
  );
  assert.equal(
    state.schools.westfield.attendance.length,
    school.attendance.length,
  );
  // 11 of 13 school-wide marks present (two absences in the junior classes).
  assert.equal(
    attendancePercentage(attendanceFor(state.schools.westfield, admin)),
    85,
  );
  for (const actor of [student, parent]) {
    assert.equal(
      attendancePercentage(attendanceFor(state.schools.westfield, actor)),
      80,
    );
    const dashboard = getAcademicDashboard(
      actor.role,
      actor.school,
      state.schools.westfield,
      actor.child ?? "",
    );
    assert.equal(
      dashboard.stats.find((item) => item.label === "Attendance").value,
      "80%",
    );
  }
});

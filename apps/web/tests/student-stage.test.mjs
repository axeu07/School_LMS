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

const { stageForGrade, studentStage } =
  await import("../src/services/student-stage.ts");
const { academicSeed, decodeAcademicState } =
  await import("../src/services/academic-seed.ts");
const { getAcademicDashboard } =
  await import("../src/services/academic-dashboard.ts");
const auth = await import("../src/services/auth-model.ts");

test("students up to Class 8 are junior; Class 9 and above are senior", () => {
  assert.equal(stageForGrade("Grade 8"), "junior");
  assert.equal(stageForGrade("Grade 7"), "junior");
  assert.equal(stageForGrade("Foundation"), "junior");
  assert.equal(stageForGrade(undefined), "junior");
  assert.equal(stageForGrade("Year 9"), "senior");
  assert.equal(stageForGrade("Grade 10"), "senior");
  assert.equal(stageForGrade("Class 12"), "senior");
});

test("the Class 10 demo student has a senior workspace with real records", () => {
  const school = academicSeed.schools.westfield;
  assert.equal(studentStage(school, "westfield-student-0"), "junior");
  assert.equal(studentStage(school, "westfield-student-senior"), "senior");

  const junior = getAcademicDashboard("student", "westfield", school, "");
  assert.equal(junior.person.name, "Avery Chen");
  const senior = getAcademicDashboard(
    "student",
    "westfield",
    school,
    "westfield-student-senior",
  );
  assert.equal(senior.person.name, "Aarav Sharma");
  // Timetable, homework and attendance come from the Class 10 section.
  assert.ok(senior.stats.some((stat) => Number(stat.value) >= 3));
  const sessions = school.sessions.filter((item) =>
    item.allocation.startsWith("westfield-class-senior"),
  );
  assert.equal(sessions.length, 3);
  // The Grade 8 teacher's own timetable is unchanged.
  assert.ok(
    school.allocations
      .filter((item) => item.section === "westfield-class-senior")
      .every((item) => item.teacher === "westfield-teacher-senior"),
  );
});

test("the Class 10 student can sign in with their own student number", () => {
  const accounts = auth.accountsFor(academicSeed, "westfield");
  const senior = accounts.find(
    (item) => item.key === "westfield:student-senior",
  );
  assert.equal(senior.name, "Aarav Sharma");
  assert.equal(senior.studentNumber, "ST-3");
  assert.equal(
    auth.findAccount(accounts, "st-3")?.person,
    "westfield-student-senior",
  );
});

test("records saved before the Class 10 section existed gain it once", () => {
  const strip = (school) => ({
    ...school,
    sections: school.sections.filter((row) => !row.id.includes("senior")),
    teachers: school.teachers.filter((row) => !row.id.includes("senior")),
    allocations: school.allocations.filter((row) => !row.id.includes("senior")),
    students: school.students.filter((row) => !row.id.includes("senior")),
    enrollments: school.enrollments.filter((row) => !row.id.includes("senior")),
    sessions: school.sessions.filter((row) => !row.id.includes("senior")),
    assignments: school.assignments.filter((row) => !row.id.includes("senior")),
    attendance: school.attendance.filter(
      (row) => !row.section.includes("senior"),
    ),
  });
  const old = {
    version: 1,
    schools: Object.fromEntries(
      Object.entries(academicSeed.schools).map(([id, school]) => [
        id,
        strip(school),
      ]),
    ),
  };
  // A saved edit elsewhere survives the upgrade.
  old.schools.westfield.subjects = old.schools.westfield.subjects.map(
    (row, index) => (index ? row : { ...row, name: "Maths (edited)" }),
  );
  const upgraded = decodeAcademicState(JSON.stringify(old));
  const westfield = upgraded.schools.westfield;
  assert.equal(westfield.subjects[0].name, "Maths (edited)");
  assert.equal(studentStage(westfield, "westfield-student-senior"), "senior");
  for (const key of [
    "sections",
    "teachers",
    "allocations",
    "students",
    "enrollments",
    "sessions",
    "assignments",
    "attendance",
  ])
    assert.equal(
      westfield[key].length,
      academicSeed.schools.westfield[key].length,
      key,
    );
  // Already-upgraded records are returned unchanged.
  const again = decodeAcademicState(JSON.stringify(upgraded));
  assert.deepEqual(again, upgraded);
});

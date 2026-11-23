import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const source = (path) =>
  readFile(new URL("../src/" + path, import.meta.url), "utf8");

const { navigation, navItems, findNavItem, roleHref } =
  await import("../src/features/demo/navigation.ts");
const { academicSeed } = await import("../src/services/academic-seed.ts");
const {
  answerDoubt,
  decodeDoubtState,
  doubtSeed,
  doubtsFor,
  postDoubt,
  toggleDoubtVote,
} = await import("../src/services/doubt-model.ts");
const { sectionSummary, studentSummary } =
  await import("../src/services/insights.ts");
const { reviewAssignment, submitAssignment } =
  await import("../src/services/assignment-model.ts");

const roles = ["super-admin", "school-admin", "teacher", "student", "parent"];
const expected = {
  "super-admin": [
    "Dashboard",
    "Schools",
    "Subscriptions",
    "Platform Analytics",
    "White-Label Branding",
    "Platform Settings",
  ],
  "school-admin": [
    "Dashboard",
    "Academic Years",
    "Classes & Sections",
    "Subjects",
    "Teacher Allocations",
    "Timetable",
    "Teachers",
    "Students",
    "Parents & Guardians",
    "Announcements",
    "Assignments",
    "Attendance",
    "Performance Analytics",
    "Marketing Insights",
    "School Settings",
  ],
  teacher: [
    "Dashboard",
    "Weekly Timetable",
    "Assigned Classes",
    "Courses & Lessons",
    "Assignments",
    "Attendance",
    "Assessments & Quizzes",
    "Anonymous Doubt Board",
    "AI Teaching Tools",
    "Class Performance",
    "Announcements",
  ],
  student: [
    "Dashboard",
    "My Courses",
    "My Timetable",
    "Assignments",
    "Quizzes & Assessments",
    "Attendance",
    "Anonymous Doubt Board",
    "AI Homework Helper",
    "AI Notes & Revision",
    "Daily Revision Quiz",
    "My Progress",
    "Announcements",
  ],
  parent: [
    "Dashboard",
    "My Children",
    "Attendance",
    "Homework & Assignments",
    "Academic Performance",
    "Assessments",
    "Announcements",
    "Messages",
  ],
};

test("each role has its required menu, with Dashboard first", () => {
  for (const role of roles) {
    const items = navItems(role);
    assert.equal(items[0].slug, "", role + " starts with Dashboard");
    assert.deepEqual(
      [...items.map((item) => item.title)].sort(),
      [...expected[role]].sort(),
      role,
    );
    assert.equal(
      new Set(items.map((item) => item.slug)).size,
      items.length,
      role + " slugs are unique",
    );
  }
});

test("every menu item is a dedicated route with a rendered page", async () => {
  const pages = await source("features/demo/section-page.tsx");
  for (const role of roles) {
    for (const item of navItems(role)) {
      const href = roleHref(role, item.slug);
      assert.match(href, /^\/demo\/[a-z-]+(\/[a-z-]+)?$/);
      assert.ok(!href.includes("#"), href + " is not an anchor");
      if (item.slug)
        assert.ok(
          pages.includes('"' + role + "/" + item.slug + '"'),
          role + "/" + item.slug + " has a page",
        );
    }
  }
  assert.equal(findNavItem("teacher", "missing"), undefined);
});

test("sidebar and dashboard links use routes, not scrolling anchors", async () => {
  for (const file of [
    "features/demo/dashboard-navigation.tsx",
    "features/demo/overview.tsx",
    "features/demo/dashboard-widgets.tsx",
  ]) {
    const text = await source(file);
    assert.doesNotMatch(text, /href=\{?["'`]#/, file);
    assert.doesNotMatch(text, /"#" \+/, file);
  }
  const sidebar = await source("features/demo/dashboard-navigation.tsx");
  assert.match(sidebar, /usePathname/);
  assert.match(sidebar, /aria-current/);
});

test("preview pages are labelled and never marked live", async () => {
  const previews = await source("features/demo/pages/preview-pages.tsx");
  const count = (previews.match(/<PreviewNotice/g) ?? []).length;
  assert.ok(count >= 11, "every preview page shows a preview notice");
  for (const role of roles)
    for (const group of navigation[role])
      for (const item of group.items)
        assert.ok(["live", "preview"].includes(item.status));
});

const school = academicSeed.schools.westfield;
const student = {
  school: "westfield",
  role: "student",
  person: "westfield-student-0",
};
const teacher = { ...student, role: "teacher", person: "westfield-teacher" };
const allocation = "westfield-class-0-allocation";

test("doubts stay anonymous to everyone, rank by upvotes and accept teacher replies", () => {
  let state = postDoubt(
    doubtSeed,
    school,
    student,
    allocation,
    "How do I convert a recurring decimal to a fraction?",
    "new-doubt",
    "2026-11-23T10:00:00.000Z",
  );
  assert.throws(
    () => postDoubt(state, school, student, allocation, "short", "x"),
    /at least 10/,
  );
  assert.throws(
    () =>
      postDoubt(state, school, teacher, allocation, "A teacher question", "x"),
    /Only students/,
  );
  assert.throws(
    () => toggleDoubtVote(state, school, student, "new-doubt"),
    /own doubt/,
  );
  state = toggleDoubtVote(state, school, student, "westfield-doubt-1");
  const ranked = doubtsFor(state, school, teacher);
  assert.equal(ranked[0].id, "westfield-doubt-0");
  assert.equal(
    ranked.find((item) => item.id === "westfield-doubt-1").voteCount,
    2,
  );
  // No viewer — teacher or student — receives author or voter identities.
  for (const viewer of [teacher, student]) {
    for (const item of doubtsFor(state, school, viewer)) {
      assert.equal("author" in item, false);
      assert.equal("votes" in item, false);
    }
  }
  const mine = doubtsFor(state, school, student);
  assert.equal(mine.find((item) => item.id === "new-doubt").own, true);
  assert.equal(mine.find((item) => item.id === "westfield-doubt-1").voted, true);
  assert.equal(ranked.some((item) => item.own), false);
  assert.throws(
    () => answerDoubt(state, school, teacher, "new-doubt", "", false),
    /reply/,
  );
  state = answerDoubt(state, school, teacher, "new-doubt", "", true);
  assert.equal(
    state.schools.westfield.find((item) => item.id === "new-doubt").status,
    "Answered in class",
  );
  assert.equal(state.schools.harborview, doubtSeed.schools.harborview);
  assert.deepEqual(decodeDoubtState(JSON.stringify(state)), state);
  assert.equal(decodeDoubtState("{bad"), doubtSeed);
  assert.equal(decodeDoubtState(JSON.stringify({ version: 2 })), doubtSeed);
});

test("doubts are limited to the actor's sections", () => {
  const otherStudent = { ...student, person: "westfield-student-1" };
  assert.equal(doubtsFor(doubtSeed, school, otherStudent).length, 0);
  assert.equal(doubtsFor(doubtSeed, school, student).length, 2);
  assert.equal(
    doubtsFor(doubtSeed, school, { ...student, role: "parent" }).length,
    0,
  );
});

test("insights reflect graded work and attendance from shared records", () => {
  const assignment = school.assignments[0].id;
  let state = submitAssignment(
    academicSeed,
    student,
    assignment,
    "My answer",
    true,
    "2026-11-23",
  );
  state = reviewAssignment(
    state,
    teacher,
    assignment,
    student.person,
    "Good",
    15,
  );
  const records = state.schools.westfield;
  const learner = studentSummary(records, student.person);
  assert.equal(learner.average, 75);
  assert.equal(learner.completion, 100);
  assert.equal(learner.graded[0].score, 75);
  assert.equal(learner.attendance, 100);
  const section = sectionSummary(records, "westfield-class-0");
  assert.equal(section.average, 75);
  assert.equal(section.submissionRate, 100);
  assert.equal(section.roster.length, 1);
  assert.equal(
    sectionSummary(academicSeed.schools.westfield, "westfield-class-0").average,
    undefined,
  );
});

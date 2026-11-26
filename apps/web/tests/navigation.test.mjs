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

const { fullNavigation, navigation, navItems, findNavItem, roleHref } =
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
/** The complete K-12 menus, kept in code while preschool mode hides parts. */
const fullExpected = {
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
    "Bulk Import",
    "Announcements",
    "Assignments",
    "Attendance",
    "Exams & Results",
    "Leave Management",
    "School Calendar",
    "Communication",
    "Fees & Payments",
    "Performance Analytics",
    "Marketing Insights",
    "Leads & Deals",
    "Recruitment",
    "School Settings",
    "School Branding",
    "Data & Privacy",
    "Audit Log",
  ],
  teacher: [
    "Dashboard",
    "Anonymous Doubt Board",
    "Weekly Timetable",
    "Assigned Classes",
    "Courses & Lessons",
    "Assignments",
    "Attendance",
    "Leave Requests",
    "School Calendar",
    "Parent Messages",
    "Assessments & Quizzes",
    "AI Teaching Tools",
    "Class Performance",
    "Announcements",
  ],
  student: [
    "Dashboard",
    "Anonymous Doubt Board",
    "My Courses",
    "My Timetable",
    "Assignments",
    "Quizzes & Assessments",
    "Attendance",
    "Leave Requests",
    "School Calendar",
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
    "Child Leave Requests",
    "School Calendar",
    "Homework & Assignments",
    "Academic Performance",
    "Assessments",
    "Fees",
    "Consent & Privacy",
    "Announcements",
    "Messages",
  ],
};

/** What each role sees in preschool mode (Oak and Ivy). */
const expected = {
  "super-admin": fullExpected["super-admin"],
  "school-admin": [
    "Dashboard",
    "Daily Diaries",
    "Pickup & Gate Log",
    "Health Records",
    "Transport & Fleet",
    "Emergency Broadcasts",
    "Academic Years",
    "Classes & Groups",
    "Learning Areas",
    "Teacher Allocations",
    "Timetable",
    "Teachers",
    "Children",
    "Parents & Guardians",
    "Bulk Import",
    "Announcements",
    "Attendance",
    "Leave Management",
    "School Calendar",
    "Communication",
    "Fees & Payments",
    "School Settings",
    "School Branding",
    "Data & Privacy",
    "Audit Log",
  ],
  teacher: [
    "Dashboard",
    "Daily Diary",
    "Check-in & Pickup",
    "Health & Incidents",
    "Vehicle Tracking",
    "Emergency & Alerts",
    "Weekly Timetable",
    "My Classes",
    "School Calendar",
    "Attendance",
    "Leave Requests",
    "Announcements",
    "Parent Messages",
  ],
  student: [],
  parent: [
    "Dashboard",
    "Daily Diary",
    "Pickup & Drop",
    "Health & Medical",
    "Bus Tracking",
    "Emergency Contacts",
    "My Children",
    "Attendance",
    "Child Leave Requests",
    "Fees",
    "School Calendar",
    "Consent & Privacy",
    "Announcements",
    "Messages",
  ],
};

test("the full K-12 menus are kept, and every page still has a route", async () => {
  const pages = await source("features/demo/section-page.tsx");
  for (const role of roles) {
    const titles = fullNavigation[role].flatMap((group) =>
      group.items.map((item) => item.title),
    );
    assert.deepEqual([...titles].sort(), [...fullExpected[role]].sort(), role);
    for (const group of fullNavigation[role])
      for (const item of group.items)
        if (item.slug)
          assert.ok(
            pages.includes('"' + role + "/" + item.slug + '"'),
            role + "/" + item.slug + " still has a page",
          );
  }
});

test("preschool mode hides the student workspace and K-12 pages", () => {
  assert.equal(navItems("student").length, 0);
  const teacher = navItems("teacher").map((item) => item.slug);
  for (const slug of ["doubt-board", "assessments", "ai-tools", "courses"])
    assert.ok(!teacher.includes(slug), slug);
  const parent = navItems("parent").map((item) => item.slug);
  for (const slug of ["homework", "performance", "assessments"])
    assert.ok(!parent.includes(slug), slug);
  for (const role of ["school-admin", "teacher", "parent"])
    for (const slug of [
      "daily-diary",
      "pickup",
      "health",
      "transport",
      "emergency",
    ])
      assert.ok(findNavItem(role, slug), role + "/" + slug);
});

test("each role has its required menu, with Dashboard first", () => {
  for (const role of roles) {
    const items = navItems(role);
    if (!items.length) continue; // hidden role
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

test("preview pages are labelled, and live pages never render previews", async () => {
  const previews = await source("features/demo/pages/preview-pages.tsx");
  const exported = previews.match(/export function \w+Preview\(/g) ?? [];
  const notices = previews.match(/<PreviewNotice/g) ?? [];
  assert.equal(notices.length, exported.length, "each preview shows a notice");
  // Map every "role/slug" case to the component it renders.
  const pages = await source("features/demo/section-page.tsx");
  const rendered = new Map();
  let pending = [];
  for (const line of pages.split("\n")) {
    const caseMatch = line.match(/case "([a-z-]+\/[a-z-]+)":/);
    if (caseMatch) pending.push(caseMatch[1]);
    const returnMatch = line.match(/return <(\w+)/);
    if (returnMatch && pending.length) {
      for (const key of pending) rendered.set(key, returnMatch[1]);
      pending = [];
    }
  }
  for (const role of roles)
    for (const group of navigation[role])
      for (const item of group.items) {
        assert.ok(["live", "preview"].includes(item.status));
        if (!item.slug) continue;
        const component = rendered.get(role + "/" + item.slug);
        assert.equal(
          component.endsWith("Preview"),
          item.status === "preview",
          role + "/" + item.slug + " renders " + component,
        );
      }
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
  assert.equal(
    mine.find((item) => item.id === "westfield-doubt-1").voted,
    true,
  );
  assert.equal(
    ranked.some((item) => item.own),
    false,
  );
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

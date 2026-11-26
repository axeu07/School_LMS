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

const { academicSeed } = await import("../src/services/academic-seed.ts");
const { saveAttendance } = await import("../src/services/attendance-model.ts");
const { leaveSeed, decodeLeave } =
  await import("../src/services/leave-seed.ts");
const leave = await import("../src/services/leave-model.ts");
const {
  createLeaveRequest,
  editLeaveDraft,
  submitLeaveDraft,
  decideLeave,
  cancelLeave,
  planSubstitute,
  affectedSessions,
  substituteOptions,
  leaveRequestsFor,
  teacherInbox,
  pendingApprovals,
  studentLeaveHistory,
  teacherLeaveHistory,
  notificationsFor,
  absenceAlertsFor,
  markNotificationsRead,
  syncAbsenceAlerts,
  studentAttendanceWithLeave,
  leaveAnalytics,
  leavesOverlap,
  leaveLength,
  leaveStatuses,
} = leave;

const W = "westfield";
const school = academicSeed.schools.westfield;
const s0 = "westfield-student-0"; // Avery Chen · UKG · Sunflower
const s1 = "westfield-student-1"; // Robin Chen · LKG · Daisy
const student = { school: W, role: "student", person: s0 };
const student1 = { school: W, role: "student", person: s1 };
const parent = {
  school: W,
  role: "parent",
  person: "westfield-parent",
  child: s0,
};
const parentOf1 = { ...parent, child: s1 };
const guardian = {
  school: W,
  role: "parent",
  person: "westfield-guardian",
  child: s0,
};
const teacher = { school: W, role: "teacher", person: "westfield-teacher" };
const teacher2 = { school: W, role: "teacher", person: "westfield-teacher-2" };
const admin = { school: W, role: "school-admin", person: "westfield-admin" };
const now = "2026-11-23T10:00";

const input = (subject, extra = {}) => ({
  subject,
  type: "Sick Leave",
  start: "2026-12-10",
  end: "2026-12-10",
  duration: "Full day",
  reason: "Fever and a sore throat; resting at home.",
  ...extra,
});
const records = (state) => state.schools.westfield;
const find = (state, id) =>
  records(state).requests.find((item) => item.id === id);

test("seed data demonstrates every status in every school and obeys the rules", () => {
  for (const [id, data] of Object.entries(leaveSeed.schools)) {
    const statuses = new Set(data.requests.map((item) => item.status));
    for (const status of leaveStatuses)
      assert.ok(statuses.has(status), id + " has " + status);
    assert.ok(data.requests.some((item) => item.submittedRole === "parent"));
    assert.ok(data.requests.some((item) => item.submittedRole === "student"));
    assert.ok(data.requests.some((item) => item.kind === "teacher"));
    assert.ok(data.requests.every((item) => item.school === id));
    assert.ok(data.notifications.every((item) => item.school === id));
    // The seeded absence (student-1, 19 Nov) produced exactly one parent alert.
    const alerts = data.notifications.filter((item) => item.kind === "absence");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].recipientRole, "parent");
  }
  assert.equal(
    decodeLeave(JSON.stringify(leaveSeed)).schools.westfield.requests.length,
    leaveSeed.schools.westfield.requests.length,
  );
  for (const raw of [null, "{", '{"version":2}', '{"version":1,"schools":{}}'])
    assert.equal(decodeLeave(raw), leaveSeed);
});

test("Scenario 1: student submits → class teacher approves → student and parents are notified", () => {
  let state = createLeaveRequest(leaveSeed, school, student, input(s0), {
    id: "s1",
    now,
  });
  const request = find(state, "s1");
  assert.equal(request.status, "Pending Teacher");
  assert.equal(request.reviewer, "westfield-teacher");
  assert.equal(request.section, "westfield-class-0");
  assert.equal(request.submittedRole, "student");
  assert.ok(
    pendingApprovals(records(state), school, teacher).some(
      (item) => item.id === "s1",
    ),
  );
  assert.ok(
    notificationsFor(records(state), school, teacher).some(
      (item) => item.request === "s1",
    ),
  );
  // Another school's teacher never sees it.
  const cedarTeacher = {
    school: "cedar",
    role: "teacher",
    person: "cedar-teacher",
  };
  assert.ok(
    !pendingApprovals(
      state.schools.cedar,
      academicSeed.schools.cedar,
      cedarTeacher,
    ).some((item) => item.id === "s1"),
  );

  state = decideLeave(
    state,
    school,
    teacher,
    "s1",
    "approve",
    "Get well soon.",
    now,
  );
  assert.equal(find(state, "s1").status, "Approved");
  assert.deepEqual(
    find(state, "s1").history.map((item) => item.action),
    ["Submitted", "Approved"],
  );
  for (const actor of [student, parent, guardian]) {
    const notices = notificationsFor(records(state), school, actor);
    assert.ok(
      notices.some(
        (item) => item.request === "s1" && item.title === "Leave approved",
      ),
      actor.person,
    );
  }
  assert.ok(
    studentLeaveHistory(records(state), s0).some((item) => item.id === "s1"),
  );
});

test("Scenario 2: parent submits → teacher forwards → admin approves → parent and student see the outcome", () => {
  let state = createLeaveRequest(
    leaveSeed,
    school,
    parentOf1,
    input(s1, {
      start: "2026-12-15",
      end: "2026-12-16",
      type: "Family Emergency",
    }),
    { id: "p1", now },
  );
  const inbox = teacherInbox(records(state), school, teacher);
  assert.equal(inbox.find((item) => item.id === "p1").submittedRole, "parent");
  state = decideLeave(
    state,
    school,
    teacher,
    "p1",
    "forward",
    "Long absence near tests.",
    now,
  );
  assert.equal(find(state, "p1").status, "Pending Admin");
  assert.equal(find(state, "p1").reviewer, "westfield-admin");
  assert.throws(
    () => decideLeave(state, school, teacher, "p1", "approve", "", now),
    /not awaiting your review/,
  );
  assert.ok(
    pendingApprovals(records(state), school, admin).some(
      (item) => item.id === "p1",
    ),
  );
  assert.throws(
    () => decideLeave(state, school, admin, "p1", "forward", "", now),
    /forward/,
  );
  state = decideLeave(
    state,
    school,
    admin,
    "p1",
    "approve",
    "Approved with a make-up test.",
    now,
  );
  assert.equal(find(state, "p1").status, "Approved");
  assert.deepEqual(
    find(state, "p1").history.map((item) => item.action),
    ["Submitted", "Forwarded", "Approved"],
  );
  assert.equal(
    leaveRequestsFor(records(state), school, parentOf1).find(
      (item) => item.id === "p1",
    ).status,
    "Approved",
  );
  assert.equal(
    leaveRequestsFor(records(state), school, student1).find(
      (item) => item.id === "p1",
    ).status,
    "Approved",
  );
  assert.ok(
    notificationsFor(records(state), school, student1).some(
      (item) => item.request === "p1" && item.title === "Leave approved",
    ),
  );
});

test("Scenario 3: teacher leave goes to the admin, shows affected sessions and supports cover planning", () => {
  let state = createLeaveRequest(
    leaveSeed,
    school,
    teacher,
    input("westfield-teacher", {
      start: "2026-12-07",
      end: "2026-12-07",
      substitute: "westfield-teacher-2",
    }),
    { id: "t1", now },
  );
  const request = find(state, "t1");
  assert.equal(request.status, "Pending Admin");
  assert.equal(request.reviewer, "westfield-admin");
  assert.throws(
    () => decideLeave(state, school, teacher, "t1", "approve", "", now),
    /own leave/,
  );
  assert.throws(
    () => decideLeave(state, school, teacher2, "t1", "approve", "", now),
    /School Admin/,
  );
  const sessions = affectedSessions(
    school,
    "westfield-teacher",
    "2026-12-07",
    "2026-12-07",
  );
  assert.equal(sessions.length, 2, "both Monday sessions are affected");
  assert.equal(
    affectedSessions(school, "westfield-teacher", "2026-12-08", "2026-12-08")
      .length,
    0,
  );
  assert.equal(
    affectedSessions(
      school,
      "westfield-teacher",
      "2026-12-07",
      "2026-12-07",
      "Second half",
    ).length,
    0,
  );
  assert.ok(
    substituteOptions(
      school,
      records(state),
      "westfield-teacher",
      sessions[0],
    ).some((item) => item.id === "westfield-teacher-2"),
  );
  state = decideLeave(
    state,
    school,
    admin,
    "t1",
    "approve",
    "Cover arranged.",
    now,
  );
  state = planSubstitute(
    state,
    school,
    admin,
    "t1",
    sessions[0].key,
    "westfield-teacher-2",
    now,
  );
  assert.equal(find(state, "t1").plan[sessions[0].key], "westfield-teacher-2");
  assert.throws(
    () =>
      planSubstitute(
        state,
        school,
        admin,
        "t1",
        sessions[0].key,
        "westfield-teacher",
        now,
      ),
    /free/,
  );
  assert.throws(
    () =>
      planSubstitute(
        state,
        school,
        teacher,
        "t1",
        sessions[0].key,
        "westfield-teacher-2",
        now,
      ),
    /School Admin/,
  );
  assert.equal(
    leaveRequestsFor(records(state), school, teacher).find(
      (item) => item.id === "t1",
    ).status,
    "Approved",
  );
  assert.ok(
    teacherLeaveHistory(records(state), "westfield-teacher").some(
      (item) => item.id === "t1",
    ),
  );
  assert.ok(
    notificationsFor(records(state), school, teacher).some(
      (item) => item.request === "t1" && item.title === "Leave approved",
    ),
  );
  // Teacher leave never appears in another teacher's or a student's view.
  assert.ok(
    !leaveRequestsFor(records(state), school, teacher2).some(
      (item) => item.id === "t1",
    ),
  );
  assert.ok(
    !leaveRequestsFor(records(state), school, student).some(
      (item) => item.id === "t1",
    ),
  );
});

test("Scenario 4: an absence alerts only linked parents, once, and the parent can apply for that date", () => {
  const date = "2026-11-20";
  const academic = saveAttendance(
    academicSeed,
    teacher,
    "westfield-class-0",
    date,
    { [s0]: "Absent" },
    date,
  );
  let state = syncAbsenceAlerts(leaveSeed, academic.schools.westfield, W, now, {
    section: "westfield-class-0",
    date,
  });
  const updated = academic.schools.westfield;
  for (const actor of [parent, guardian]) {
    const alerts = absenceAlertsFor(records(state), updated, actor, s0).filter(
      (item) => item.date === date,
    );
    assert.equal(alerts.length, 1, actor.person);
    assert.equal(alerts[0].state, "Active");
    assert.equal(
      alerts[0].message,
      "Attendance Alert: Avery was marked absent in UKG-Sunflower on 20 November 2026. View attendance or submit a leave request.",
    );
  }
  assert.ok(
    !notificationsFor(records(state), updated, student).some(
      (item) => item.kind === "absence",
    ),
  );
  // Re-saving the same record never duplicates the alert.
  const count = records(state).notifications.length;
  state = syncAbsenceAlerts(state, updated, W, now, {
    section: "westfield-class-0",
    date,
  });
  state = syncAbsenceAlerts(state, updated, W, now);
  assert.equal(records(state).notifications.length, count);
  // Other schools are untouched.
  assert.deepEqual(state.schools.cedar, leaveSeed.schools.cedar);
  // The parent applies for leave for the absent date.
  state = createLeaveRequest(
    state,
    updated,
    parent,
    input(s0, { start: date, end: date }),
    { id: "a1", now },
  );
  assert.equal(find(state, "a1").status, "Pending Teacher");
  state = markNotificationsRead(state, updated, parent, "all");
  assert.ok(
    notificationsFor(records(state), updated, parent).every(
      (item) => item.read,
    ),
  );
  assert.ok(
    notificationsFor(records(state), updated, guardian).some(
      (item) => !item.read,
    ),
    "read state is per recipient",
  );
});

test("Scenario 5: correcting Absent → Present resolves the alert; back to Absent reactivates it", () => {
  const date = "2026-11-20";
  const section = "westfield-class-0";
  const absent = saveAttendance(
    academicSeed,
    teacher,
    section,
    date,
    { [s0]: "Absent" },
    date,
  );
  let state = syncAbsenceAlerts(leaveSeed, absent.schools.westfield, W, now, {
    section,
    date,
  });
  const present = saveAttendance(
    absent,
    teacher,
    section,
    date,
    { [s0]: "Present" },
    date,
  );
  state = syncAbsenceAlerts(
    state,
    present.schools.westfield,
    W,
    "2026-11-23T11:00",
    { section, date },
  );
  let alert = absenceAlertsFor(records(state), school, parent, s0).find(
    (item) => item.date === date,
  );
  assert.equal(alert.state, "Resolved");
  assert.match(alert.message, /corrected to Present/);
  const again = saveAttendance(
    present,
    teacher,
    section,
    date,
    { [s0]: "Absent" },
    date,
  );
  state = syncAbsenceAlerts(
    state,
    again.schools.westfield,
    W,
    "2026-11-23T12:00",
    { section, date },
  );
  const alerts = absenceAlertsFor(records(state), school, parent, s0).filter(
    (item) => item.date === date,
  );
  assert.equal(alerts.length, 1);
  alert = alerts[0];
  assert.equal(alert.state, "Active");
  assert.equal(alert.read, false);
});

test("Scenario 6: schools and children stay isolated", () => {
  let state = createLeaveRequest(leaveSeed, school, student, input(s0), {
    id: "iso",
    now,
  });
  const harborParent = {
    school: "harborview",
    role: "parent",
    person: "harborview-parent",
    child: "harborview-student-0",
  };
  const harbor = academicSeed.schools.harborview;
  assert.ok(
    !leaveRequestsFor(state.schools.harborview, harbor, harborParent).some(
      (item) => item.id === "iso",
    ),
  );
  // Same parent, different child → different records.
  const forS0 = leaveRequestsFor(records(state), school, parent).map(
    (item) => item.subject,
  );
  const forS1 = leaveRequestsFor(records(state), school, parentOf1).map(
    (item) => item.subject,
  );
  assert.ok(forS0.every((id) => id === s0) && forS0.length);
  assert.ok(forS1.every((id) => id === s1) && forS1.length);
  // A teacher from another school cannot act on a Westfield request.
  const cedarTeacher = {
    school: "cedar",
    role: "teacher",
    person: "cedar-teacher",
  };
  assert.throws(
    () =>
      decideLeave(
        state,
        academicSeed.schools.cedar,
        cedarTeacher,
        "iso",
        "approve",
        "",
        now,
      ),
    /unavailable/,
  );
  // Parents only request leave for linked children in this school.
  assert.throws(
    () =>
      createLeaveRequest(state, school, parent, input("cedar-student-0"), {
        id: "x",
        now,
      }),
    /linked children/,
  );
  assert.throws(
    () =>
      createLeaveRequest(state, school, student, input(s1), { id: "x", now }),
    /own enrollment/,
  );
  assert.throws(
    () =>
      createLeaveRequest(state, school, teacher, input("westfield-teacher-2"), {
        id: "x",
        now,
      }),
    /own leave/,
  );
  assert.throws(
    () => createLeaveRequest(state, school, admin, input(s0), { id: "x", now }),
    /Only students, parents and teachers/,
  );
});

test("overlapping active leave is blocked across student and parent submitters", () => {
  let state = createLeaveRequest(
    leaveSeed,
    school,
    student,
    input(s0, { start: "2026-12-10", end: "2026-12-11" }),
    { id: "o1", now },
  );
  assert.throws(
    () =>
      createLeaveRequest(
        state,
        school,
        parent,
        input(s0, { start: "2026-12-11", end: "2026-12-12" }),
        { id: "o2", now },
      ),
    /overlap/,
  );
  // Drafts can overlap, but cannot be submitted while the clash is active.
  state = createLeaveRequest(
    state,
    school,
    parent,
    input(s0, { start: "2026-12-11", end: "2026-12-11" }),
    { id: "o3", now, draft: true },
  );
  assert.equal(find(state, "o3").status, "Draft");
  assert.throws(
    () => submitLeaveDraft(state, school, parent, "o3", now),
    /overlap/,
  );
  // After the student cancels, the parent's draft can go through.
  state = cancelLeave(state, school, student, "o1", "", now);
  state = submitLeaveDraft(state, school, parent, "o3", now);
  assert.equal(find(state, "o3").status, "Pending Teacher");
  // Opposite halves of one day do not overlap.
  const morning = {
    start: "2026-12-20",
    end: "2026-12-20",
    duration: "First half",
  };
  assert.equal(
    leavesOverlap(morning, { ...morning, duration: "Second half" }),
    false,
  );
  assert.equal(
    leavesOverlap(morning, { ...morning, duration: "Full day" }),
    true,
  );
  // Rejected or cancelled requests do not block new ones.
  state = decideLeave(
    state,
    school,
    teacher,
    "o3",
    "reject",
    "Unit test that day.",
    now,
  );
  state = createLeaveRequest(
    state,
    school,
    student,
    input(s0, { start: "2026-12-11", end: "2026-12-11" }),
    { id: "o4", now },
  );
  assert.equal(find(state, "o4").status, "Pending Teacher");
});

test("form validation rejects bad dates, half days, short reasons and real-looking attachments", () => {
  const bad = (extra, pattern) =>
    assert.throws(
      () =>
        createLeaveRequest(leaveSeed, school, student, input(s0, extra), {
          id: "v",
          now,
        }),
      pattern,
    );
  bad({ type: "Holiday" }, /leave type/);
  bad({ start: "2026-12-12", end: "2026-12-10" }, /end date cannot be before/);
  bad({ start: "2026-02-30", end: "2026-02-30" }, /valid calendar dates/);
  bad(
    { start: "2026-12-10", end: "2026-12-11", duration: "First half" },
    /half-day/,
  );
  bad({ reason: "sick" }, /at least 10/);
  bad({ start: "2027-07-01", end: "2027-07-02" }, /active academic year/);
  bad({ start: "2026-12-01", end: "2027-01-15" }, /at most 30 days/);
  bad(
    { attachment: { name: "scan.exe", kind: "EXE", size: "1 MB" } },
    /PDF, JPG or PNG/,
  );
  const state = createLeaveRequest(
    leaveSeed,
    school,
    student,
    input(s0, { duration: "First half" }),
    { id: "half", now },
  );
  assert.equal(leaveLength(find(state, "half")), 0.5);
});

test("decisions enforce reviewer permissions, reasons and status", () => {
  let state = createLeaveRequest(leaveSeed, school, student, input(s0), {
    id: "d1",
    now,
  });
  assert.throws(
    () => decideLeave(state, school, parent, "d1", "approve", "", now),
    /Only class teachers/,
  );
  assert.throws(
    () => decideLeave(state, school, admin, "d1", "approve", "", now),
    /School Admin decision/,
  );
  assert.throws(
    () => decideLeave(state, school, teacher2, "d1", "approve", "", now),
    /not awaiting your review/,
  );
  assert.throws(
    () => decideLeave(state, school, teacher, "d1", "reject", " ", now),
    /reason/,
  );
  state = decideLeave(
    state,
    school,
    teacher,
    "d1",
    "reject",
    "Practical exam that day.",
    now,
  );
  assert.equal(find(state, "d1").remarks, "Practical exam that day.");
  assert.throws(
    () => decideLeave(state, school, teacher, "d1", "approve", "", now),
    /not awaiting/,
  );
});

test("only the submitter cancels, and only while pending; drafts can be edited", () => {
  let state = createLeaveRequest(leaveSeed, school, parent, input(s0), {
    id: "c1",
    now,
  });
  assert.throws(
    () => cancelLeave(state, school, student, "c1", "", now),
    /submitted this request/,
  );
  assert.throws(
    () => cancelLeave(state, school, guardian, "c1", "", now),
    /submitted this request/,
  );
  state = cancelLeave(state, school, parent, "c1", "Recovered early.", now);
  assert.equal(find(state, "c1").status, "Cancelled");
  assert.ok(
    notificationsFor(records(state), school, teacher).some(
      (item) =>
        item.request === "c1" && item.title === "Leave request cancelled",
    ),
  );
  assert.throws(
    () => cancelLeave(state, school, parent, "c1", "", now),
    /pending/,
  );
  state = createLeaveRequest(state, school, student, input(s0), {
    id: "c2",
    now,
  });
  state = decideLeave(state, school, teacher, "c2", "approve", "", now);
  assert.throws(
    () => cancelLeave(state, school, student, "c2", "", now),
    /pending/,
  );
  // Draft edit and submit.
  state = createLeaveRequest(
    state,
    school,
    student,
    input(s0, { start: "2026-12-21", end: "2026-12-21" }),
    { id: "c3", now, draft: true },
  );
  assert.ok(
    !teacherInbox(records(state), school, teacher).some(
      (item) => item.id === "c3",
    ),
    "teachers never see drafts",
  );
  assert.throws(
    () => editLeaveDraft(state, school, parent, "c3", input(s0), now),
    /created this request/,
  );
  state = editLeaveDraft(
    state,
    school,
    student,
    "c3",
    input(s0, { start: "2026-12-22", end: "2026-12-22" }),
    now,
  );
  assert.equal(find(state, "c3").start, "2026-12-22");
  state = submitLeaveDraft(state, school, student, "c3", now);
  assert.deepEqual(
    find(state, "c3").history.map((item) => item.action),
    ["Saved draft", "Edited draft", "Submitted"],
  );
});

test("approved leave is shown as Approved Leave without changing marks or physical attendance", () => {
  const date = "2026-11-20";
  const academic = saveAttendance(
    academicSeed,
    teacher,
    "westfield-class-0",
    date,
    { [s0]: "Absent" },
    date,
  );
  const updated = academic.schools.westfield;
  const before = studentAttendanceWithLeave(
    updated,
    leaveSeed.schools.westfield,
    s0,
  );
  assert.equal(before.absent, 1);
  assert.equal(before.excused, 0);
  let state = createLeaveRequest(
    leaveSeed,
    updated,
    parent,
    input(s0, { start: date, end: date }),
    { id: "al", now },
  );
  const pending = studentAttendanceWithLeave(updated, records(state), s0);
  assert.equal(pending.excused, 0, "pending leave is not treated as approved");
  state = decideLeave(state, updated, teacher, "al", "approve", "", now);
  const after = studentAttendanceWithLeave(updated, records(state), s0);
  assert.equal(after.excused, 1);
  assert.equal(after.absent, 0);
  assert.equal(
    after.rows.find((row) => row.date === date).mark,
    "Absent",
    "the stored mark stays auditable",
  );
  assert.equal(
    after.rows.find((row) => row.date === date).effective,
    "Approved Leave",
  );
  assert.equal(
    after.physical,
    before.physical,
    "approved leave is not counted as presence",
  );
  assert.equal(after.approvedLeaveDays, before.approvedLeaveDays + 1);
  // Leave alone never fabricates attendance records.
  assert.equal(updated.attendance.length, school.attendance.length);
  // A rejected request leaves attendance unchanged.
  state = createLeaveRequest(
    state,
    updated,
    student,
    input(s0, { start: "2026-11-19", end: "2026-11-19" }),
    { id: "rj", now },
  );
  state = decideLeave(state, updated, teacher, "rj", "reject", "No.", now);
  assert.equal(
    studentAttendanceWithLeave(updated, records(state), s0).excused,
    1,
  );
});

test("analytics are calculated from demo records", () => {
  const stats = leaveAnalytics(
    leaveSeed.schools.westfield,
    school,
    "2026-11-23",
  );
  assert.equal(stats.pendingTeacher, 1);
  assert.equal(stats.escalated, 1);
  assert.equal(stats.pendingStudent, 2);
  assert.equal(stats.rejected, 2);
  assert.ok(stats.approvedThisMonth >= 3);
  assert.equal(stats.trend.labels.length, 6);
  assert.equal(stats.trend.labels.at(-1), "Nov");
  assert.equal(stats.classes.length, 3);
  const cover = stats.teachers.find(
    (item) => item.teacher.id === "westfield-teacher-2",
  );
  assert.equal(cover.status, "On leave today");
});

test("leave pages are wired into routes, navigation, reset and attendance", async () => {
  const source = (path) =>
    readFile(new URL("../src/" + path, import.meta.url), "utf8");
  const pages = await source("features/demo/section-page.tsx");
  for (const key of [
    "school-admin/leave-management",
    "teacher/leave-requests",
    "student/leave-requests",
    "parent/leave-requests",
  ])
    assert.ok(pages.includes('"' + key + '"'), key);
  assert.match(
    await source("features/demo/pages/admin-pages.tsx"),
    /resetLeaveState\(\)/,
  );
  const attendance = await source("features/demo/attendance-workspace.tsx");
  assert.match(attendance, /recordAttendance\(/);
  assert.doesNotMatch(attendance, /saveAttendance\(state/);
});

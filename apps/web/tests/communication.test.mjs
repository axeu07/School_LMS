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

const { academicSeed } = await import("../src/services/academic-seed.ts");
const { learningSeed } = await import("../src/services/learning-model.ts");
const { communicationSeed, decodeCommunicationState, readNotifications } =
  await import("../src/services/communication-model.ts");
const cal = await import("../src/services/calendar-model.ts");
const msg = await import("../src/services/messaging-model.ts");
const { notificationsFor, unreadNotificationCount } =
  await import("../src/services/notification-model.ts");

const records = academicSeed.schools.westfield;
const harbor = academicSeed.schools.harborview;
const now = new Date("2026-11-23T10:00:00");
const later = (minutes) => new Date(now.getTime() + minutes * 60_000);

const admin = {
  school: "westfield",
  role: "school-admin",
  person: "westfield-admin",
};
const teacher = {
  school: "westfield",
  role: "teacher",
  person: "westfield-teacher",
};
const otherTeacher = { ...teacher, person: "westfield-teacher-2" };
const student0 = {
  school: "westfield",
  role: "student",
  person: "westfield-student-0",
};
const student1 = { ...student0, person: "westfield-student-1" };
const parent0 = {
  school: "westfield",
  role: "parent",
  person: "westfield-parent",
  child: "westfield-student-0",
};
const parent1 = { ...parent0, child: "westfield-student-1" };
const guardian = { ...parent0, person: "westfield-guardian" };

const keys = (actor, state = communicationSeed) =>
  cal
    .calendarEntries(state, learningSeed, records, actor)
    .map((item) => item.key);
const visible = (actor, id, state = communicationSeed) =>
  keys(actor, state).includes("event:westfield-event-" + id);

const baseInput = {
  id: "new-exam",
  title: "Science practical exam",
  description: "Lab coats required.",
  category: "exam",
  year: "westfield-year",
  startDate: "2026-12-03",
  endDate: "2026-12-03",
  startTime: "09:00",
  endTime: "11:00",
  allDay: false,
  location: "Lab 2",
  meetingUrl: "",
  audience: ["teacher", "student", "parent"],
  sections: [],
};

const mine = (state, actor) =>
  notificationsFor(state.schools[actor.school].notifications, actor);

/* ---------- Calendar ---------- */

test("calendar data is isolated per school", () => {
  const westfield = cal.calendarEntries(
    communicationSeed,
    learningSeed,
    records,
    admin,
  );
  assert.ok(westfield.length > 0);
  assert.ok(
    westfield.every(
      (item) => !item.event || item.event.schoolId === "westfield",
    ),
  );
  const harborAdmin = {
    ...admin,
    school: "harborview",
    person: "harborview-admin",
  };
  const harborKeys = cal
    .calendarEntries(communicationSeed, learningSeed, harbor, harborAdmin)
    .map((item) => item.key);
  assert.ok(harborKeys.every((key) => !key.includes("westfield")));
  // A westfield event checked with a harborview actor is never visible.
  const event = communicationSeed.schools.westfield.events[0];
  assert.equal(
    cal.eventVisible(records, { ...student0, school: "harborview" }, event),
    false,
  );
});

test("event visibility follows role, audience, status and section", () => {
  assert.equal(visible(teacher, "staff-meeting"), true);
  assert.equal(visible(student0, "staff-meeting"), false);
  assert.equal(visible(parent0, "staff-meeting"), false);
  // Drafts and pending suggestions are hidden from students and parents.
  assert.equal(visible(admin, "republic-day"), true);
  assert.equal(visible(student0, "republic-day"), false);
  assert.equal(visible(student0, "reading-circle"), false);
  assert.equal(visible(teacher, "reading-circle"), true, "own suggestion");
  // Cancelled events that had been published remain visible (struck through).
  assert.equal(visible(student0, "sports-meet"), true);
  // Section targeting.
  assert.equal(visible(student0, "unit-test"), true);
  assert.equal(visible(student1, "unit-test"), false);
  assert.equal(visible(student1, "field-trip"), true);
  assert.equal(visible(student0, "field-trip"), false);
  // PTMs are for parents and their teachers, not students.
  assert.equal(visible(parent0, "ptm"), true);
  assert.equal(visible(student0, "ptm"), false);
  assert.equal(visible(otherTeacher, "ptm"), false);
  assert.equal(
    visible(otherTeacher, "unit-test"),
    false,
    "no assigned sections",
  );
  // Super admins don't get school calendars.
  assert.equal(keys({ ...admin, role: "super-admin" }).length, 0);
});

test("parents see only their selected linked child's calendar", () => {
  assert.equal(visible(parent0, "unit-test"), true);
  assert.equal(visible(parent1, "unit-test"), false);
  assert.equal(visible(parent1, "field-trip"), true);
  // A child id that isn't linked to this parent shows nothing private.
  const stranger = {
    ...parent0,
    person: "westfield-guardian",
    child: "westfield-student-1",
  };
  assert.equal(keys(stranger).length, 0);
  // Linked records keep stable keys and never duplicate.
  const list = keys(parent0);
  assert.equal(new Set(list).size, list.length);
  // Preschool mode hides homework, so its deadlines leave the calendar too.
  assert.ok(!list.includes("assignment:westfield-class-0-practice"));
  assert.ok(list.includes("ptm:westfield-booking-0"));
  assert.ok(!keys(parent1).includes("ptm:westfield-booking-0"));
});

test("admins publish drafts, which notifies the audience exactly once", () => {
  let state = cal.saveEvent(communicationSeed, records, admin, baseInput, now);
  const event = state.schools.westfield.events.find(
    (item) => item.id === "new-exam",
  );
  assert.equal(event.status, "Draft");
  assert.equal(cal.eventVisible(records, student0, event), false);
  assert.equal(mine(state, student0).length, 0, "drafts don't notify");

  state = cal.publishEvent(state, records, admin, "new-exam", later(1));
  for (const actor of [teacher, student0, student1, parent0]) {
    assert.ok(keys(actor, state).includes("event:new-exam"), actor.person);
    assert.equal(
      mine(state, actor).filter((item) => item.contextId === "new-exam").length,
      1,
    );
  }
  assert.throws(
    () => cal.publishEvent(state, records, admin, "new-exam", later(2)),
    /Only drafts/,
  );
  // The parent has two children who both see it, but gets one notification.
  assert.equal(
    state.schools.westfield.notifications.filter(
      (item) =>
        item.recipientId === "westfield-parent" &&
        item.contextId === "new-exam",
    ).length,
    1,
  );
  // Other schools are untouched.
  assert.equal(state.schools.harborview, communicationSeed.schools.harborview);
});

test("rescheduling and cancelling notify affected users without repeats", () => {
  let state = cal.saveEvent(
    communicationSeed,
    records,
    admin,
    { ...baseInput, publish: true },
    now,
  );
  state = cal.saveEvent(
    state,
    records,
    admin,
    { ...baseInput, startTime: "10:00", endTime: "12:00" },
    later(1),
  );
  const rescheduled = mine(state, student0).filter((item) =>
    item.title.startsWith("Rescheduled"),
  );
  assert.equal(rescheduled.length, 1);
  // Saving again without a timing change adds nothing.
  const count = state.schools.westfield.notifications.length;
  state = cal.saveEvent(
    state,
    records,
    admin,
    {
      ...baseInput,
      startTime: "10:00",
      endTime: "12:00",
      title: "Science practical",
    },
    later(2),
  );
  assert.equal(state.schools.westfield.notifications.length, count);

  state = cal.cancelEvent(
    state,
    records,
    admin,
    "new-exam",
    "Lab maintenance",
    later(3),
  );
  const event = state.schools.westfield.events.find(
    (item) => item.id === "new-exam",
  );
  assert.equal(event.status, "Cancelled");
  assert.equal(event.cancelReason, "Lab maintenance");
  assert.equal(
    mine(state, parent0).filter((item) => item.title.startsWith("Cancelled"))
      .length,
    1,
  );
  assert.throws(
    () => cal.cancelEvent(state, records, admin, "new-exam", "", later(4)),
    /Only draft or published/,
  );
  assert.throws(
    () => cal.deleteEvent(state, admin, "new-exam"),
    /cancelled, not deleted/,
  );
  assert.throws(
    () => cal.saveEvent(state, records, admin, baseInput, later(5)),
    /can't be edited/,
  );
});

test("holidays apply school-wide and are always all day", () => {
  const state = cal.saveEvent(
    communicationSeed,
    records,
    admin,
    {
      ...baseInput,
      id: "holiday",
      category: "holiday",
      title: "Snow day",
      allDay: false,
      publish: true,
    },
    now,
  );
  const event = state.schools.westfield.events.find(
    (item) => item.id === "holiday",
  );
  assert.equal(event.allDay, true);
  assert.equal(event.startTime, "");
  for (const actor of [teacher, student0, student1, parent0, parent1])
    assert.ok(keys(actor, state).includes("event:holiday"));
});

test("event validation and permissions", () => {
  const save = (actor, change) =>
    cal.saveEvent(
      communicationSeed,
      records,
      actor,
      { ...baseInput, ...change },
      now,
    );
  assert.throws(() => save(admin, { title: "x" }), /title/);
  assert.throws(() => save(admin, { endDate: "2026-12-01" }), /end date/);
  assert.throws(() => save(admin, { endTime: "08:00" }), /end time/);
  assert.throws(
    () => save(admin, { startDate: "2027-07-01", endDate: "2027-07-01" }),
    /academic year/,
  );
  assert.throws(() => save(admin, { audience: [] }), /audience/);
  assert.throws(
    () => save(admin, { meetingUrl: "javascript:alert(1)" }),
    /https/,
  );
  assert.throws(
    () => save(admin, { sections: ["harborview-class-0"] }),
    /sections/,
  );
  assert.throws(
    () => save(admin, { category: "teacher-meeting" }),
    /teachers only/,
  );
  assert.throws(() => save(student0, {}), /Only school administrators/);
  assert.throws(() => save(parent0, {}), /Only school administrators/);
  assert.throws(() => save(teacher, {}), /class activities only/);
});

test("teacher suggestions need admin approval before reaching students", () => {
  const suggestion = {
    ...baseInput,
    id: "quiz-bowl",
    category: "class-activity",
    title: "Quiz bowl",
    sections: ["westfield-class-1"],
  };
  assert.throws(
    () =>
      cal.saveEvent(communicationSeed, records, otherTeacher, suggestion, now),
    /your assigned sections/,
  );
  let state = cal.saveEvent(
    communicationSeed,
    records,
    teacher,
    suggestion,
    now,
  );
  const event = state.schools.westfield.events.find(
    (item) => item.id === "quiz-bowl",
  );
  assert.equal(event.status, "Proposed");
  assert.equal(keys(student1, state).includes("event:quiz-bowl"), false);
  assert.equal(
    mine(state, admin).some((item) => item.contextId === "quiz-bowl"),
    true,
  );

  state = cal.publishEvent(state, records, admin, "quiz-bowl", later(1));
  assert.equal(keys(student1, state).includes("event:quiz-bowl"), true);
  assert.equal(keys(student0, state).includes("event:quiz-bowl"), false);
  assert.ok(
    mine(state, teacher).some((item) =>
      item.title.startsWith("Suggestion approved"),
    ),
  );
  // Published suggestions can no longer be edited or withdrawn by the teacher.
  assert.throws(
    () => cal.saveEvent(state, records, teacher, suggestion, later(2)),
    /awaiting approval/,
  );
  assert.throws(
    () => cal.deleteEvent(state, teacher, "quiz-bowl"),
    /cancelled, not deleted/,
  );

  const declined = cal.declineEvent(
    cal.saveEvent(communicationSeed, records, teacher, suggestion, now),
    admin,
    "quiz-bowl",
    "Clashes with exams",
    later(1),
  );
  assert.equal(
    declined.schools.westfield.events.find((item) => item.id === "quiz-bowl")
      .status,
    "Declined",
  );
  assert.ok(
    mine(declined, teacher).some((item) => item.body === "Clashes with exams"),
  );
});

/* ---------- PTM ---------- */

const ptmId = "westfield-event-ptm";
const slots = communicationSeed.schools.westfield.ptmSlots.filter(
  (item) => item.eventId === ptmId,
);
const slotAt = (time) => slots.find((item) => item.start === time).id;

test("PTM slots are generated per teacher and show availability", () => {
  assert.equal(slots.length, 8);
  assert.deepEqual(
    slots.map((item) => item.start),
    ["15:00", "15:15", "15:30", "15:45", "16:00", "16:15", "16:30", "16:45"],
  );
  const school = communicationSeed.schools.westfield;
  const states = slots.map((slot) => cal.slotState(school, slot, parent1, now));
  assert.equal(states[2], "booked");
  assert.equal(cal.slotState(school, slots[2], parent0, now), "yours");
  assert.equal(states[0], "available");
  // After the session starts, open slots are in the past.
  assert.equal(
    cal.slotState(school, slots[0], parent1, new Date("2026-12-05T16:00:00")),
    "past",
  );
});

test("PTM booking prevents double-booking and invalid bookings", () => {
  const book = (state, actor, slot, id = "b-" + slot) =>
    cal.bookSlot(state, records, actor, slot, now, id);
  // Another family can't take a booked slot.
  assert.throws(
    () => book(communicationSeed, parent1, slotAt("15:30")),
    /just booked/,
  );
  // One appointment per teacher and child: reschedule instead.
  assert.throws(
    () => book(communicationSeed, parent0, slotAt("16:00")),
    /Reschedule/,
  );
  // Only parents of eligible, linked students can book.
  assert.throws(
    () => book(communicationSeed, teacher, slotAt("16:00")),
    /Only parents/,
  );
  assert.throws(
    () =>
      book(
        communicationSeed,
        { ...parent0, child: "harborview-student-0" },
        slotAt("16:00"),
      ),
    /linked children/,
  );
  // Past slots.
  assert.throws(
    () =>
      cal.bookSlot(
        communicationSeed,
        records,
        parent1,
        slotAt("15:00"),
        new Date("2026-12-05T15:10:00"),
        "late",
      ),
    /passed/,
  );
  // Withdrawn slots.
  const blocked = cal.toggleSlotBlocked(
    communicationSeed,
    admin,
    slotAt("16:00"),
  );
  assert.throws(() => book(blocked, parent1, slotAt("16:00")), /withdrawn/);
  assert.throws(
    () => cal.toggleSlotBlocked(communicationSeed, admin, slotAt("15:30")),
    /booked/,
  );
  assert.throws(
    () => cal.toggleSlotBlocked(communicationSeed, teacher, slotAt("16:00")),
    /administrator/,
  );

  // A successful booking notifies parent and teacher.
  const state = book(communicationSeed, parent1, slotAt("16:00"), "b1");
  const booking = state.schools.westfield.ptmBookings.find(
    (item) => item.id === "b1",
  );
  assert.equal(booking.status, "Confirmed");
  assert.equal(booking.studentId, "westfield-student-1");
  assert.ok(
    mine(state, parent1).some((item) => item.title === "PTM booking confirmed"),
  );
  assert.ok(
    mine(state, teacher).some((item) => item.title === "New PTM appointment"),
  );
  assert.ok(keys(teacher, state).includes("ptm:b1"));
  assert.ok(keys(parent1, state).includes("ptm:b1"));
  assert.ok(!keys(parent0, state).includes("ptm:b1"), "scoped to the child");

  // Cancelled sessions can't be booked.
  const cancelled = cal.cancelEvent(
    communicationSeed,
    records,
    admin,
    ptmId,
    "",
    now,
  );
  assert.throws(() => book(cancelled, parent1, slotAt("16:15")), /isn't open/);
  assert.equal(
    cancelled.schools.westfield.ptmBookings[0].status,
    "Cancelled",
    "cancelling the session cancels its appointments",
  );
});

test("parents can't hold overlapping PTM bookings", () => {
  // A second session at the same time with the same teacher.
  let state = cal.saveEvent(
    communicationSeed,
    records,
    admin,
    {
      ...baseInput,
      id: "ptm-2",
      category: "ptm",
      title: "Subject clinic",
      startDate: "2026-12-05",
      endDate: "2026-12-05",
      startTime: "15:00",
      endTime: "17:00",
      audience: ["teacher", "parent"],
      ptm: { teachers: ["westfield-teacher"], duration: 15 },
      publish: true,
    },
    now,
  );
  const clash = state.schools.westfield.ptmSlots.find(
    (item) => item.eventId === "ptm-2" && item.start === "15:30",
  );
  assert.equal(
    cal.slotState(state.schools.westfield, clash, parent1, now),
    "conflict",
  );
  assert.throws(
    () => cal.bookSlot(state, records, parent1, clash.id, now, "clash"),
    /another appointment at this time/,
  );
  state = cal.bookSlot(
    state,
    records,
    parent1,
    clash.id.replace("1530", "1600"),
    now,
    "ok",
  );
  assert.equal(state.schools.westfield.ptmBookings.at(-1).id, "ok");
  // PTM edits that would remove booked slots are refused.
  assert.throws(
    () =>
      cal.saveEvent(
        state,
        records,
        admin,
        {
          ...baseInput,
          id: "ptm-2",
          category: "ptm",
          title: "Subject clinic",
          startDate: "2026-12-06",
          endDate: "2026-12-06",
          startTime: "15:00",
          endTime: "17:00",
          audience: ["teacher", "parent"],
          ptm: { teachers: ["westfield-teacher"], duration: 15 },
        },
        later(1),
      ),
    /Cancel those appointments first/,
  );
});

test("rescheduling frees the old slot; cancelling frees the slot", () => {
  const id = "westfield-booking-0";
  let state = cal.rescheduleBooking(
    communicationSeed,
    records,
    parent0,
    id,
    slotAt("16:30"),
    now,
  );
  const school = state.schools.westfield;
  assert.equal(school.ptmBookings[0].slotId, slotAt("16:30"));
  const old = slots.find((item) => item.start === "15:30");
  assert.equal(cal.slotState(school, old, parent1, now), "available");
  assert.ok(
    mine(state, teacher).some(
      (item) => item.title === "PTM appointment rescheduled",
    ),
  );
  assert.ok(
    mine(state, parent0).some(
      (item) => item.title === "PTM appointment rescheduled",
    ),
  );
  // The freed slot can be booked by another family.
  state = cal.bookSlot(state, records, parent1, old.id, now, "taken");
  assert.equal(state.schools.westfield.ptmBookings.at(-1).slotId, old.id);
  assert.throws(
    () => cal.rescheduleBooking(state, records, parent0, id, old.id, now),
    /just booked/,
  );
  // Only the owning parent (for that child) can change it.
  assert.throws(
    () =>
      cal.rescheduleBooking(state, records, parent1, id, slotAt("16:45"), now),
    /unavailable/,
  );

  state = cal.cancelBooking(state, records, parent0, id, now);
  assert.equal(state.schools.westfield.ptmBookings[0].status, "Cancelled");
  assert.equal(
    cal.slotState(
      state.schools.westfield,
      slots.find((item) => item.start === "16:30"),
      parent1,
      now,
    ),
    "available",
  );
  assert.ok(
    mine(state, teacher).some(
      (item) => item.title === "PTM appointment cancelled",
    ),
  );
  assert.throws(
    () => cal.cancelBooking(state, records, parent0, id, now),
    /Only confirmed/,
  );
});

test("teachers complete meetings and keep notes private", () => {
  const id = "westfield-booking-0";
  assert.throws(
    () =>
      cal.updateMeeting(
        communicationSeed,
        otherTeacher,
        id,
        { notes: "x" },
        now,
      ),
    /meeting's teacher/,
  );
  const state = cal.updateMeeting(
    communicationSeed,
    teacher,
    id,
    { notes: "Discussed reading goals.", complete: true },
    now,
  );
  assert.equal(
    cal.bookingsFor(state, teacher)[0].notes,
    "Discussed reading goals.",
  );
  assert.equal(cal.bookingsFor(state, teacher)[0].status, "Completed");
  assert.equal(cal.bookingsFor(state, parent0)[0].notes, "");
  assert.equal(cal.bookingsFor(state, admin)[0].notes, "");
  assert.equal(cal.bookingsFor(state, student0).length, 0);
  assert.equal(cal.bookingsFor(state, parent1).length, 0);
});

test("upcoming reminders are generated once when the demo opens", () => {
  const opened = new Date("2026-11-25T08:00:00");
  const state = cal.syncReminders(
    communicationSeed,
    records,
    "westfield",
    opened,
  );
  const reminders = mine(state, student0).filter(
    (item) => item.kind === "reminder",
  );
  assert.deepEqual(
    reminders.map((item) => item.contextId),
    ["westfield-event-unit-test"],
  );
  assert.equal(
    mine(state, student1).filter((item) => item.kind === "reminder").length,
    0,
  );
  // Running again is a no-op that returns the same state.
  assert.equal(cal.syncReminders(state, records, "westfield", opened), state);
  // Booked PTM appointments get reminders for parent and teacher.
  const ptmDay = cal.syncReminders(
    communicationSeed,
    records,
    "westfield",
    new Date("2026-12-04T08:00:00"),
  );
  assert.ok(
    mine(ptmDay, parent0).some((item) => item.title === "PTM reminder"),
  );
  assert.ok(
    mine(ptmDay, teacher).some((item) => item.title === "PTM reminder"),
  );
});

test("approved leave is reflected read-only on the right calendars", () => {
  const request = (id, status, subject = "westfield-student-0") => ({
    id,
    school: "westfield",
    kind: "student",
    subject,
    section: "westfield-class-0",
    submittedBy: "westfield-parent",
    submittedRole: "parent",
    reviewer: "westfield-teacher",
    type: "Sick Leave",
    start: "2026-12-14",
    end: "2026-12-15",
    duration: "Full day",
    reason: "Unwell",
    contact: "",
    substitute: "",
    plan: {},
    status,
    remarks: "",
    created: "2026-11-20T10:00",
    updated: "2026-11-20T10:00",
    history: [],
  });
  const leave = {
    requests: [
      request("approved", "Approved"),
      request("pending", "Pending Teacher"),
    ],
    notifications: [],
  };
  const list = (actor) =>
    cal
      .calendarEntries(communicationSeed, learningSeed, records, actor, leave)
      .map((item) => item.key);
  assert.ok(list(parent0).includes("leave:approved"));
  assert.ok(list(student0).includes("leave:approved"));
  assert.ok(list(admin).includes("leave:approved"));
  assert.ok(!list(parent0).includes("leave:pending"));
  assert.ok(!list(parent1).includes("leave:approved"), "other child");
  assert.ok(!list(student1).includes("leave:approved"));
});

/* ---------- Messaging ---------- */

test("parents can message only their child's teachers, and vice versa", () => {
  const contacts = msg.teachersForChild(
    records,
    "westfield",
    "westfield-parent",
    "westfield-student-0",
  );
  assert.deepEqual(
    contacts.map((item) => item.teacherId),
    ["westfield-teacher"],
  );
  assert.deepEqual(
    msg.teachersForChild(
      records,
      "westfield",
      "westfield-parent",
      "harborview-student-0",
    ),
    [],
  );
  assert.equal(
    msg.canConverse(
      records,
      "westfield",
      "westfield-parent",
      "westfield-student-0",
      "westfield-teacher-2",
    ),
    false,
  );
  const parents = msg.parentsForTeacher(
    records,
    "westfield",
    "westfield-teacher",
  );
  assert.deepEqual(
    parents.map((item) => item.parentId + "/" + item.studentId).sort(),
    [
      "westfield-guardian/westfield-student-0",
      "westfield-parent/westfield-student-0",
      "westfield-parent/westfield-student-1",
    ],
  );
  assert.equal(
    msg.parentsForTeacher(records, "westfield", "westfield-teacher-2").length,
    0,
  );

  const input = {
    counterpartId: "westfield-teacher-2",
    topic: "Homework",
    title: "Question",
    body: "Hello",
  };
  const ids = { conversation: "c", message: "m" };
  assert.throws(
    () =>
      msg.startConversation(
        communicationSeed,
        records,
        parent0,
        input,
        now,
        ids,
      ),
    /teach your child/,
  );
  assert.throws(
    () =>
      msg.startConversation(
        communicationSeed,
        records,
        otherTeacher,
        {
          ...input,
          counterpartId: "westfield-parent",
          studentId: "westfield-student-0",
        },
        now,
        ids,
      ),
    /students in your classes/,
  );
  assert.throws(
    () =>
      msg.startConversation(
        communicationSeed,
        records,
        student0,
        { ...input, counterpartId: "westfield-teacher" },
        now,
        ids,
      ),
    /Only parents and teachers/,
  );
  assert.throws(
    () =>
      msg.startConversation(
        communicationSeed,
        records,
        admin,
        { ...input, counterpartId: "westfield-teacher" },
        now,
        ids,
      ),
    /Only parents and teachers/,
  );
});

test("conversations stay private to their participants", () => {
  const ids = (actor) =>
    msg
      .conversationsFor(communicationSeed, records, actor)
      .map((item) => item.id);
  assert.deepEqual(ids(parent0), ["westfield-conversation-homework"]);
  assert.deepEqual(ids(parent1), ["westfield-conversation-attendance"]);
  assert.deepEqual(ids(teacher).sort(), [
    "westfield-conversation-attendance",
    "westfield-conversation-homework",
  ]);
  assert.deepEqual(ids(otherTeacher), []);
  assert.deepEqual(ids(student0), []);
  assert.deepEqual(ids(admin), []);
  assert.deepEqual(ids(guardian), [], "another guardian of the same child");
  assert.deepEqual(ids({ ...parent0, school: "harborview" }), []);
  assert.equal(
    msg.messagesFor(
      communicationSeed,
      records,
      student0,
      "westfield-conversation-homework",
    ).length,
    0,
  );
  assert.equal(
    msg.messagesFor(
      communicationSeed,
      records,
      parent1,
      "westfield-conversation-homework",
    ).length,
    0,
    "switching child hides the other child's conversation",
  );
  assert.throws(
    () =>
      msg.sendMessage(
        communicationSeed,
        records,
        otherTeacher,
        "westfield-conversation-homework",
        "Hi",
        now,
        "x",
      ),
    /unavailable/,
  );
  // Admin statistics carry no message content or subject lines.
  const stats = msg.communicationStats(communicationSeed, records, admin);
  const text = JSON.stringify(stats);
  assert.ok(!text.includes("practice questions"));
  assert.ok(!text.includes("Absence on Thursday"));
  assert.equal(stats.total, 2);
  assert.equal(stats.open, 1);
  assert.equal(stats.awaitingReply, 1);
  assert.equal(stats.averageResponseMinutes, 98, "(50 + 145) / 2 minutes");
  assert.throws(
    () => msg.communicationStats(communicationSeed, records, teacher),
    /administrator/,
  );
});

test("send, notify, read and reply across roles through browser storage", () => {
  // Parent starts a conversation.
  let state = msg.startConversation(
    communicationSeed,
    records,
    parent1,
    {
      counterpartId: "westfield-teacher",
      topic: "Student Progress",
      title: "Reading level",
      body: "<b>Hello</b> & welcome",
    },
    now,
    { conversation: "conv", message: "m1" },
  );
  // Simulate switching roles in the same browser: persist and reload.
  state = decodeCommunicationState(JSON.stringify(state));
  const inbox = msg.conversationsFor(state, records, teacher);
  const conversation = inbox.find((item) => item.id === "conv");
  assert.equal(conversation.unread, 1);
  assert.equal(conversation.sectionId, "westfield-class-1");
  // Text is stored verbatim as plain text (React escapes it when rendering).
  assert.equal(
    msg.messagesFor(state, records, teacher, "conv")[0].messageBody,
    "<b>Hello</b> & welcome",
  );
  const teacherAlerts = () =>
    mine(state, teacher).filter((item) => item.contextId === "conv");
  assert.equal(teacherAlerts().length, 1);
  assert.equal(
    teacherAlerts()[0].href,
    "/demo/teacher/messages?conversation=conv",
  );

  // A second parent message merges into the same unread notification.
  state = msg.sendMessage(
    state,
    records,
    parent1,
    "conv",
    "One more thing",
    later(1),
    "m2",
  );
  assert.equal(teacherAlerts().length, 1);
  assert.equal(teacherAlerts()[0].count, 2);
  assert.equal(msg.unreadMessageCount(state, records, teacher), 3);

  // Teacher reads it.
  state = msg.markConversationRead(state, records, teacher, "conv", later(2));
  assert.equal(
    msg
      .conversationsFor(state, records, teacher)
      .find((item) => item.id === "conv").unread,
    0,
  );
  assert.equal(teacherAlerts()[0].readAt !== null, true);
  assert.equal(
    msg.markConversationRead(state, records, teacher, "conv", later(3)),
    state,
    "no-op when read",
  );

  // Teacher replies; the parent sees the reply and a notification.
  state = msg.sendMessage(
    state,
    records,
    teacher,
    "conv",
    "Thanks, let's talk at the PTM.",
    later(4),
    "m3",
  );
  state = decodeCommunicationState(JSON.stringify(state));
  const parentView = msg
    .conversationsFor(state, records, parent1)
    .find((item) => item.id === "conv");
  assert.equal(parentView.unread, 1);
  assert.equal(
    parentView.lastMessage.messageBody,
    "Thanks, let's talk at the PTM.",
  );
  assert.equal(
    unreadNotificationCount(state.schools.westfield.notifications, parent1),
    1,
  );
  assert.equal(
    mine(state, parent1).find((item) => item.contextId === "conv").href,
    "/demo/parent/messages?conversation=conv",
  );
  // The other child's view doesn't include it.
  assert.equal(
    msg
      .conversationsFor(state, records, parent0)
      .some((item) => item.id === "conv"),
    false,
  );
  // Marking all read clears the count.
  state = readNotifications(state, parent1, "all", later(5));
  assert.equal(
    unreadNotificationCount(state.schools.westfield.notifications, parent1),
    0,
  );
});

test("message validation, limits and resolve/reopen", () => {
  const id = "westfield-conversation-homework";
  assert.throws(
    () =>
      msg.sendMessage(communicationSeed, records, parent0, id, "   ", now, "x"),
    /Write a message/,
  );
  assert.throws(
    () =>
      msg.sendMessage(
        communicationSeed,
        records,
        parent0,
        id,
        "a".repeat(msg.messageLimit + 1),
        now,
        "x",
      ),
    /up to 2,000/,
  );
  assert.equal(msg.cleanMessage("  hi\u0007 there \n"), "hi there");
  assert.throws(
    () =>
      msg.startConversation(
        communicationSeed,
        records,
        parent0,
        {
          counterpartId: "westfield-teacher",
          topic: "Gossip",
          title: "Topic",
          body: "Hello",
        },
        now,
        { conversation: "c", message: "m" },
      ),
    /topic/,
  );
  let state = msg.setConversationStatus(
    communicationSeed,
    records,
    teacher,
    id,
    "Resolved",
    now,
  );
  assert.throws(
    () => msg.sendMessage(state, records, parent0, id, "Hello?", now, "x"),
    /Reopen/,
  );
  state = msg.setConversationStatus(
    state,
    records,
    parent0,
    id,
    "Open",
    later(1),
  );
  state = msg.sendMessage(
    state,
    records,
    parent0,
    id,
    "Hello again",
    later(2),
    "x",
  );
  assert.equal(
    msg.messagesFor(state, records, teacher, id).at(-1).messageBody,
    "Hello again",
  );
  assert.throws(
    () =>
      msg.setConversationStatus(state, records, student0, id, "Resolved", now),
    /Only parents/,
  );
});

/* ---------- Storage ---------- */

test("browser storage recovers from missing, corrupt or outdated data", () => {
  assert.equal(decodeCommunicationState(null), communicationSeed);
  assert.equal(decodeCommunicationState("{not json"), communicationSeed);
  assert.equal(
    decodeCommunicationState(JSON.stringify({ version: 2, schools: {} })),
    communicationSeed,
  );
  const { cedar: _cedar, ...partial } = communicationSeed.schools;
  void _cedar;
  assert.equal(
    decodeCommunicationState(JSON.stringify({ version: 1, schools: partial })),
    communicationSeed,
  );
  const broken = structuredClone(communicationSeed);
  broken.schools.westfield.messages[0].readAt = 5;
  assert.equal(
    decodeCommunicationState(JSON.stringify(broken)),
    communicationSeed,
  );
  const badTopic = structuredClone(communicationSeed);
  badTopic.schools.westfield.conversations[0].topic = "Other";
  assert.equal(
    decodeCommunicationState(JSON.stringify(badTopic)),
    communicationSeed,
  );
  // Valid data round-trips unchanged.
  assert.deepEqual(
    decodeCommunicationState(JSON.stringify(communicationSeed)),
    communicationSeed,
  );
});

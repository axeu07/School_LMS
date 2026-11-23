import { academicRecords } from "@/mocks/academics";
import type { DemoRole, SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
} from "./academic-model";
import { activeAllocations, type AssignmentActor } from "./assignment-model";
import type {
  CommunicationSchool,
  CommunicationState,
} from "./communication-model";
import { localDateTime, testsFor, type LearningState } from "./learning-model";
import { leaveRequestsFor, type LeaveSchool } from "./leave-model";
import { pushNotification, type NotificationInput } from "./notification-model";
import { examsFor } from "./results-model";

/* ---------- Types ---------- */

export const eventCategories = [
  "holiday",
  "exam",
  "ptm",
  "school-event",
  "deadline",
  "teacher-meeting",
  "class-activity",
] as const;
export type EventCategory = (typeof eventCategories)[number];

export const categoryLabels: Record<EventCategory, string> = {
  holiday: "School Holiday",
  exam: "Examination",
  ptm: "Parent–Teacher Meeting",
  "school-event": "School Event",
  deadline: "Academic Deadline",
  "teacher-meeting": "Teacher Meeting",
  "class-activity": "Class Activity",
};

/** Calendar entries can also show approved leave from the Leave module. */
export type EntryCategory = EventCategory | "leave";
export const entryCategories: readonly EntryCategory[] = [
  ...eventCategories,
  "leave",
];
export const entryLabels: Record<EntryCategory, string> = {
  ...categoryLabels,
  leave: "Approved Leave",
};

export const audiences = ["teacher", "student", "parent"] as const;
export type Audience = (typeof audiences)[number];

export const defaultAudience: Record<EventCategory, Audience[]> = {
  holiday: ["teacher", "student", "parent"],
  exam: ["teacher", "student", "parent"],
  ptm: ["teacher", "parent"],
  "school-event": ["teacher", "student", "parent"],
  deadline: ["teacher", "student", "parent"],
  "teacher-meeting": ["teacher"],
  "class-activity": ["teacher", "student", "parent"],
};

/**
 * Draft      — admin working copy, visible to admins only.
 * Proposed   — a teacher's class-activity suggestion awaiting approval.
 * Published  — visible to its audience.
 * Cancelled  — kept on calendars (struck through) once it had been published.
 * Declined   — a suggestion the admin did not approve.
 */
export type EventStatus =
  "Draft" | "Proposed" | "Published" | "Cancelled" | "Declined";

/** PTM session settings: one slot per `duration` minutes for each teacher. */
export type PtmConfig = { teachers: string[]; duration: number };

/** Dates are "YYYY-MM-DD"; times are "HH:mm" and blank for all-day events. */
export type SchoolEvent = {
  id: string;
  schoolId: SchoolId;
  year: string;
  title: string;
  description: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  meetingUrl: string;
  audience: Audience[];
  /** Empty means the whole school. */
  sections: string[];
  organizerId: string;
  organizerRole: DemoRole;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  cancelledAt: string;
  cancelReason: string;
  ptm?: PtmConfig;
};

export type PtmSlot = {
  id: string;
  eventId: string;
  teacherId: string;
  date: string;
  start: string;
  end: string;
  blocked: boolean;
};

export type BookingStatus = "Confirmed" | "Cancelled" | "Completed";
export type PtmBooking = {
  id: string;
  eventId: string;
  slotId: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  /** Private to the meeting's teacher. */
  notes: string;
};

export type EventInput = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  year: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  meetingUrl: string;
  audience: Audience[];
  sections: string[];
  /** Admin only: publish now instead of saving a draft. */
  publish?: boolean;
  ptm?: PtmConfig;
};

/* ---------- Date helpers ---------- */

export function addDays(date: string, days: number) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string) {
  return (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
}

export function startOfWeek(date: string) {
  return addDays(date, -weekdayIndex(date));
}

/** Whole weeks (Monday first) covering the month that contains `date`. */
export function monthGrid(date: string) {
  const first = date.slice(0, 8) + "01";
  const start = startOfWeek(first);
  const nextMonth = addDays(first, 32).slice(0, 8) + "01";
  const days: string[] = [];
  for (
    let day = start;
    day < nextMonth || weekdayIndex(day) !== 0;
    day = addDays(day, 1)
  )
    days.push(day);
  return days;
}

export function shiftMonth(date: string, months: number) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  const value = new Date(Date.UTC(year, month, 1));
  return value.toISOString().slice(0, 10);
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (total: number) =>
  String(Math.floor(total / 60)).padStart(2, "0") +
  ":" +
  String(total % 60).padStart(2, "0");

/* ---------- Visibility ---------- */

function schoolOf(state: CommunicationState, school: SchoolId) {
  const value = state.schools[school];
  requireRule(value, "Select a valid school.");
  return value;
}

function replaceSchool(
  state: CommunicationState,
  school: SchoolId,
  value: CommunicationSchool,
): CommunicationState {
  return { ...state, schools: { ...state.schools, [school]: value } };
}

/** The student whose calendar a student or parent actor sees. */
export function viewerStudent(records: AcademicSchool, actor: AssignmentActor) {
  if (actor.role === "student")
    return records.students.some((item) => item.id === actor.person)
      ? actor.person
      : undefined;
  if (actor.role === "parent")
    return linkedStudents(records, actor.person).find(
      (item) => item.id === actor.child,
    )?.id;
  return undefined;
}

export function teacherSectionIds(
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  return new Set(
    activeAllocations(records, { ...actor, role: "teacher" }).map(
      (item) => item.section,
    ),
  );
}

/** True once an event has been shown to its audience. */
const announced = (event: SchoolEvent) =>
  event.status === "Published" ||
  (event.status === "Cancelled" && !!event.publishedAt);

export function eventVisible(
  records: AcademicSchool,
  actor: AssignmentActor,
  event: SchoolEvent,
) {
  if (event.schoolId !== actor.school) return false;
  if (actor.role === "school-admin") return true;
  if (actor.role === "super-admin") return false;
  if (actor.role === "teacher") {
    if (event.organizerRole === "teacher" && event.organizerId === actor.person)
      return true;
    if (!announced(event) || !event.audience.includes("teacher")) return false;
    if (event.category === "ptm")
      return !!event.ptm?.teachers.includes(actor.person);
    const sections = teacherSectionIds(records, actor);
    return (
      !event.sections.length || event.sections.some((id) => sections.has(id))
    );
  }
  const student = viewerStudent(records, actor);
  if (!student || !announced(event)) return false;
  if (!event.audience.includes(actor.role)) return false;
  const section = currentEnrollment(records, student)?.section;
  return (
    !event.sections.length || (!!section && event.sections.includes(section))
  );
}

export function eventsFor(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  return (state.schools[actor.school]?.events ?? []).filter((event) =>
    eventVisible(records, actor, event),
  );
}

export type Recipient = { person: string; role: DemoRole; child?: string };

export function adminId(school: SchoolId) {
  return academicRecords.find((item) => item.schoolId === school)!.admin.id;
}

/** Everyone (teachers, students, guardians) who can see a published event. */
export function eventRecipients(
  records: AcademicSchool,
  school: SchoolId,
  event: SchoolEvent,
): Recipient[] {
  const out: Recipient[] = [];
  const check = (actor: AssignmentActor) =>
    eventVisible(records, actor, { ...event, status: "Published" });
  for (const teacher of records.teachers)
    if (
      teacher.status === "Active" &&
      check({ role: "teacher", school, person: teacher.id })
    )
      out.push({ person: teacher.id, role: "teacher" });
  for (const student of records.students)
    if (check({ role: "student", school, person: student.id }))
      out.push({ person: student.id, role: "student" });
  for (const guardian of records.guardians) {
    const child = linkedStudents(records, guardian.id).find((item) =>
      check({ role: "parent", school, person: guardian.id, child: item.id }),
    );
    if (child)
      out.push({ person: guardian.id, role: "parent", child: child.id });
  }
  return out;
}

/* ---------- Notifications ---------- */

const calendarHref = (role: DemoRole, event: string) =>
  "/demo/" + role + "/calendar?event=" + encodeURIComponent(event);
const ptmHref = (role: DemoRole) => "/demo/" + role + "/calendar?tab=ptm";

export function describeWhen(
  event: Pick<
    SchoolEvent,
    "startDate" | "endDate" | "startTime" | "endTime" | "allDay"
  >,
) {
  const days =
    event.startDate === event.endDate
      ? event.startDate
      : event.startDate + " to " + event.endDate;
  return event.allDay
    ? days + " (all day)"
    : days + ", " + event.startTime + "–" + event.endTime;
}

function notifyAudience(
  school: CommunicationSchool,
  records: AcademicSchool,
  event: SchoolEvent,
  transition: string,
  title: string,
  body: string,
  createdAt: string,
  except?: string,
  kind: NotificationInput["kind"] = "event",
) {
  let notifications = school.notifications;
  for (const recipient of eventRecipients(records, event.schoolId, event)) {
    if (recipient.person === except) continue;
    notifications = pushNotification(
      notifications,
      {
        schoolId: event.schoolId,
        recipientId: recipient.person,
        recipientRole: recipient.role,
        kind,
        title,
        body,
        href: calendarHref(recipient.role, event.id),
        contextId: event.id,
        dedupeKey: "event:" + event.id + ":" + transition,
      },
      createdAt,
    );
  }
  return notifications;
}

/* ---------- Event changes ---------- */

const sameTiming = (a: SchoolEvent, b: SchoolEvent) =>
  a.startDate === b.startDate &&
  a.endDate === b.endDate &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  a.allDay === b.allDay;

export function generateSlots(
  event: Pick<
    SchoolEvent,
    "id" | "startDate" | "startTime" | "endTime" | "ptm"
  >,
  previous: PtmSlot[] = [],
): PtmSlot[] {
  if (!event.ptm) return [];
  const slots: PtmSlot[] = [];
  const end = minutes(event.endTime);
  for (const teacher of event.ptm.teachers)
    for (
      let start = minutes(event.startTime);
      start + event.ptm.duration <= end;
      start += event.ptm.duration
    ) {
      const id = event.id + "~" + teacher + "~" + clock(start).replace(":", "");
      slots.push({
        id,
        eventId: event.id,
        teacherId: teacher,
        date: event.startDate,
        start: clock(start),
        end: clock(start + event.ptm.duration),
        blocked: previous.find((item) => item.id === id)?.blocked ?? false,
      });
    }
  return slots;
}

const activeBooking = (booking: PtmBooking) =>
  booking.status === "Confirmed" || booking.status === "Completed";

export function saveEvent(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: EventInput,
  now: Date,
): CommunicationState {
  const school = schoolOf(state, actor.school);
  const existing = school.events.find((item) => item.id === input.id);
  const stamp = now.toISOString();
  const isAdmin = actor.role === "school-admin";
  if (isAdmin) {
    requireRule(
      !existing ||
        (existing.status !== "Cancelled" && existing.status !== "Declined"),
      "Cancelled or declined events can't be edited.",
    );
  } else if (actor.role === "teacher") {
    requireRule(
      input.category === "class-activity",
      "Teachers can suggest class activities only.",
    );
    requireRule(
      !existing ||
        (existing.organizerId === actor.person &&
          existing.status === "Proposed"),
      "You can only edit your own suggestions that are awaiting approval.",
    );
  } else {
    throw new Error("Only school administrators can create school events.");
  }

  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  const meetingUrl = input.meetingUrl.trim();
  requireRule(
    title.length >= 3 && title.length <= 120,
    "Enter a title between 3 and 120 characters.",
  );
  requireRule(
    description.length <= 1000,
    "Keep the description under 1,000 characters.",
  );
  requireRule(
    location.length <= 120,
    "Keep the location under 120 characters.",
  );
  requireRule(
    eventCategories.includes(input.category),
    "Select an event category.",
  );
  requireRule(
    !meetingUrl || /^https:\/\/[^\s<>"']+$/.test(meetingUrl),
    "Online meeting links must start with https://.",
  );
  const year = records.years.find((item) => item.id === input.year);
  requireRule(
    year && year.status !== "Archived",
    "Choose an open academic year.",
  );
  requireRule(
    validDate(input.startDate) && validDate(input.endDate),
    "Enter valid start and end dates.",
  );
  requireRule(
    input.startDate <= input.endDate,
    "The end date can't be before the start date.",
  );
  requireRule(
    input.startDate >= year.start && input.endDate <= year.end,
    "Dates must fall within the " + year.name + " academic year.",
  );
  const allDay = input.category === "holiday" ? true : input.allDay;
  if (!allDay) {
    requireRule(
      timePattern.test(input.startTime) && timePattern.test(input.endTime),
      "Enter start and end times, or mark the event as all day.",
    );
    requireRule(
      input.startDate < input.endDate || input.startTime < input.endTime,
      "The end time must be after the start time.",
    );
  }
  const audience = audiences.filter((item) => input.audience.includes(item));
  requireRule(audience.length, "Choose at least one audience.");
  if (input.category === "teacher-meeting")
    requireRule(
      audience.length === 1 && audience[0] === "teacher",
      "Teacher meetings are for teachers only.",
    );
  const sections = [...new Set(input.sections)];
  for (const id of sections)
    requireRule(
      records.sections.some(
        (item) => item.id === id && item.status === "Active",
      ),
      "Choose active classes and sections from this school.",
    );
  if (actor.role === "teacher") {
    const own = teacherSectionIds(records, actor);
    requireRule(
      sections.length && sections.every((id) => own.has(id)),
      "Choose one or more of your assigned sections.",
    );
  }

  let ptm: PtmConfig | undefined;
  if (input.category === "ptm") {
    requireRule(isAdmin, "Only school administrators can schedule PTMs.");
    requireRule(
      audience.includes("parent") && audience.includes("teacher"),
      "PTMs must include parents and teachers in the audience.",
    );
    requireRule(
      !allDay && input.startDate === input.endDate,
      "A PTM session runs within a single day with a start and end time.",
    );
    const teachers = [...new Set(input.ptm?.teachers ?? [])];
    requireRule(teachers.length, "Assign at least one teacher to the PTM.");
    for (const id of teachers)
      requireRule(
        records.teachers.some(
          (item) => item.id === id && item.status === "Active",
        ),
        "Assign active teachers from this school.",
      );
    const duration = Number(input.ptm?.duration);
    requireRule(
      Number.isInteger(duration) && duration >= 5 && duration <= 60,
      "Meeting duration must be between 5 and 60 minutes.",
    );
    requireRule(
      minutes(input.endTime) - minutes(input.startTime) >= duration,
      "The session must be long enough for at least one appointment.",
    );
    ptm = { teachers, duration };
  }

  const status: EventStatus = isAdmin
    ? input.publish || existing?.status === "Published"
      ? "Published"
      : (existing?.status ?? "Draft")
    : "Proposed";
  const event: SchoolEvent = {
    id: input.id,
    schoolId: actor.school,
    year: input.year,
    title,
    description,
    category: input.category,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: allDay ? "" : input.startTime,
    endTime: allDay ? "" : input.endTime,
    allDay,
    location,
    meetingUrl,
    audience,
    sections,
    organizerId: existing?.organizerId ?? actor.person,
    organizerRole: existing?.organizerRole ?? actor.role,
    status,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    publishedAt: existing?.publishedAt || (status === "Published" ? stamp : ""),
    cancelledAt: "",
    cancelReason: "",
    ...(ptm ? { ptm } : {}),
  };

  let slots = school.ptmSlots;
  if (input.category === "ptm" || existing?.category === "ptm") {
    const previous = slots.filter((item) => item.eventId === event.id);
    const next = generateSlots(event, previous);
    const booked = school.ptmBookings.filter(
      (item) => item.eventId === event.id && activeBooking(item),
    );
    requireRule(
      !booked.length ||
        (existing?.startDate === event.startDate &&
          booked.every((item) => next.some((slot) => slot.id === item.slotId))),
      "Appointments are booked in slots this change would remove. Cancel those appointments first.",
    );
    slots = [...slots.filter((item) => item.eventId !== event.id), ...next];
  }

  let notifications = school.notifications;
  if (status === "Published" && existing?.status !== "Published")
    notifications = notifyAudience(
      { ...school, notifications },
      records,
      event,
      "published",
      "New " + categoryLabels[event.category].toLowerCase() + ": " + title,
      describeWhen(event),
      stamp,
      actor.person,
    );
  else if (
    status === "Published" &&
    existing?.status === "Published" &&
    !sameTiming(existing, event)
  )
    notifications = notifyAudience(
      { ...school, notifications },
      records,
      event,
      "rescheduled:" +
        event.startDate +
        event.startTime +
        "-" +
        event.endDate +
        event.endTime,
      "Rescheduled: " + title,
      "Now " + describeWhen(event) + " (was " + describeWhen(existing) + ")",
      stamp,
      actor.person,
    );
  if (actor.role === "teacher" && !existing)
    notifications = pushNotification(
      notifications,
      {
        schoolId: actor.school,
        recipientId: adminId(actor.school),
        recipientRole: "school-admin",
        kind: "approval",
        title: "Class activity suggestion: " + title,
        body:
          (records.teachers.find((item) => item.id === actor.person)?.name ??
            "A teacher") +
          " suggested an activity for " +
          describeWhen(event) +
          ". Review it in the approval queue.",
        href: "/demo/school-admin/calendar?tab=approvals",
        contextId: event.id,
        dedupeKey: "event:" + event.id + ":proposed",
      },
      stamp,
    );

  const events = existing
    ? school.events.map((item) => (item.id === event.id ? event : item))
    : [...school.events, event];
  return replaceSchool(state, actor.school, {
    ...school,
    events,
    ptmSlots: slots,
    notifications,
  });
}

function findEvent(school: CommunicationSchool, id: string) {
  const event = school.events.find((item) => item.id === id);
  requireRule(event, "This event is unavailable in this school.");
  return event;
}

function requireAdmin(actor: AssignmentActor) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can do this.",
  );
}

export function publishEvent(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  now: Date,
) {
  requireAdmin(actor);
  const school = schoolOf(state, actor.school);
  const event = findEvent(school, id);
  requireRule(
    event.status === "Draft" || event.status === "Proposed",
    "Only drafts and suggestions can be published.",
  );
  const stamp = now.toISOString();
  const published: SchoolEvent = {
    ...event,
    status: "Published",
    publishedAt: stamp,
    updatedAt: stamp,
  };
  let notifications = notifyAudience(
    school,
    records,
    published,
    "published",
    "New " + categoryLabels[event.category].toLowerCase() + ": " + event.title,
    describeWhen(event),
    stamp,
    actor.person,
  );
  if (event.status === "Proposed")
    notifications = pushNotification(
      notifications,
      {
        schoolId: actor.school,
        recipientId: event.organizerId,
        recipientRole: "teacher",
        kind: "approval",
        title: "Suggestion approved: " + event.title,
        body: "Your class activity is now published on the school calendar.",
        href: calendarHref("teacher", event.id),
        contextId: event.id,
        dedupeKey: "event:" + event.id + ":approved",
      },
      stamp,
    );
  return replaceSchool(state, actor.school, {
    ...school,
    events: school.events.map((item) => (item.id === id ? published : item)),
    notifications,
  });
}

export function declineEvent(
  state: CommunicationState,
  actor: AssignmentActor,
  id: string,
  reason: string,
  now: Date,
) {
  requireAdmin(actor);
  const school = schoolOf(state, actor.school);
  const event = findEvent(school, id);
  requireRule(
    event.status === "Proposed",
    "Only suggestions awaiting approval can be declined.",
  );
  const stamp = now.toISOString();
  const note = reason.trim().slice(0, 300);
  return replaceSchool(state, actor.school, {
    ...school,
    events: school.events.map((item) =>
      item.id === id
        ? { ...item, status: "Declined", updatedAt: stamp, cancelReason: note }
        : item,
    ),
    notifications: pushNotification(
      school.notifications,
      {
        schoolId: actor.school,
        recipientId: event.organizerId,
        recipientRole: "teacher",
        kind: "approval",
        title: "Suggestion declined: " + event.title,
        body: note || "The school administrator did not approve this activity.",
        href: calendarHref("teacher", event.id),
        contextId: event.id,
        dedupeKey: "event:" + event.id + ":declined",
      },
      stamp,
    ),
  });
}

export function cancelEvent(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  reason: string,
  now: Date,
) {
  requireAdmin(actor);
  const school = schoolOf(state, actor.school);
  const event = findEvent(school, id);
  requireRule(
    event.status === "Published" || event.status === "Draft",
    "Only draft or published events can be cancelled.",
  );
  const stamp = now.toISOString();
  const note = reason.trim().slice(0, 300);
  const cancelled: SchoolEvent = {
    ...event,
    status: "Cancelled",
    cancelledAt: stamp,
    cancelReason: note,
    updatedAt: stamp,
  };
  let notifications = school.notifications;
  if (event.publishedAt)
    notifications = notifyAudience(
      school,
      records,
      cancelled,
      "cancelled",
      "Cancelled: " + event.title,
      describeWhen(event) + (note ? " · " + note : ""),
      stamp,
      actor.person,
    );
  const bookings = school.ptmBookings.map((booking) => {
    if (booking.eventId !== id || booking.status !== "Confirmed")
      return booking;
    notifications = pushNotification(
      notifications,
      bookingNotice(
        booking,
        "parent",
        "cancelled",
        "PTM appointment cancelled",
        "The PTM session was cancelled by the school." +
          (note ? " " + note : ""),
        actor.school,
      ),
      stamp,
    );
    return { ...booking, status: "Cancelled" as const, updatedAt: stamp };
  });
  return replaceSchool(state, actor.school, {
    ...school,
    events: school.events.map((item) => (item.id === id ? cancelled : item)),
    ptmBookings: bookings,
    notifications,
  });
}

/** Drafts, declined suggestions and a teacher's own pending suggestions. */
export function deleteEvent(
  state: CommunicationState,
  actor: AssignmentActor,
  id: string,
) {
  const school = schoolOf(state, actor.school);
  const event = findEvent(school, id);
  requireRule(
    !event.publishedAt,
    "Published events can be cancelled, not deleted.",
  );
  if (actor.role === "school-admin")
    requireRule(
      event.status === "Draft" || event.status === "Declined",
      "Only drafts and declined suggestions can be deleted.",
    );
  else
    requireRule(
      actor.role === "teacher" &&
        event.organizerId === actor.person &&
        (event.status === "Proposed" || event.status === "Declined"),
      "You can only withdraw your own suggestions.",
    );
  return replaceSchool(state, actor.school, {
    ...school,
    events: school.events.filter((item) => item.id !== id),
    ptmSlots: school.ptmSlots.filter((item) => item.eventId !== id),
  });
}

/* ---------- PTM appointments ---------- */

function bookingNotice(
  booking: PtmBooking,
  role: "parent" | "teacher",
  transition: string,
  title: string,
  body: string,
  school: SchoolId,
): NotificationInput {
  return {
    schoolId: school,
    recipientId: role === "parent" ? booking.parentId : booking.teacherId,
    recipientRole: role,
    kind: "ptm",
    title,
    body,
    href: ptmHref(role),
    contextId: booking.id,
    dedupeKey: "ptm:" + booking.id + ":" + transition,
  };
}

/** Teachers in a PTM session who teach the actor's (or child's) section. */
export function ptmTeachersForStudent(
  records: AcademicSchool,
  school: SchoolId,
  event: SchoolEvent,
  student: string,
) {
  const section = currentEnrollment(records, student)?.section;
  if (!section || !event.ptm) return [];
  const teaching = new Set(
    activeAllocations(records, {
      role: "student",
      school,
      person: student,
    }).map((item) => item.teacher),
  );
  return event.ptm.teachers.filter((id) => teaching.has(id));
}

export type SlotState =
  "available" | "yours" | "booked" | "blocked" | "past" | "conflict" | "closed";

const slotStart = (slot: PtmSlot) => slot.date + "T" + slot.start;
const overlaps = (a: PtmSlot, b: PtmSlot) =>
  a.date === b.date && a.start < b.end && b.start < a.end;

/** How a slot looks to the actor; parents also see their own conflicts. */
export function slotState(
  school: CommunicationSchool,
  slot: PtmSlot,
  actor: AssignmentActor,
  now: Date,
): SlotState {
  const event = school.events.find((item) => item.id === slot.eventId);
  if (!event || event.status !== "Published") return "closed";
  const holder = school.ptmBookings.find(
    (item) => item.slotId === slot.id && activeBooking(item),
  );
  if (holder)
    return actor.role === "parent" &&
      holder.parentId === actor.person &&
      holder.studentId === actor.child
      ? "yours"
      : "booked";
  if (slot.blocked) return "blocked";
  if (slotStart(slot) <= localDateTime(now)) return "past";
  if (
    actor.role === "parent" &&
    school.ptmBookings.some((item) => {
      if (item.parentId !== actor.person || item.status !== "Confirmed")
        return false;
      const other = school.ptmSlots.find((entry) => entry.id === item.slotId);
      return !!other && overlaps(other, slot);
    })
  )
    return "conflict";
  return "available";
}

function requireBookableSlot(
  school: CommunicationSchool,
  records: AcademicSchool,
  actor: AssignmentActor,
  slotId: string,
  now: Date,
  ignore?: string,
) {
  requireRule(
    actor.role === "parent",
    "Only parents can book PTM appointments.",
  );
  const student = viewerStudent(records, actor);
  requireRule(student, "Select one of your linked children.");
  const slot = school.ptmSlots.find((item) => item.id === slotId);
  requireRule(slot, "This appointment slot is unavailable.");
  const event = school.events.find((item) => item.id === slot.eventId);
  requireRule(
    event &&
      event.status === "Published" &&
      eventVisible(records, actor, event),
    "This PTM session isn't open for booking.",
  );
  requireRule(
    ptmTeachersForStudent(records, actor.school, event, student).includes(
      slot.teacherId,
    ),
    "This teacher doesn't teach your child's class.",
  );
  requireRule(!slot.blocked, "This slot has been withdrawn by the school.");
  requireRule(
    slotStart(slot) > localDateTime(now),
    "This slot has already passed.",
  );
  requireRule(
    !school.ptmBookings.some(
      (item) =>
        item.id !== ignore && item.slotId === slot.id && activeBooking(item),
    ),
    "This slot was just booked by another family. Choose another time.",
  );
  requireRule(
    !school.ptmBookings.some((item) => {
      if (
        item.id === ignore ||
        item.parentId !== actor.person ||
        item.status !== "Confirmed"
      )
        return false;
      const other = school.ptmSlots.find((entry) => entry.id === item.slotId);
      return !!other && overlaps(other, slot);
    }),
    "You already have another appointment at this time.",
  );
  return { slot, event, student };
}

const slotLabel = (slot: PtmSlot) =>
  slot.date + ", " + slot.start + "–" + slot.end;

export function bookSlot(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  slotId: string,
  now: Date,
  id: string,
) {
  const school = schoolOf(state, actor.school);
  const { slot, event, student } = requireBookableSlot(
    school,
    records,
    actor,
    slotId,
    now,
  );
  requireRule(
    !school.ptmBookings.some(
      (item) =>
        item.eventId === event.id &&
        item.teacherId === slot.teacherId &&
        item.studentId === student &&
        activeBooking(item),
    ),
    "You already have an appointment with this teacher. Reschedule it instead.",
  );
  const stamp = now.toISOString();
  const booking: PtmBooking = {
    id,
    eventId: event.id,
    slotId,
    teacherId: slot.teacherId,
    parentId: actor.person,
    studentId: student,
    status: "Confirmed",
    createdAt: stamp,
    updatedAt: stamp,
    notes: "",
  };
  const studentName = name(records, "students", student);
  const teacherName = name(records, "teachers", slot.teacherId);
  let notifications = pushNotification(
    school.notifications,
    bookingNotice(
      booking,
      "parent",
      "booked",
      "PTM booking confirmed",
      teacherName + " · " + slotLabel(slot) + " · for " + studentName,
      actor.school,
    ),
    stamp,
  );
  notifications = pushNotification(
    notifications,
    bookingNotice(
      booking,
      "teacher",
      "booked",
      "New PTM appointment",
      name(records, "guardians", actor.person) +
        " (parent of " +
        studentName +
        ") · " +
        slotLabel(slot),
      actor.school,
    ),
    stamp,
  );
  return replaceSchool(state, actor.school, {
    ...school,
    ptmBookings: [...school.ptmBookings, booking],
    notifications,
  });
}

function ownBooking(
  school: CommunicationSchool,
  actor: AssignmentActor,
  id: string,
) {
  const booking = school.ptmBookings.find((item) => item.id === id);
  requireRule(
    booking &&
      actor.role === "parent" &&
      booking.parentId === actor.person &&
      booking.studentId === actor.child,
    "This appointment is unavailable.",
  );
  requireRule(
    booking.status === "Confirmed",
    "Only confirmed appointments can be changed.",
  );
  return booking;
}

export function rescheduleBooking(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  slotId: string,
  now: Date,
) {
  const school = schoolOf(state, actor.school);
  const booking = ownBooking(school, actor, id);
  const current = school.ptmSlots.find((item) => item.id === booking.slotId);
  requireRule(slotId !== booking.slotId, "Choose a different time.");
  requireRule(
    !current || slotStart(current) > localDateTime(now),
    "This appointment has already started.",
  );
  const { slot } = requireBookableSlot(school, records, actor, slotId, now, id);
  requireRule(
    slot.eventId === booking.eventId && slot.teacherId === booking.teacherId,
    "Choose another slot with the same teacher in this PTM session.",
  );
  const stamp = now.toISOString();
  const moved = { ...booking, slotId, updatedAt: stamp };
  const studentName = name(records, "students", booking.studentId);
  let notifications = pushNotification(
    school.notifications,
    bookingNotice(
      moved,
      "parent",
      "rescheduled:" + slotId,
      "PTM appointment rescheduled",
      name(records, "teachers", booking.teacherId) +
        " · now " +
        slotLabel(slot),
      actor.school,
    ),
    stamp,
  );
  notifications = pushNotification(
    notifications,
    bookingNotice(
      moved,
      "teacher",
      "rescheduled:" + slotId,
      "PTM appointment rescheduled",
      studentName +
        "'s parent moved to " +
        slotLabel(slot) +
        (current ? " (was " + current.start + ")" : ""),
      actor.school,
    ),
    stamp,
  );
  return replaceSchool(state, actor.school, {
    ...school,
    ptmBookings: school.ptmBookings.map((item) =>
      item.id === id ? moved : item,
    ),
    notifications,
  });
}

export function cancelBooking(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  now: Date,
) {
  const school = schoolOf(state, actor.school);
  const booking = ownBooking(school, actor, id);
  const slot = school.ptmSlots.find((item) => item.id === booking.slotId);
  requireRule(
    !slot || slotStart(slot) > localDateTime(now),
    "This appointment has already started.",
  );
  const stamp = now.toISOString();
  const cancelled = {
    ...booking,
    status: "Cancelled" as const,
    updatedAt: stamp,
  };
  const when = slot ? slotLabel(slot) : "";
  let notifications = pushNotification(
    school.notifications,
    bookingNotice(
      cancelled,
      "parent",
      "cancelled",
      "PTM appointment cancelled",
      name(records, "teachers", booking.teacherId) + " · " + when,
      actor.school,
    ),
    stamp,
  );
  notifications = pushNotification(
    notifications,
    bookingNotice(
      cancelled,
      "teacher",
      "cancelled",
      "PTM appointment cancelled",
      name(records, "students", booking.studentId) +
        "'s parent cancelled " +
        when +
        ". The slot is free again.",
      actor.school,
    ),
    stamp,
  );
  return replaceSchool(state, actor.school, {
    ...school,
    ptmBookings: school.ptmBookings.map((item) =>
      item.id === id ? cancelled : item,
    ),
    notifications,
  });
}

/** Teacher marks their meeting complete and/or saves private notes. */
export function updateMeeting(
  state: CommunicationState,
  actor: AssignmentActor,
  id: string,
  change: { notes?: string; complete?: boolean },
  now: Date,
) {
  const school = schoolOf(state, actor.school);
  const booking = school.ptmBookings.find((item) => item.id === id);
  requireRule(
    booking && actor.role === "teacher" && booking.teacherId === actor.person,
    "Only the meeting's teacher can update it.",
  );
  requireRule(
    booking.status !== "Cancelled",
    "This appointment was cancelled.",
  );
  const notes =
    change.notes === undefined ? booking.notes : change.notes.trim();
  requireRule(notes.length <= 1000, "Keep notes under 1,000 characters.");
  return replaceSchool(state, actor.school, {
    ...school,
    ptmBookings: school.ptmBookings.map((item) =>
      item.id === id
        ? {
            ...item,
            notes,
            status: change.complete ? "Completed" : item.status,
            updatedAt: now.toISOString(),
          }
        : item,
    ),
  });
}

export function toggleSlotBlocked(
  state: CommunicationState,
  actor: AssignmentActor,
  slotId: string,
) {
  requireAdmin(actor);
  const school = schoolOf(state, actor.school);
  const slot = school.ptmSlots.find((item) => item.id === slotId);
  requireRule(slot, "This slot is unavailable.");
  requireRule(
    !school.ptmBookings.some(
      (item) => item.slotId === slotId && activeBooking(item),
    ),
    "This slot is booked. The parent must cancel or reschedule first.",
  );
  return replaceSchool(state, actor.school, {
    ...school,
    ptmSlots: school.ptmSlots.map((item) =>
      item.id === slotId ? { ...item, blocked: !item.blocked } : item,
    ),
  });
}

/**
 * Bookings the actor may see. Meeting notes are returned only to the
 * meeting's own teacher.
 */
export function bookingsFor(
  state: CommunicationState,
  actor: AssignmentActor,
): PtmBooking[] {
  const rows = state.schools[actor.school]?.ptmBookings ?? [];
  const visible =
    actor.role === "school-admin"
      ? rows
      : actor.role === "teacher"
        ? rows.filter((item) => item.teacherId === actor.person)
        : actor.role === "parent"
          ? rows.filter(
              (item) =>
                item.parentId === actor.person &&
                item.studentId === actor.child,
            )
          : [];
  return visible.map((item) =>
    actor.role === "teacher" && item.teacherId === actor.person
      ? item
      : { ...item, notes: "" },
  );
}

/* ---------- Calendar entries (events + linked records) ---------- */

export type EntrySource =
  "event" | "assignment" | "exam" | "test" | "ptm" | "leave";
export type CalendarEntry = {
  /** Stable source reference, e.g. "assignment:<id>"; never duplicated. */
  key: string;
  source: EntrySource;
  sourceId: string;
  category: EntryCategory;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  status: EventStatus;
  sections: string[];
  event?: SchoolEvent;
  booking?: PtmBooking;
};

function name(
  records: AcademicSchool,
  table: "students" | "teachers" | "guardians",
  id: string,
) {
  return (
    (records[table] as { id: string; name: string }[]).find(
      (item) => item.id === id,
    )?.name ?? "Unknown"
  );
}

export function sectionName(records: AcademicSchool, id: string) {
  const section = records.sections.find((item) => item.id === id);
  return section ? section.grade + " · " + section.name : "Unknown section";
}

/**
 * Everything on the actor's calendar: school events plus read-only entries
 * from assignments, exams, online tests, PTM appointments and approved
 * leave. Linked records are referenced, never copied or modified.
 */
export function calendarEntries(
  state: CommunicationState,
  learning: LearningState,
  records: AcademicSchool,
  actor: AssignmentActor,
  leave?: LeaveSchool,
): CalendarEntry[] {
  const entries = new Map<string, CalendarEntry>();
  const add = (entry: CalendarEntry) => entries.set(entry.key, entry);
  const school = state.schools[actor.school];
  if (!school || actor.role === "super-admin") return [];

  for (const event of eventsFor(state, records, actor))
    add({
      key: "event:" + event.id,
      source: "event",
      sourceId: event.id,
      category: event.category,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      location: event.location,
      status: event.status,
      sections: event.sections,
      event,
    });

  const allocations =
    actor.role === "school-admin"
      ? records.allocations
      : activeAllocations(records, actor);
  const allocationIds = new Set(allocations.map((item) => item.id));
  const sectionOf = (allocation: string) =>
    records.allocations.find((item) => item.id === allocation)?.section;
  const subjectOf = (allocation: string) =>
    records.subjects.find(
      (item) =>
        item.id ===
        records.allocations.find((entry) => entry.id === allocation)?.subject,
    )?.name;

  for (const item of records.assignments)
    if (
      item.published &&
      allocationIds.has(item.allocation) &&
      validDate(item.due)
    )
      add({
        key: "assignment:" + item.id,
        source: "assignment",
        sourceId: item.id,
        category: "deadline",
        title: "Due: " + item.title,
        description:
          (subjectOf(item.allocation) ?? "Assignment") +
          " · " +
          item.maximum +
          " marks",
        startDate: item.due,
        endDate: item.due,
        startTime: "",
        endTime: "",
        allDay: true,
        location: "",
        status: "Published",
        sections: [sectionOf(item.allocation) ?? ""].filter(Boolean),
      });

  const learningSchool = learning.schools[actor.school];
  if (learningSchool) {
    const student = viewerStudent(records, actor);
    const exams =
      actor.role === "school-admin" || actor.role === "teacher"
        ? examsFor(learningSchool, records, actor)
        : student
          ? examsFor(learningSchool, records, actor, student)
          : [];
    for (const exam of exams)
      if (validDate(exam.date))
        add({
          key: "exam:" + exam.id,
          source: "exam",
          sourceId: exam.id,
          category: "exam",
          title: exam.name,
          description: "Scheduled exam · maximum " + exam.maximum + " marks",
          startDate: exam.date,
          endDate: exam.date,
          startTime: "",
          endTime: "",
          allDay: true,
          location: "",
          status: "Published",
          sections: [],
        });
    const tests =
      actor.role === "school-admin"
        ? learningSchool.tests.filter((item) => item.published)
        : testsFor(learning, records, actor).filter((item) => item.published);
    for (const test of tests)
      add({
        key: "test:" + test.id,
        source: "test",
        sourceId: test.id,
        category: "exam",
        title: "Online test: " + test.title,
        description:
          (subjectOf(test.allocation) ?? "Online test") +
          " · " +
          test.duration +
          " minutes",
        startDate: test.opens.slice(0, 10),
        endDate: test.closes.slice(0, 10),
        startTime: test.opens.slice(11, 16),
        endTime: test.closes.slice(11, 16),
        allDay: false,
        location: "Online",
        status: "Published",
        sections: [sectionOf(test.allocation) ?? ""].filter(Boolean),
      });
  }

  if (actor.role === "parent" || actor.role === "teacher")
    for (const booking of bookingsFor(state, actor)) {
      if (!activeBooking(booking)) continue;
      const slot = school.ptmSlots.find((item) => item.id === booking.slotId);
      const event = school.events.find((item) => item.id === booking.eventId);
      if (!slot || !event) continue;
      add({
        key: "ptm:" + booking.id,
        source: "ptm",
        sourceId: booking.id,
        category: "ptm",
        title:
          actor.role === "parent"
            ? "PTM with " + name(records, "teachers", booking.teacherId)
            : "PTM · " + name(records, "students", booking.studentId),
        description:
          actor.role === "parent"
            ? "Appointment for " + name(records, "students", booking.studentId)
            : "With " + name(records, "guardians", booking.parentId),
        startDate: slot.date,
        endDate: slot.date,
        startTime: slot.start,
        endTime: slot.end,
        allDay: false,
        location: event.location || (event.meetingUrl ? "Online" : ""),
        status: "Published",
        sections: [],
        booking,
      });
    }

  if (leave)
    for (const request of leaveRequestsFor(leave, records, actor)) {
      if (request.status !== "Approved" || !validDate(request.start)) continue;
      const who =
        request.kind === "teacher"
          ? name(records, "teachers", request.subject)
          : name(records, "students", request.subject);
      add({
        key: "leave:" + request.id,
        source: "leave",
        sourceId: request.id,
        category: "leave",
        title:
          (request.kind === "teacher"
            ? "Teacher leave: "
            : "Approved leave: ") + who,
        description: request.type + " · " + request.duration,
        startDate: request.start,
        endDate: request.end || request.start,
        startTime: "",
        endTime: "",
        allDay: true,
        location: "",
        status: "Published",
        sections: request.section ? [request.section] : [],
      });
    }

  return [...entries.values()].sort(compareEntries);
}

export function compareEntries(a: CalendarEntry, b: CalendarEntry) {
  return (
    a.startDate.localeCompare(b.startDate) ||
    Number(b.allDay) - Number(a.allDay) ||
    a.startTime.localeCompare(b.startTime) ||
    a.title.localeCompare(b.title)
  );
}

export function entriesOn(entries: CalendarEntry[], date: string) {
  return entries.filter(
    (item) => item.startDate <= date && item.endDate >= date,
  );
}

/* ---------- Reminders ---------- */

/**
 * Creates "upcoming" reminders for exams, PTM sessions and PTM appointments
 * in the next three days. Runs when the demo opens — there is no background
 * scheduler — and never repeats a reminder for the same person and event.
 */
export function syncReminders(
  state: CommunicationState,
  records: AcademicSchool,
  school: SchoolId,
  now: Date,
): CommunicationState {
  const value = state.schools[school];
  if (!value) return state;
  const today = localDateTime(now).slice(0, 10);
  const horizon = addDays(today, 3);
  const stamp = now.toISOString();
  let notifications = value.notifications;
  for (const event of value.events) {
    if (
      event.status !== "Published" ||
      (event.category !== "exam" && event.category !== "ptm") ||
      event.startDate < today ||
      event.startDate > horizon
    )
      continue;
    for (const recipient of eventRecipients(records, school, event))
      notifications = pushNotification(
        notifications,
        {
          schoolId: school,
          recipientId: recipient.person,
          recipientRole: recipient.role,
          kind: "reminder",
          title: "Upcoming: " + event.title,
          body: describeWhen(event),
          href: calendarHref(recipient.role, event.id),
          contextId: event.id,
          dedupeKey: "reminder:" + event.id + ":" + event.startDate,
        },
        stamp,
      );
  }
  for (const booking of value.ptmBookings) {
    if (booking.status !== "Confirmed") continue;
    const slot = value.ptmSlots.find((item) => item.id === booking.slotId);
    if (!slot || slot.date < today || slot.date > horizon) continue;
    for (const role of ["parent", "teacher"] as const)
      notifications = pushNotification(
        notifications,
        bookingNotice(
          booking,
          role,
          "reminder:" + slot.id,
          "PTM reminder",
          (role === "parent"
            ? name(records, "teachers", booking.teacherId)
            : name(records, "students", booking.studentId)) +
            " · " +
            slotLabel(slot),
          school,
        ),
        stamp,
      );
  }
  return notifications === value.notifications
    ? state
    : replaceSchool(state, school, { ...value, notifications });
}

/**
 * Leave management and absence alerts.
 *
 * Pure, school-scoped functions over a versioned snapshot. Every command
 * takes the shared academic records for the actor's school so relationships
 * (enrollment, class teacher, guardian links, timetable) are always checked
 * against the live academic data rather than copied into this store.
 *
 * Attendance rules:
 * - Stored attendance marks stay Present, Absent or Late and are never
 *   rewritten by a leave decision, so the record stays auditable.
 * - An Absent mark on a date covered by APPROVED leave is displayed as
 *   "Approved Leave" (an excused absence).
 * - Physical attendance = (Present + Late) / recorded marks. Approved leave
 *   is never counted as physical presence; it is reported separately as an
 *   approved leave day count.
 * - Pending, rejected and cancelled requests do not change attendance, and a
 *   leave request alone never creates an attendance record.
 */
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
  type Entry,
} from "./academic-model";
import type { AssignmentActor } from "./assignment-model";
import type { DemoRole, SchoolId } from "@/types/demo";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export const leaveTypes = [
  "Sick Leave",
  "Personal Leave",
  "Family Emergency",
  "Medical Appointment",
  "Other",
] as const;
export type LeaveType = (typeof leaveTypes)[number];

export const leaveStatuses = [
  "Draft",
  "Pending Teacher",
  "Pending Admin",
  "Approved",
  "Rejected",
  "Cancelled",
] as const;
export type LeaveStatus = (typeof leaveStatuses)[number];

export const leaveDurations = [
  "Full day",
  "First half",
  "Second half",
] as const;
export type LeaveDuration = (typeof leaveDurations)[number];

export type LeaveKind = "student" | "teacher";
export type LeaveAction =
  | "Saved draft"
  | "Edited draft"
  | "Submitted"
  | "Forwarded"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Substitute planned";

export type LeaveEvent = {
  at: string;
  actor: string;
  role: DemoRole;
  action: LeaveAction;
  status: LeaveStatus;
  note?: string;
};

/** Fictional attachment metadata only. No file content is ever stored. */
export type LeaveAttachment = { name: string; kind: string; size: string };

export type LeaveRequest = {
  id: string;
  school: SchoolId;
  kind: LeaveKind;
  /** The student or teacher the leave is for. */
  subject: string;
  /** The student's section when the request was created. */
  section?: string;
  submittedBy: string;
  submittedRole: "student" | "parent" | "teacher";
  /** Teacher ID, or the school admin ID once escalated / for teacher leave. */
  reviewer: string;
  type: LeaveType;
  start: string;
  end: string;
  duration: LeaveDuration;
  reason: string;
  contact: string;
  attachment?: LeaveAttachment;
  /** Teacher leave: the colleague the applicant suggests as cover. */
  substitute: string;
  /** Teacher leave: "date|sessionId" → covering teacher ID. */
  plan: Record<string, string>;
  status: LeaveStatus;
  /** The latest reviewer comment. */
  remarks: string;
  created: string;
  updated: string;
  history: LeaveEvent[];
};

export type NoticeRole = "student" | "parent" | "teacher" | "school-admin";

export type LeaveNotification = {
  id: string;
  school: SchoolId;
  recipient: string;
  recipientRole: NoticeRole;
  kind: "absence" | "leave";
  title: string;
  message: string;
  created: string;
  read: boolean;
  student?: string;
  request?: string;
  /** Absence alerts: one per attendance record, student and guardian. */
  key?: string;
  section?: string;
  date?: string;
  state?: "Active" | "Resolved";
};

export type LeaveSchool = {
  requests: LeaveRequest[];
  notifications: LeaveNotification[];
};
export type LeaveState = {
  version: 1;
  schools: Record<SchoolId, LeaveSchool>;
};

export type LeaveInput = {
  subject: string;
  type: string;
  start: string;
  end: string;
  duration: string;
  reason: string;
  contact?: string;
  attachment?: LeaveAttachment;
  substitute?: string;
};

export type LeaveActor = AssignmentActor;

/* ------------------------------------------------------------------ */
/* Dates                                                              */
/* ------------------------------------------------------------------ */

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function utc(date: string) {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
}

export function addDays(date: string, days: number) {
  return new Date(utc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Every calendar date from start to end, inclusive (empty if invalid). */
export function datesBetween(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start) return [];
  const dates: string[] = [];
  for (let day = start; day <= end && dates.length < 400; day = addDays(day, 1))
    dates.push(day);
  return dates;
}

export function weekdayName(date: string) {
  return weekdays[new Date(utc(date)).getUTCDay()];
}

/** "2026-11-23" → "23 November 2026" */
export function longDate(date: string) {
  return (
    Number(date.slice(8, 10)) +
    " " +
    monthNames[Number(date.slice(5, 7)) - 1] +
    " " +
    date.slice(0, 4)
  );
}

/** Local "YYYY-MM-DDTHH:mm" timestamp. */
export function localStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

/** Leave length in days; a half day counts as 0.5. */
export function leaveLength(
  request: Pick<LeaveRequest, "start" | "end" | "duration">,
) {
  const days = datesBetween(request.start, request.end).length;
  return request.duration === "Full day" ? days : days * 0.5;
}

export function formatLeaveLength(days: number) {
  if (days === 0.5) return "Half day";
  return days === 1 ? "1 day" : days + " days";
}

export function formatRange(request: Pick<LeaveRequest, "start" | "end">) {
  const short = (date: string) =>
    Number(date.slice(8, 10)) +
    " " +
    monthNames[Number(date.slice(5, 7)) - 1].slice(0, 3);
  if (request.start === request.end)
    return short(request.start) + " " + request.start.slice(0, 4);
  return (
    short(request.start) +
    (request.start.slice(0, 4) === request.end.slice(0, 4)
      ? ""
      : " " + request.start.slice(0, 4)) +
    " – " +
    short(request.end) +
    " " +
    request.end.slice(0, 4)
  );
}

/** Two requests overlap unless they are opposite halves of the same day. */
export function leavesOverlap(
  a: Pick<LeaveRequest, "start" | "end" | "duration">,
  b: Pick<LeaveRequest, "start" | "end" | "duration">,
) {
  if (a.start > b.end || b.start > a.end) return false;
  const singleSameDay =
    a.start === a.end && b.start === b.end && a.start === b.start;
  if (
    singleSameDay &&
    a.duration !== "Full day" &&
    b.duration !== "Full day" &&
    a.duration !== b.duration
  )
    return false;
  return true;
}

export function coversDate(
  request: Pick<LeaveRequest, "start" | "end">,
  date: string,
) {
  return request.start <= date && date <= request.end;
}

/* ------------------------------------------------------------------ */
/* Relationships                                                      */
/* ------------------------------------------------------------------ */

export const activeStatuses: readonly LeaveStatus[] = [
  "Pending Teacher",
  "Pending Admin",
  "Approved",
];
export const pendingStatuses: readonly LeaveStatus[] = [
  "Pending Teacher",
  "Pending Admin",
];

export function schoolAdminId(school: SchoolId) {
  return school + "-admin";
}

function activeTeacher(school: AcademicSchool, id: string) {
  return school.teachers.some(
    (item) => item.id === id && item.status === "Active",
  );
}

function openSections(school: AcademicSchool) {
  const year = school.years.find((item) => item.status === "Active");
  return school.sections.filter(
    (item) => item.status === "Active" && item.year === year?.id,
  );
}

/** The section's class teacher: its coordinator, else an allocated teacher. */
export function classTeacher(school: AcademicSchool, section: string) {
  const group = school.sections.find((item) => item.id === section);
  if (group?.coordinator && activeTeacher(school, group.coordinator))
    return group.coordinator;
  return school.allocations.find(
    (item) => item.section === section && activeTeacher(school, item.teacher),
  )?.teacher;
}

/** Sections a teacher may review leave for: coordinated or taught. */
export function teacherSections(school: AcademicSchool, teacher: string) {
  if (!activeTeacher(school, teacher)) return new Set<string>();
  return new Set(
    openSections(school)
      .filter(
        (section) =>
          section.coordinator === teacher ||
          school.allocations.some(
            (item) => item.section === section.id && item.teacher === teacher,
          ),
      )
      .map((item) => item.id),
  );
}

export function sectionTitle(school: AcademicSchool, section?: string) {
  const group = school.sections.find((item) => item.id === section);
  return group ? group.grade + " · " + group.name : "—";
}

export function personName(
  school: AcademicSchool,
  id: string,
  role?: DemoRole | NoticeRole,
) {
  if (role === "school-admin" || id.endsWith("-admin")) return "School Admin";
  return (
    school.students.find((item) => item.id === id)?.name ??
    school.teachers.find((item) => item.id === id)?.name ??
    school.guardians.find((item) => item.id === id)?.name ??
    "Unknown"
  );
}

function guardiansOf(school: AcademicSchool, student: string) {
  return [
    ...new Set(
      school.links
        .filter((item) => item.student === student)
        .map((item) => item.guardian),
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* State helpers                                                      */
/* ------------------------------------------------------------------ */

export const emptyLeaveSchool: LeaveSchool = {
  requests: [],
  notifications: [],
};

export function leaveSchool(state: LeaveState, school: SchoolId): LeaveSchool {
  return state.schools[school] ?? emptyLeaveSchool;
}

function withSchool(
  state: LeaveState,
  school: SchoolId,
  change: (records: LeaveSchool) => LeaveSchool,
): LeaveState {
  return {
    ...state,
    schools: { ...state.schools, [school]: change(leaveSchool(state, school)) },
  };
}

function findRequest(state: LeaveState, actor: LeaveActor, id: string) {
  const request = leaveSchool(state, actor.school).requests.find(
    (item) => item.id === id && item.school === actor.school,
  );
  requireRule(request, "This leave request is unavailable in this school.");
  return request;
}

type NoticeDraft = Omit<LeaveNotification, "id" | "school" | "read">;

function addNotices(
  records: LeaveSchool,
  school: SchoolId,
  base: string,
  notices: NoticeDraft[],
): LeaveSchool {
  const seen = new Set<string>();
  const fresh = notices
    .filter((notice) => {
      const id = notice.recipientRole + ":" + notice.recipient;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((notice, index) => ({
      ...notice,
      id: base + "-" + records.notifications.length + "-" + index,
      school,
      read: false,
    }));
  return { ...records, notifications: [...fresh, ...records.notifications] };
}

/** Student, linked guardians and (if different) the submitter. */
function familyRecipients(
  school: AcademicSchool,
  request: LeaveRequest,
): { recipient: string; recipientRole: NoticeRole }[] {
  return [
    { recipient: request.subject, recipientRole: "student" as const },
    ...guardiansOf(school, request.subject).map((recipient) => ({
      recipient,
      recipientRole: "parent" as const,
    })),
  ];
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

function includes<T extends string>(
  list: readonly T[],
  value: string,
): value is T {
  return (list as readonly string[]).includes(value);
}

type Applicant = {
  kind: LeaveKind;
  section?: string;
  reviewer: string;
  submittedRole: LeaveRequest["submittedRole"];
};

function resolveApplicant(
  school: AcademicSchool,
  actor: LeaveActor,
  subject: string,
): Applicant {
  if (actor.role === "student" || actor.role === "parent") {
    if (actor.role === "student")
      requireRule(
        subject === actor.person &&
          school.students.some((item) => item.id === subject),
        "Students can only request leave for their own enrollment.",
      );
    else
      requireRule(
        linkedStudents(school, actor.person).some(
          (item) => item.id === subject,
        ),
        "Parents can only request leave for their linked children.",
      );
    const enrollment = currentEnrollment(school, subject);
    requireRule(
      enrollment,
      "This student has no current enrollment in this school.",
    );
    const reviewer = classTeacher(school, enrollment.section);
    requireRule(reviewer, "No class teacher is assigned to this section yet.");
    return {
      kind: "student",
      section: enrollment.section,
      reviewer,
      submittedRole: actor.role,
    };
  }
  if (actor.role === "teacher") {
    requireRule(
      subject === actor.person,
      "Teachers can only submit their own leave.",
    );
    requireRule(
      activeTeacher(school, subject),
      "Only active teachers can apply for leave.",
    );
    return {
      kind: "teacher",
      reviewer: schoolAdminId(actor.school),
      submittedRole: "teacher",
    };
  }
  throw new Error("Only students, parents and teachers can apply for leave.");
}

function cleanInput(
  school: AcademicSchool,
  kind: LeaveKind,
  input: LeaveInput,
) {
  const type = String(input.type ?? "").trim();
  const duration = String(input.duration ?? "Full day").trim();
  const start = String(input.start ?? "").trim();
  const end = String(input.end ?? "").trim();
  const reason = String(input.reason ?? "").trim();
  const contact = String(input.contact ?? "").trim();
  const substitute = String(input.substitute ?? "").trim();
  requireRule(includes(leaveTypes, type), "Select a leave type.");
  requireRule(
    includes(leaveDurations, duration),
    "Choose a full day or a half day.",
  );
  requireRule(start && end, "Enter a start date and an end date.");
  requireRule(
    validDate(start) && validDate(end),
    "Enter valid calendar dates.",
  );
  requireRule(end >= start, "The end date cannot be before the start date.");
  requireRule(
    duration === "Full day" || start === end,
    "A half-day leave must start and end on the same date.",
  );
  requireRule(
    datesBetween(start, end).length <= 30,
    "A single leave request can cover at most 30 days.",
  );
  const year = school.years.find((item) => item.status === "Active");
  requireRule(
    year && start >= year.start && end <= year.end,
    "Choose dates within the active academic year" +
      (year ? " (" + year.start + " to " + year.end + ")." : "."),
  );
  requireRule(reason.length >= 10, "Give a reason of at least 10 characters.");
  requireRule(reason.length <= 500, "Keep the reason under 500 characters.");
  requireRule(
    contact.length <= 200,
    "Keep the contact note under 200 characters.",
  );
  let attachment: LeaveAttachment | undefined;
  if (input.attachment?.name) {
    const name = String(input.attachment.name).trim();
    requireRule(
      name.length <= 80 && /\.(pdf|jpg|jpeg|png)$/i.test(name),
      "Attachments must be a PDF, JPG or PNG name (demo metadata only).",
    );
    attachment = {
      name,
      kind: String(
        input.attachment.kind || name.split(".").pop()!.toUpperCase(),
      ),
      size: String(input.attachment.size || "—"),
    };
  }
  if (kind === "teacher" && substitute)
    requireRule(
      activeTeacher(school, substitute),
      "Suggest an active teacher from this school as cover.",
    );
  return {
    type: type as LeaveType,
    duration: duration as LeaveDuration,
    start,
    end,
    reason,
    contact,
    attachment,
    substitute: kind === "teacher" ? substitute : "",
  };
}

function assertNoOverlap(
  requests: LeaveRequest[],
  candidate: Pick<
    LeaveRequest,
    "id" | "kind" | "subject" | "start" | "end" | "duration"
  >,
  statuses: readonly LeaveStatus[] = activeStatuses,
) {
  const clash = requests.find(
    (item) =>
      item.id !== candidate.id &&
      item.kind === candidate.kind &&
      item.subject === candidate.subject &&
      statuses.includes(item.status) &&
      leavesOverlap(item, candidate),
  );
  if (clash)
    throw new Error(
      "These dates overlap an existing " +
        clash.status.toLowerCase() +
        " request (" +
        formatRange(clash) +
        ", submitted by " +
        (clash.submittedRole === "parent" ? "a parent" : clash.submittedRole) +
        ").",
    );
}

/* ------------------------------------------------------------------ */
/* Commands                                                           */
/* ------------------------------------------------------------------ */

function submissionNotices(
  school: AcademicSchool,
  request: LeaveRequest,
): NoticeDraft[] {
  const name = personName(school, request.subject);
  const base = {
    kind: "leave" as const,
    created: request.updated,
    request: request.id,
    student: request.kind === "student" ? request.subject : undefined,
  };
  const summary =
    request.type +
    " · " +
    formatRange(request) +
    " · " +
    formatLeaveLength(leaveLength(request));
  if (request.kind === "teacher")
    return [
      {
        ...base,
        recipient: request.reviewer,
        recipientRole: "school-admin",
        title: "Teacher leave request",
        message: name + " applied for " + summary + ".",
      },
    ];
  const by = request.submittedRole === "parent" ? "a parent" : "the student";
  return [
    {
      ...base,
      recipient: request.reviewer,
      recipientRole: "teacher",
      title: "New student leave request",
      message:
        name +
        " (" +
        sectionTitle(school, request.section) +
        ") · " +
        summary +
        " · submitted by " +
        by +
        ".",
    },
    ...familyRecipients(school, request)
      .filter((item) => item.recipient !== request.submittedBy)
      .map((item) => ({
        ...base,
        ...item,
        title: "Leave request submitted",
        message:
          personName(school, request.submittedBy) +
          " submitted " +
          summary +
          " for " +
          name +
          ". Awaiting the class teacher's review.",
      })),
  ];
}

export function createLeaveRequest(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  input: LeaveInput,
  options: { id: string; now: string; draft?: boolean },
): LeaveState {
  const applicant = resolveApplicant(school, actor, input.subject);
  const fields = cleanInput(school, applicant.kind, input);
  const records = leaveSchool(state, actor.school);
  requireRule(
    !records.requests.some((item) => item.id === options.id),
    "This request already exists.",
  );
  const request: LeaveRequest = {
    id: options.id,
    school: actor.school,
    kind: applicant.kind,
    subject: input.subject,
    section: applicant.section,
    submittedBy: actor.person,
    submittedRole: applicant.submittedRole,
    reviewer: applicant.reviewer,
    ...fields,
    plan: {},
    status: options.draft
      ? "Draft"
      : applicant.kind === "student"
        ? "Pending Teacher"
        : "Pending Admin",
    remarks: "",
    created: options.now,
    updated: options.now,
    history: [],
  };
  if (!options.draft) assertNoOverlap(records.requests, request);
  request.history = [
    {
      at: options.now,
      actor: actor.person,
      role: actor.role,
      action: options.draft ? "Saved draft" : "Submitted",
      status: request.status,
    },
  ];
  return withSchool(state, actor.school, (current) => {
    const next = { ...current, requests: [request, ...current.requests] };
    return options.draft
      ? next
      : addNotices(
          next,
          actor.school,
          request.id,
          submissionNotices(school, request),
        );
  });
}

function ownDraft(state: LeaveState, actor: LeaveActor, id: string) {
  const request = findRequest(state, actor, id);
  requireRule(
    request.submittedBy === actor.person &&
      request.submittedRole === actor.role,
    "Only the person who created this request can change it.",
  );
  requireRule(request.status === "Draft", "Only drafts can be edited.");
  return request;
}

export function editLeaveDraft(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  id: string,
  input: LeaveInput,
  now: string,
): LeaveState {
  const request = ownDraft(state, actor, id);
  requireRule(
    input.subject === request.subject,
    "A draft cannot be moved to another person.",
  );
  const applicant = resolveApplicant(school, actor, request.subject);
  const fields = cleanInput(school, applicant.kind, input);
  return withSchool(state, actor.school, (current) => ({
    ...current,
    requests: current.requests.map((item) =>
      item.id === id
        ? {
            ...item,
            ...fields,
            section: applicant.section,
            reviewer: applicant.reviewer,
            updated: now,
            history: [
              ...item.history,
              {
                at: now,
                actor: actor.person,
                role: actor.role,
                action: "Edited draft" as const,
                status: "Draft" as const,
              },
            ],
          }
        : item,
    ),
  }));
}

export function submitLeaveDraft(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  id: string,
  now: string,
): LeaveState {
  const draft = ownDraft(state, actor, id);
  // Re-validate against today's relationships and dates.
  const applicant = resolveApplicant(school, actor, draft.subject);
  const fields = cleanInput(school, applicant.kind, draft);
  const records = leaveSchool(state, actor.school);
  const request: LeaveRequest = {
    ...draft,
    ...fields,
    section: applicant.section,
    reviewer: applicant.reviewer,
    status: applicant.kind === "student" ? "Pending Teacher" : "Pending Admin",
    updated: now,
  };
  assertNoOverlap(records.requests, request);
  request.history = [
    ...draft.history,
    {
      at: now,
      actor: actor.person,
      role: actor.role,
      action: "Submitted",
      status: request.status,
    },
  ];
  return withSchool(state, actor.school, (current) =>
    addNotices(
      {
        ...current,
        requests: current.requests.map((item) =>
          item.id === id ? request : item,
        ),
      },
      actor.school,
      request.id,
      submissionNotices(school, request),
    ),
  );
}

export type LeaveDecision = "approve" | "reject" | "forward";

/** Whether this actor may decide on the request right now. */
export function canReview(
  school: AcademicSchool,
  actor: LeaveActor,
  request: LeaveRequest,
) {
  if (request.school !== actor.school) return false;
  if (actor.role === "teacher")
    return (
      request.kind === "student" &&
      request.status === "Pending Teacher" &&
      request.subject !== actor.person &&
      request.reviewer === actor.person &&
      !!request.section &&
      teacherSections(school, actor.person).has(request.section)
    );
  if (actor.role === "school-admin") return request.status === "Pending Admin";
  return false;
}

export function decideLeave(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  id: string,
  decision: LeaveDecision,
  note: string,
  now: string,
): LeaveState {
  const request = findRequest(state, actor, id);
  const remarks = note.trim();
  if (actor.role === "teacher") {
    requireRule(
      request.kind === "student",
      request.subject === actor.person
        ? "You cannot approve your own leave."
        : "Teacher leave is reviewed by the School Admin.",
    );
  } else
    requireRule(
      actor.role === "school-admin",
      "Only class teachers and the School Admin can review leave.",
    );
  requireRule(
    canReview(school, actor, request),
    actor.role === "teacher"
      ? "This request is not awaiting your review for one of your classes."
      : "This request is not awaiting a School Admin decision.",
  );
  requireRule(
    decision !== "forward" || actor.role === "teacher",
    "Only the class teacher can forward a request to the School Admin.",
  );
  requireRule(
    decision !== "reject" || remarks.length >= 3,
    "Give a reason for rejecting this request.",
  );
  requireRule(remarks.length <= 500, "Keep remarks under 500 characters.");
  const records = leaveSchool(state, actor.school);
  if (decision === "approve")
    assertNoOverlap(records.requests, request, ["Approved"]);
  const status: LeaveStatus =
    decision === "approve"
      ? "Approved"
      : decision === "reject"
        ? "Rejected"
        : "Pending Admin";
  const updated: LeaveRequest = {
    ...request,
    status,
    reviewer:
      decision === "forward" ? schoolAdminId(actor.school) : request.reviewer,
    remarks: remarks || request.remarks,
    updated: now,
    history: [
      ...request.history,
      {
        at: now,
        actor: actor.person,
        role: actor.role,
        action:
          decision === "approve"
            ? "Approved"
            : decision === "reject"
              ? "Rejected"
              : "Forwarded",
        status,
        note: remarks || undefined,
      },
    ],
  };
  const name = personName(school, request.subject);
  const by =
    actor.role === "teacher"
      ? personName(school, actor.person)
      : "the School Admin";
  const summary = request.type + " for " + formatRange(request);
  const base = {
    kind: "leave" as const,
    created: now,
    request: request.id,
    student: request.kind === "student" ? request.subject : undefined,
  };
  const recipients =
    request.kind === "teacher"
      ? [{ recipient: request.subject, recipientRole: "teacher" as NoticeRole }]
      : familyRecipients(school, request);
  const notices: NoticeDraft[] =
    decision === "forward"
      ? [
          {
            ...base,
            recipient: schoolAdminId(actor.school),
            recipientRole: "school-admin",
            title: "Student leave escalated",
            message:
              by +
              " forwarded " +
              name +
              "'s " +
              summary +
              " for a final decision." +
              (remarks ? " Remarks: " + remarks : ""),
          },
          ...recipients.map((item) => ({
            ...base,
            ...item,
            title: "Leave forwarded to School Admin",
            message:
              name +
              "'s " +
              summary +
              " was forwarded by the class teacher for a final decision.",
          })),
        ]
      : recipients.map((item) => ({
          ...base,
          ...item,
          title: decision === "approve" ? "Leave approved" : "Leave rejected",
          message:
            (request.kind === "teacher" ? "Your " : name + "'s ") +
            summary +
            " was " +
            (decision === "approve" ? "approved" : "rejected") +
            " by " +
            by +
            "." +
            (remarks ? " Remarks: " + remarks : ""),
        }));
  return withSchool(state, actor.school, (current) =>
    addNotices(
      {
        ...current,
        requests: current.requests.map((item) =>
          item.id === id ? updated : item,
        ),
      },
      actor.school,
      request.id,
      notices,
    ),
  );
}

export function canCancel(actor: LeaveActor, request: LeaveRequest) {
  return (
    request.school === actor.school &&
    request.submittedBy === actor.person &&
    request.submittedRole === actor.role &&
    (request.status === "Draft" || pendingStatuses.includes(request.status))
  );
}

export function cancelLeave(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  id: string,
  note: string,
  now: string,
): LeaveState {
  const request = findRequest(state, actor, id);
  requireRule(
    request.submittedBy === actor.person &&
      request.submittedRole === actor.role,
    "Only the person who submitted this request can cancel it.",
  );
  requireRule(
    request.status === "Draft" || pendingStatuses.includes(request.status),
    "Only drafts and pending requests can be cancelled.",
  );
  if (actor.role === "parent")
    requireRule(
      linkedStudents(school, actor.person).some(
        (item) => item.id === request.subject,
      ),
      "Parents can only manage leave for their linked children.",
    );
  const wasPending = request.status !== "Draft";
  const updated: LeaveRequest = {
    ...request,
    status: "Cancelled",
    updated: now,
    history: [
      ...request.history,
      {
        at: now,
        actor: actor.person,
        role: actor.role,
        action: "Cancelled",
        status: "Cancelled",
        note: note.trim() || undefined,
      },
    ],
  };
  return withSchool(state, actor.school, (current) => {
    const next = {
      ...current,
      requests: current.requests.map((item) =>
        item.id === id ? updated : item,
      ),
    };
    if (!wasPending) return next;
    return addNotices(next, actor.school, request.id, [
      {
        kind: "leave",
        created: now,
        request: request.id,
        student: request.kind === "student" ? request.subject : undefined,
        recipient: request.reviewer,
        recipientRole: request.reviewer.endsWith("-admin")
          ? "school-admin"
          : "teacher",
        title: "Leave request cancelled",
        message:
          personName(school, request.subject) +
          "'s " +
          request.type +
          " for " +
          formatRange(request) +
          " was cancelled by the submitter.",
      },
    ]);
  });
}

/* ------------------------------------------------------------------ */
/* Teacher leave: affected sessions and substitute planning           */
/* ------------------------------------------------------------------ */

export type AffectedSession = {
  key: string;
  date: string;
  day: string;
  session: Entry<"sessions">;
  subject: string;
  section: string;
};

function inHalf(duration: LeaveDuration, start: string) {
  if (duration === "First half") return start < "12:00";
  if (duration === "Second half") return start >= "12:00";
  return true;
}

/** Scheduled teaching sessions that fall inside a teacher's leave. */
export function affectedSessions(
  school: AcademicSchool,
  teacher: string,
  start: string,
  end: string,
  duration: LeaveDuration = "Full day",
): AffectedSession[] {
  const allocations = school.allocations.filter(
    (item) => item.teacher === teacher,
  );
  const open = new Set(openSections(school).map((item) => item.id));
  return datesBetween(start, end).flatMap((date) => {
    const day = weekdayName(date);
    return school.sessions
      .filter(
        (session) => session.day === day && inHalf(duration, session.start),
      )
      .flatMap((session) => {
        const allocation = allocations.find(
          (item) => item.id === session.allocation && open.has(item.section),
        );
        return allocation
          ? [
              {
                key: date + "|" + session.id,
                date,
                day,
                session,
                subject: allocation.subject,
                section: allocation.section,
              },
            ]
          : [];
      })
      .sort((a, b) => a.session.start.localeCompare(b.session.start));
  });
}

/** Active colleagues free at that time and not on approved leave that day. */
export function substituteOptions(
  school: AcademicSchool,
  leave: LeaveSchool,
  teacher: string,
  slot: Pick<AffectedSession, "date" | "day" | "session">,
) {
  return school.teachers.filter((candidate) => {
    if (candidate.id === teacher || candidate.status !== "Active") return false;
    const busy = school.sessions.some((session) => {
      if (session.day !== slot.day) return false;
      const allocation = school.allocations.find(
        (item) => item.id === session.allocation,
      );
      return (
        allocation?.teacher === candidate.id &&
        session.start < slot.session.end &&
        session.end > slot.session.start
      );
    });
    const away = leave.requests.some(
      (item) =>
        item.kind === "teacher" &&
        item.subject === candidate.id &&
        item.status === "Approved" &&
        coversDate(item, slot.date),
    );
    return !busy && !away;
  });
}

export function planSubstitute(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  id: string,
  key: string,
  substitute: string,
  now: string,
): LeaveState {
  requireRule(
    actor.role === "school-admin",
    "Only the School Admin can plan substitute cover.",
  );
  const request = findRequest(state, actor, id);
  requireRule(
    request.kind === "teacher" &&
      (request.status === "Pending Admin" || request.status === "Approved"),
    "Plan cover for pending or approved teacher leave.",
  );
  const slot = affectedSessions(
    school,
    request.subject,
    request.start,
    request.end,
    request.duration,
  ).find((item) => item.key === key);
  requireRule(slot, "This session is not affected by the leave.");
  if (substitute)
    requireRule(
      substituteOptions(
        school,
        leaveSchool(state, actor.school),
        request.subject,
        slot,
      ).some((item) => item.id === substitute),
      "Choose a teacher who is free for this session.",
    );
  const plan = { ...request.plan };
  if (substitute) plan[key] = substitute;
  else delete plan[key];
  return withSchool(state, actor.school, (current) => ({
    ...current,
    requests: current.requests.map((item) =>
      item.id === id
        ? {
            ...item,
            plan,
            updated: now,
            history: [
              ...item.history,
              {
                at: now,
                actor: actor.person,
                role: actor.role,
                action: "Substitute planned" as const,
                status: item.status,
                note:
                  slot.date +
                  " " +
                  slot.session.start +
                  " → " +
                  (substitute ? personName(school, substitute) : "unassigned"),
              },
            ],
          }
        : item,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

const newestFirst = (a: LeaveRequest, b: LeaveRequest) =>
  b.created.localeCompare(a.created);

/** Requests the actor applied for or follows (never another school's). */
export function leaveRequestsFor(
  leave: LeaveSchool,
  school: AcademicSchool,
  actor: LeaveActor,
) {
  const mine = leave.requests.filter((item) => {
    if (item.school !== actor.school) return false;
    switch (actor.role) {
      case "student":
        return (
          item.kind === "student" &&
          item.subject === actor.person &&
          (item.status !== "Draft" || item.submittedBy === actor.person)
        );
      case "parent":
        return (
          item.kind === "student" &&
          item.subject === actor.child &&
          linkedStudents(school, actor.person).some(
            (child) => child.id === actor.child,
          ) &&
          (item.status !== "Draft" || item.submittedBy === actor.person)
        );
      case "teacher":
        return item.kind === "teacher" && item.subject === actor.person;
      case "school-admin":
        return item.status !== "Draft";
      default:
        return false;
    }
  });
  return mine.sort(newestFirst);
}

/** Student leave a teacher can see: their classes, excluding drafts. */
export function teacherInbox(
  leave: LeaveSchool,
  school: AcademicSchool,
  actor: LeaveActor,
) {
  if (actor.role !== "teacher") return [];
  const sections = teacherSections(school, actor.person);
  return leave.requests
    .filter(
      (item) =>
        item.school === actor.school &&
        item.kind === "student" &&
        item.status !== "Draft" &&
        !!item.section &&
        sections.has(item.section) &&
        (item.reviewer === actor.person ||
          item.history.some((event) => event.actor === actor.person)),
    )
    .sort(newestFirst);
}

/** Requests waiting on this actor's decision. */
export function pendingApprovals(
  leave: LeaveSchool,
  school: AcademicSchool,
  actor: LeaveActor,
) {
  return leave.requests
    .filter((item) => canReview(school, actor, item))
    .sort(newestFirst);
}

export function studentLeaveHistory(leave: LeaveSchool, student: string) {
  return leave.requests
    .filter(
      (item) =>
        item.kind === "student" &&
        item.subject === student &&
        item.status !== "Draft",
    )
    .sort(newestFirst);
}

export function teacherLeaveHistory(leave: LeaveSchool, teacher: string) {
  return leave.requests
    .filter(
      (item) =>
        item.kind === "teacher" &&
        item.subject === teacher &&
        item.status !== "Draft",
    )
    .sort(newestFirst);
}

export function approvedLeaveOn(
  leave: LeaveSchool,
  kind: LeaveKind,
  subject: string,
  date: string,
) {
  return leave.requests.find(
    (item) =>
      item.kind === kind &&
      item.subject === subject &&
      item.status === "Approved" &&
      coversDate(item, date),
  );
}

export function pendingLeaveOn(
  leave: LeaveSchool,
  kind: LeaveKind,
  subject: string,
  date: string,
) {
  return leave.requests.find(
    (item) =>
      item.kind === kind &&
      item.subject === subject &&
      pendingStatuses.includes(item.status) &&
      coversDate(item, date),
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

export function notificationsFor(
  leave: LeaveSchool,
  school: AcademicSchool,
  actor: LeaveActor,
) {
  const children =
    actor.role === "parent"
      ? new Set(linkedStudents(school, actor.person).map((item) => item.id))
      : undefined;
  return leave.notifications
    .filter((item) => {
      if (item.school !== actor.school) return false;
      switch (actor.role) {
        case "student":
          return (
            item.recipientRole === "student" && item.recipient === actor.person
          );
        case "parent":
          return (
            item.recipientRole === "parent" &&
            item.recipient === actor.person &&
            (!item.student || children!.has(item.student))
          );
        case "teacher":
          return (
            item.recipientRole === "teacher" && item.recipient === actor.person
          );
        case "school-admin":
          return item.recipientRole === "school-admin";
        default:
          return false;
      }
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

export function absenceAlertsFor(
  leave: LeaveSchool,
  school: AcademicSchool,
  actor: LeaveActor,
  student?: string,
) {
  return notificationsFor(leave, school, actor).filter(
    (item) => item.kind === "absence" && (!student || item.student === student),
  );
}

/** Marks the given notifications read, limited to those the actor can see. */
export function markNotificationsRead(
  state: LeaveState,
  school: AcademicSchool,
  actor: LeaveActor,
  ids: string[] | "all",
): LeaveState {
  const visible = new Set(
    notificationsFor(leaveSchool(state, actor.school), school, actor)
      .filter((item) => ids === "all" || ids.includes(item.id))
      .filter((item) => !item.read)
      .map((item) => item.id),
  );
  if (!visible.size) return state;
  return withSchool(state, actor.school, (current) => ({
    ...current,
    notifications: current.notifications.map((item) =>
      visible.has(item.id) ? { ...item, read: true } : item,
    ),
  }));
}

/* ------------------------------------------------------------------ */
/* Absence alerts                                                     */
/* ------------------------------------------------------------------ */

function classShort(school: AcademicSchool, section: string) {
  const group = school.sections.find((item) => item.id === section);
  return group ? group.grade + "-" + group.name : "class";
}

export function absenceMessage(
  school: AcademicSchool,
  student: string,
  section: string,
  date: string,
) {
  const first = personName(school, student).split(" ")[0];
  return (
    "Attendance Alert: " +
    first +
    " was marked absent in " +
    classShort(school, section) +
    " on " +
    longDate(date) +
    ". View attendance or submit a leave request."
  );
}

/**
 * Reconciles parent absence alerts with saved attendance. Idempotent:
 * re-saving the same record never duplicates an alert. Absent → Present/Late
 * resolves the alert as corrected; back to Absent reactivates it. Only
 * guardians linked to the student, in the same school, are notified.
 */
export function syncAbsenceAlerts(
  state: LeaveState,
  school: AcademicSchool,
  schoolId: SchoolId,
  now: string,
  scope?: { section: string; date: string },
): LeaveState {
  const records = leaveSchool(state, schoolId);
  const notifications = [...records.notifications];
  let changed = false;
  for (const record of school.attendance) {
    if (
      scope &&
      (record.section !== scope.section || record.date !== scope.date)
    )
      continue;
    for (const [student, mark] of Object.entries(record.marks)) {
      for (const guardian of guardiansOf(school, student)) {
        const key = [
          "absence",
          record.section,
          record.date,
          student,
          guardian,
        ].join("|");
        const index = notifications.findIndex(
          (item) => item.key === key && item.school === schoolId,
        );
        const existing = index >= 0 ? notifications[index] : undefined;
        if (mark === "Absent") {
          if (!existing) {
            notifications.unshift({
              id: schoolId + "-" + key,
              school: schoolId,
              recipient: guardian,
              recipientRole: "parent",
              kind: "absence",
              title: "Attendance alert",
              message: absenceMessage(
                school,
                student,
                record.section,
                record.date,
              ),
              created: now,
              read: false,
              student,
              key,
              section: record.section,
              date: record.date,
              state: "Active",
            });
            changed = true;
          } else if (existing.state !== "Active") {
            notifications[index] = {
              ...existing,
              title: "Attendance alert",
              message: absenceMessage(
                school,
                student,
                record.section,
                record.date,
              ),
              state: "Active",
              read: false,
              created: now,
            };
            changed = true;
          }
        } else if (existing && existing.state === "Active") {
          notifications[index] = {
            ...existing,
            title: "Attendance corrected",
            message:
              personName(school, student).split(" ")[0] +
              "'s attendance in " +
              classShort(school, record.section) +
              " on " +
              longDate(record.date) +
              " was corrected to " +
              mark +
              ". No action is needed.",
            state: "Resolved",
            read: false,
            created: now,
          };
          changed = true;
        }
      }
    }
  }
  if (!changed) return state;
  return withSchool(state, schoolId, (current) => ({
    ...current,
    notifications,
  }));
}

/* ------------------------------------------------------------------ */
/* Attendance with leave                                              */
/* ------------------------------------------------------------------ */

export type EffectiveMark = "Present" | "Late" | "Absent" | "Approved Leave";

export function studentAttendanceWithLeave(
  school: AcademicSchool,
  leave: LeaveSchool,
  student: string,
) {
  const approved = leave.requests.filter(
    (item) =>
      item.kind === "student" &&
      item.subject === student &&
      item.status === "Approved",
  );
  const rows = school.attendance
    .flatMap((record) => {
      const mark = record.marks[student];
      if (!mark) return [];
      const covering = approved.find((item) => coversDate(item, record.date));
      const effective: EffectiveMark =
        mark === "Absent" && covering ? "Approved Leave" : mark;
      return [
        {
          date: record.date,
          section: record.section,
          mark,
          effective,
          leave: covering,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const count = (value: EffectiveMark) =>
    rows.filter((row) => row.effective === value).length;
  const present = count("Present");
  const late = count("Late");
  return {
    rows,
    present,
    late,
    absent: count("Absent"),
    excused: count("Approved Leave"),
    physical: rows.length
      ? Math.round((100 * (present + late)) / rows.length)
      : undefined,
    approvedRequests: approved.length,
    approvedLeaveDays: approved.reduce(
      (sum, item) => sum + leaveLength(item),
      0,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Analytics                                                          */
/* ------------------------------------------------------------------ */

export function leaveAnalytics(
  leave: LeaveSchool,
  school: AcademicSchool,
  today: string,
) {
  const submitted = leave.requests.filter((item) => item.status !== "Draft");
  const month = today.slice(0, 7);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (5 - index), 1),
    );
    return date.toISOString().slice(0, 7);
  });
  const student = submitted.filter((item) => item.kind === "student");
  const teacher = submitted.filter((item) => item.kind === "teacher");
  return {
    pendingStudent: student.filter((item) =>
      pendingStatuses.includes(item.status),
    ).length,
    pendingTeacher: teacher.filter((item) => item.status === "Pending Admin")
      .length,
    escalated: student.filter((item) => item.status === "Pending Admin").length,
    approvedThisMonth: submitted.filter(
      (item) =>
        item.status === "Approved" &&
        (item.start.slice(0, 7) === month || item.end.slice(0, 7) === month),
    ).length,
    rejected: submitted.filter((item) => item.status === "Rejected").length,
    trend: {
      labels: months.map((value) =>
        monthNames[+value.slice(5, 7) - 1].slice(0, 3),
      ),
      values: months.map(
        (value) =>
          submitted.filter((item) => item.start.slice(0, 7) === value).length,
      ),
    },
    classes: openSections(school).map((section) => {
      const rows = student.filter((item) => item.section === section.id);
      return {
        section: section.id,
        label: section.grade + " · " + section.name,
        requests: rows.length,
        approved: rows.filter((item) => item.status === "Approved").length,
        pending: rows.filter((item) => pendingStatuses.includes(item.status))
          .length,
        rejected: rows.filter((item) => item.status === "Rejected").length,
        days: rows
          .filter((item) => item.status === "Approved")
          .reduce((sum, item) => sum + leaveLength(item), 0),
      };
    }),
    teachers: school.teachers.map((item) => {
      const own = teacher.filter((request) => request.subject === item.id);
      const approved = own.filter((request) => request.status === "Approved");
      const current = approved.find((request) => coversDate(request, today));
      const upcoming = approved
        .filter((request) => request.start > today)
        .sort((a, b) => a.start.localeCompare(b.start))[0];
      return {
        teacher: item,
        status:
          item.status !== "Active"
            ? ("Inactive" as const)
            : current
              ? ("On leave today" as const)
              : upcoming
                ? ("Leave upcoming" as const)
                : ("Available" as const),
        current,
        upcoming,
        pending: own.filter((request) => request.status === "Pending Admin")
          .length,
        days: approved.reduce((sum, request) => sum + leaveLength(request), 0),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                        */
/* ------------------------------------------------------------------ */

export function decodeLeaveState(
  raw: string | null,
  seed: LeaveState,
): LeaveState {
  if (!raw) return seed;
  try {
    const data = JSON.parse(raw) as LeaveState;
    if (data?.version !== 1 || !data.schools) return seed;
    const valid = Object.keys(seed.schools).every((id) => {
      const school = data.schools[id as SchoolId];
      return (
        school &&
        Array.isArray(school.requests) &&
        school.requests.every(
          (row) =>
            row &&
            typeof row.id === "string" &&
            row.school === id &&
            (row.kind === "student" || row.kind === "teacher") &&
            typeof row.subject === "string" &&
            typeof row.submittedBy === "string" &&
            typeof row.reviewer === "string" &&
            includes(leaveStatuses, row.status) &&
            includes(leaveTypes, row.type) &&
            includes(leaveDurations, row.duration) &&
            validDate(row.start) &&
            validDate(row.end) &&
            typeof row.reason === "string" &&
            row.plan &&
            typeof row.plan === "object" &&
            Array.isArray(row.history),
        ) &&
        Array.isArray(school.notifications) &&
        school.notifications.every(
          (row) =>
            row &&
            typeof row.id === "string" &&
            row.school === id &&
            typeof row.recipient === "string" &&
            typeof row.message === "string" &&
            typeof row.read === "boolean",
        )
      );
    });
    return valid ? data : seed;
  } catch {
    return seed;
  }
}

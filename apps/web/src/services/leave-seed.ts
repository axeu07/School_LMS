import type { SchoolId } from "@/types/demo";
import { academicSeed } from "./academic-seed";
import type { AcademicSchool } from "./academic-model";
import {
  cancelLeave,
  createLeaveRequest,
  decideLeave,
  decodeLeaveState,
  planSubstitute,
  affectedSessions,
  syncAbsenceAlerts,
  type LeaveActor,
  type LeaveInput,
  type LeaveState,
} from "./leave-model";

/**
 * Fictional leave records for every demo school, created through the same
 * commands the UI uses so the seed always obeys the business rules.
 * Covers every status: Draft, Pending Teacher, Pending Admin, Approved,
 * Rejected and Cancelled, for student, parent and teacher submitters.
 */
function seedSchool(
  state: LeaveState,
  id: SchoolId,
  school: AcademicSchool,
): LeaveState {
  const s0 = id + "-student-0";
  const s1 = id + "-student-1";
  const actors = {
    s0: { role: "student", school: id, person: s0 },
    s1: { role: "student", school: id, person: s1 },
    parent0: { role: "parent", school: id, person: id + "-parent", child: s0 },
    parent1: { role: "parent", school: id, person: id + "-parent", child: s1 },
    teacher: { role: "teacher", school: id, person: id + "-teacher" },
    teacher2: { role: "teacher", school: id, person: id + "-teacher-2" },
    admin: { role: "school-admin", school: id, person: id + "-admin" },
  } satisfies Record<string, LeaveActor>;
  let next = state;
  const create = (
    key: string,
    actor: LeaveActor,
    input: Omit<LeaveInput, "subject"> & { subject?: string },
    now: string,
    draft = false,
  ) => {
    next = createLeaveRequest(
      next,
      school,
      actor,
      {
        subject: actor.role === "parent" ? actor.child! : actor.person,
        ...input,
      },
      { id: id + "-leave-" + key, now, draft },
    );
    return id + "-leave-" + key;
  };
  const decide = (
    request: string,
    actor: LeaveActor,
    decision: "approve" | "reject" | "forward",
    note: string,
    now: string,
  ) => {
    next = decideLeave(next, school, actor, request, decision, note, now);
  };

  // September: approved medical appointment (student).
  const r8 = create(
    "sep-medical",
    actors.s0,
    {
      type: "Medical Appointment",
      start: "2026-09-22",
      end: "2026-09-22",
      duration: "Second half",
      reason: "Eye examination at the clinic in the afternoon.",
    },
    "2026-09-18T08:40",
  );
  decide(
    r8,
    actors.teacher,
    "approve",
    "Approved. Collect the class notes on return.",
    "2026-09-18T12:05",
  );

  // October: parent request escalated to and approved by the admin.
  const r7 = create(
    "oct-sick",
    actors.parent1,
    {
      type: "Sick Leave",
      start: "2026-10-14",
      end: "2026-10-16",
      duration: "Full day",
      reason: "Seasonal flu with fever; the doctor advised three days of rest.",
      contact: "Reachable on the family phone after 10:00.",
      attachment: { name: "doctor-note-demo.pdf", kind: "PDF", size: "112 KB" },
    },
    "2026-10-13T19:20",
  );
  decide(
    r7,
    actors.teacher,
    "forward",
    "Three consecutive days; forwarding for the record.",
    "2026-10-14T08:10",
  );
  decide(
    r7,
    actors.admin,
    "approve",
    "Approved. Wishing a quick recovery.",
    "2026-10-14T11:30",
  );

  // November: student request rejected by the class teacher.
  const r4 = create(
    "nov-personal",
    actors.s0,
    {
      type: "Personal Leave",
      start: "2026-11-06",
      end: "2026-11-06",
      duration: "Full day",
      reason: "Attending a cousin's school annual day performance.",
    },
    "2026-11-03T17:45",
  );
  decide(
    r4,
    actors.teacher,
    "reject",
    "A practical assessment is scheduled that day. Please speak to me about rescheduling.",
    "2026-11-04T09:15",
  );

  // November: parent sick leave approved (no attendance records on those dates).
  const r3 = create(
    "nov-sick",
    actors.parent0,
    {
      type: "Sick Leave",
      start: "2026-11-12",
      end: "2026-11-13",
      duration: "Full day",
      reason: "Stomach infection; resting at home on the doctor's advice.",
      attachment: {
        name: "clinic-receipt-demo.jpg",
        kind: "JPG",
        size: "248 KB",
      },
    },
    "2026-11-11T21:05",
  );
  decide(
    r3,
    actors.teacher,
    "approve",
    "Get well soon. Notes are on the course page.",
    "2026-11-12T07:55",
  );

  // Cancelled by the student.
  const r5 = create(
    "nov-cancelled",
    actors.s1,
    {
      type: "Personal Leave",
      start: "2026-11-27",
      end: "2026-11-27",
      duration: "Full day",
      reason: "Family trip planned for the long weekend.",
    },
    "2026-11-18T16:30",
  );
  next = cancelLeave(
    next,
    school,
    actors.s1,
    r5,
    "Plans changed.",
    "2026-11-19T18:00",
  );

  // Pending the class teacher (student, half day).
  create(
    "nov-dentist",
    actors.s0,
    {
      type: "Medical Appointment",
      start: "2026-11-26",
      end: "2026-11-26",
      duration: "First half",
      reason:
        "Dental check-up booked for the morning; I will attend classes after lunch.",
      attachment: {
        name: "appointment-slip-demo.pdf",
        kind: "PDF",
        size: "84 KB",
      },
    },
    "2026-11-21T10:15",
  );

  // Parent request forwarded by the teacher → pending admin.
  const r2 = create(
    "dec-family",
    actors.parent1,
    {
      type: "Family Emergency",
      start: "2026-12-03",
      end: "2026-12-04",
      duration: "Full day",
      reason: "Travelling to support a grandparent who is in hospital.",
      contact: "Please call the secondary guardian if urgent.",
    },
    "2026-11-20T20:40",
  );
  decide(
    r2,
    actors.teacher,
    "forward",
    "Overlaps the unit test on 4 December. Forwarding for an admin decision on a make-up test.",
    "2026-11-21T08:30",
  );

  // Parent draft, not yet submitted.
  create(
    "dec-draft",
    actors.parent0,
    {
      type: "Other",
      start: "2026-12-14",
      end: "2026-12-15",
      duration: "Full day",
      reason: "Family function out of town; travel dates to be confirmed.",
    },
    "2026-11-22T09:00",
    true,
  );

  // Teacher leave: approved with substitute cover, rejected, and pending.
  const t2 = create(
    "teacher-nov",
    actors.teacher,
    {
      type: "Personal Leave",
      start: "2026-11-09",
      end: "2026-11-09",
      duration: "Full day",
      reason: "Attending a family wedding out of town.",
      substitute: id + "-teacher-2",
    },
    "2026-11-02T15:00",
  );
  decide(
    t2,
    actors.admin,
    "approve",
    "Approved. Cover has been arranged for your Monday classes.",
    "2026-11-03T10:00",
  );
  for (const slot of affectedSessions(
    school,
    id + "-teacher",
    "2026-11-09",
    "2026-11-09",
  ))
    next = planSubstitute(
      next,
      school,
      actors.admin,
      t2,
      slot.key,
      id + "-teacher-2",
      "2026-11-03T10:05",
    );

  const t3 = create(
    "teacher-oct",
    actors.teacher,
    {
      type: "Other",
      start: "2026-10-05",
      end: "2026-10-05",
      duration: "Full day",
      reason: "Attending an external curriculum workshop.",
    },
    "2026-09-28T14:10",
  );
  decide(
    t3,
    actors.admin,
    "reject",
    "Overlaps the mid-term exams. Please choose another workshop date.",
    "2026-09-29T09:20",
  );

  create(
    "teacher-medical",
    actors.teacher,
    {
      type: "Medical Appointment",
      start: "2026-11-30",
      end: "2026-11-30",
      duration: "Full day",
      reason: "Scheduled minor procedure; the doctor advised a day of rest.",
      substitute: id + "-teacher-2",
    },
    "2026-11-22T18:30",
  );

  const t4 = create(
    "teacher2-sick",
    actors.teacher2,
    {
      type: "Sick Leave",
      start: "2026-11-23",
      end: "2026-11-24",
      duration: "Full day",
      reason: "Recovering from a viral fever.",
    },
    "2026-11-22T07:30",
  );
  decide(
    t4,
    actors.admin,
    "approve",
    "Approved. Rest well.",
    "2026-11-22T08:15",
  );

  // Parent absence alerts for the seeded attendance.
  next = syncAbsenceAlerts(next, school, id, "2026-11-19T15:30");

  // Older notifications have been read.
  return {
    ...next,
    schools: {
      ...next.schools,
      [id]: {
        ...next.schools[id],
        notifications: next.schools[id].notifications.map((item) => ({
          ...item,
          read: item.created < "2026-11-15",
        })),
      },
    },
  };
}

function buildSeed(): LeaveState {
  let state: LeaveState = {
    version: 1,
    schools: {
      westfield: { requests: [], notifications: [] },
      harborview: { requests: [], notifications: [] },
      cedar: { requests: [], notifications: [] },
    },
  };
  for (const [id, school] of Object.entries(academicSeed.schools))
    state = seedSchool(state, id as SchoolId, school);
  return state;
}

export const leaveSeed = buildSeed();

export function decodeLeave(raw: string | null) {
  return decodeLeaveState(raw, leaveSeed);
}

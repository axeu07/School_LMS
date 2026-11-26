import { academicRecords } from "@/mocks/academics";
import type { SchoolId } from "@/types/demo";
import {
  eventCategories,
  generateSlots,
  type PtmBooking,
  type PtmSlot,
  type SchoolEvent,
} from "./calendar-model";
import {
  messageTopics,
  type Conversation,
  type Message,
} from "./messaging-model";
import type { AssignmentActor } from "./assignment-model";
import { markRead, type AppNotification } from "./notification-model";

/**
 * Shared, versioned demo records for the School Calendar, PTM booking and
 * Teacher–Parent Messaging modules. One store keeps cross-module changes
 * (a booking plus its notifications) atomic.
 */
export type CommunicationSchool = {
  events: SchoolEvent[];
  ptmSlots: PtmSlot[];
  ptmBookings: PtmBooking[];
  conversations: Conversation[];
  messages: Message[];
  notifications: AppNotification[];
};
export type CommunicationState = {
  version: 1;
  schools: Record<SchoolId, CommunicationSchool>;
};

/* ---------- Seed ---------- */

const created = "2026-11-02T04:30:00.000Z";

function seedSchool(schoolId: SchoolId): CommunicationSchool {
  const source = academicRecords.find((item) => item.schoolId === schoolId)!;
  const p = schoolId;
  const year = p + "-year";
  const [first, second] = source.classes;
  const [child0, child1] = source.learners;
  const teacher = source.teacher.id;
  const parent = source.parent.id;
  const admin = source.admin.id;
  const everyone = ["teacher", "student", "parent"] as SchoolEvent["audience"];
  const event = (
    id: string,
    values: Partial<SchoolEvent> &
      Pick<SchoolEvent, "title" | "category" | "startDate">,
  ): SchoolEvent => ({
    id: p + "-event-" + id,
    schoolId,
    year,
    description: "",
    endDate: values.startDate,
    startTime: "",
    endTime: "",
    allDay: true,
    location: "",
    meetingUrl: "",
    audience: everyone,
    sections: [],
    organizerId: admin,
    organizerRole: "school-admin",
    status: "Published",
    createdAt: created,
    updatedAt: created,
    publishedAt: created,
    cancelledAt: "",
    cancelReason: "",
    ...values,
  });
  const subject = first.subjects[0];
  const events: SchoolEvent[] = [
    event("founders-day", {
      title: "Founders' Day holiday",
      category: "holiday",
      startDate: "2026-11-30",
      description: "School is closed for Founders' Day.",
    }),
    event("winter-break", {
      title: "Winter break",
      category: "holiday",
      startDate: "2026-12-24",
      endDate: "2027-01-01",
      description: "Classes resume on Saturday 2 January.",
    }),
    event("midterms", {
      title: "Mid-term examinations",
      category: "exam",
      startDate: "2026-12-08",
      endDate: "2026-12-12",
      location: "Examination halls",
      description:
        "Written papers for every subject. The detailed timetable is on the notice board.",
    }),
    event("unit-test", {
      title: subject + " unit test",
      category: "exam",
      startDate: "2026-11-27",
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      location: "Room 105",
      sections: [first.id],
      description: "Covers the first two chapters.",
    }),
    event("ptm", {
      title: "Term 1 parent–teacher meetings",
      category: "ptm",
      startDate: "2026-12-05",
      startTime: "15:00",
      endTime: "17:00",
      allDay: false,
      location: "Classrooms, main building",
      audience: ["teacher", "parent"],
      description:
        "Book a 15-minute appointment with your child's teachers to discuss progress.",
      ptm: { teachers: [teacher], duration: 15 },
    }),
    event("showcase", {
      title: source.events[0].title,
      category: "school-event",
      startDate: "2026-12-15",
      startTime: "10:00",
      endTime: "14:00",
      allDay: false,
      location: "Main campus",
      description: "Students present their projects to families and guests.",
    }),
    event("staff-meeting", {
      title: "Monthly staff meeting",
      category: "teacher-meeting",
      startDate: "2026-11-26",
      startTime: "15:30",
      endTime: "16:30",
      allDay: false,
      location: "Staff room",
      audience: ["teacher"],
      description: "Term planning and PTM preparation.",
    }),
    event("field-trip", {
      title: "Museum field trip",
      category: "class-activity",
      startDate: "2026-12-02",
      location: "City museum",
      sections: [second.id],
      description: "Bring a packed lunch and the signed consent form.",
    }),
    event("project-due", {
      title: "Science project submission",
      category: "deadline",
      startDate: "2026-12-01",
      sections: [first.id],
      description: "Submit the project report and model to the class teacher.",
    }),
    event("sports-meet", {
      title: "Inter-house sports meet",
      category: "school-event",
      startDate: "2026-11-28",
      location: "Sports ground",
      status: "Cancelled",
      cancelledAt: "2026-11-20T06:00:00.000Z",
      cancelReason: "Postponed because the ground is being resurfaced.",
    }),
    event("republic-day", {
      title: "Republic Day assembly",
      category: "school-event",
      startDate: "2027-01-26",
      startTime: "08:30",
      endTime: "10:00",
      allDay: false,
      location: "Assembly hall",
      status: "Draft",
      publishedAt: "",
    }),
    event("reading-circle", {
      title: "Reading circle",
      category: "class-activity",
      startDate: "2026-12-10",
      startTime: "14:00",
      endTime: "15:00",
      allDay: false,
      location: "Library",
      sections: [first.id],
      organizerId: teacher,
      organizerRole: "teacher",
      status: "Proposed",
      publishedAt: "",
      description: "Students read and discuss a short story in small groups.",
    }),
  ];
  // Oak and Ivy is a preschool: same dates, preschool-friendly events.
  if (source.schoolId === "westfield") {
    const preschool: Record<string, Partial<SchoolEvent>> = {
      midterms: {
        title: "Winter carnival week",
        category: "school-event",
        location: "School garden",
        description: "Puppet shows, a fun fair and games for every class.",
      },
      "unit-test": {
        title: "Play-based skills check-in",
        location: "Sunflower room",
        description:
          "A relaxed, play-based check of colours, shapes and counting. No preparation needed.",
      },
      showcase: {
        description:
          "Children show their art, songs and garden projects to families.",
      },
      "field-trip": {
        title: "Visit to the FRI museum",
        location: "Forest Research Institute",
        description:
          "A short morning trip. Send a packed snack and the signed consent form.",
      },
      "project-due": {
        title: "Leaf collection for the nature wall",
        description: "Send five different leaves in a paper bag.",
      },
      "sports-meet": { title: "Little sports day" },
      "reading-circle": {
        title: "Story circle",
        location: "Reading corner",
        description: "Children listen to and act out a picture book.",
      },
    };
    events.forEach((item, index) => {
      const key = Object.keys(preschool).find((id) => item.id.endsWith(id));
      if (key) events[index] = { ...item, ...preschool[key] };
    });
  }
  const ptm = events.find((item) => item.category === "ptm")!;
  const ptmSlots = generateSlots(ptm);
  const booked = ptmSlots[2];
  const ptmBookings: PtmBooking[] = [
    {
      id: p + "-booking-0",
      eventId: ptm.id,
      slotId: booked.id,
      teacherId: teacher,
      parentId: parent,
      studentId: child0.id,
      status: "Confirmed",
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T10:00:00.000Z",
      notes: "",
    },
  ];
  const conversation = (
    id: string,
    student: typeof child0,
    sectionIndex: number,
    values: Pick<Conversation, "topic" | "title" | "status" | "lastMessageAt">,
  ): Conversation => ({
    id: p + "-conversation-" + id,
    schoolId,
    studentId: student.id,
    parentId: parent,
    teacherId: teacher,
    sectionId: source.classes[sectionIndex].id,
    subjects: [source.classes[sectionIndex].subjects[sectionIndex]],
    startedBy: "parent",
    createdAt: "2026-11-19T08:30:00.000Z",
    updatedAt: values.lastMessageAt,
    resolvedAt: values.status === "Resolved" ? values.lastMessageAt : "",
    ...values,
  });
  const conversations = [
    conversation("homework", child0, 0, {
      topic: "Homework",
      title: subject + " practice questions",
      status: "Open",
      lastMessageAt: "2026-11-20T15:10:00.000Z",
    }),
    conversation("attendance", child1, 1, {
      topic: "Attendance",
      title: "Absence on Thursday",
      status: "Resolved",
      lastMessageAt: "2026-11-19T12:40:00.000Z",
    }),
  ];
  const message = (
    conversationIndex: number,
    index: number,
    senderRole: Message["senderRole"],
    messageBody: string,
    createdAt: string,
    readAt: string | null,
  ): Message => ({
    id: conversations[conversationIndex].id + "-message-" + index,
    conversationId: conversations[conversationIndex].id,
    schoolId,
    senderId: senderRole === "parent" ? parent : teacher,
    senderRole,
    messageBody,
    createdAt,
    readAt,
    editedAt: null,
    deletedAt: null,
  });
  const firstName = (name: string) => name.split(" ")[0];
  const messages = [
    message(
      0,
      0,
      "parent",
      "Hello, " +
        firstName(child0.name) +
        " found the last two practice questions difficult. Could you suggest how to approach them?",
      "2026-11-19T08:30:00.000Z",
      "2026-11-19T09:05:00.000Z",
    ),
    message(
      0,
      1,
      "teacher",
      "Thanks for letting me know. Ask " +
        firstName(child0.name) +
        " to start with the worked example in the notes, then try question 4 again. I'll go over it in class on Monday.",
      "2026-11-19T09:20:00.000Z",
      "2026-11-19T17:00:00.000Z",
    ),
    message(
      0,
      2,
      "parent",
      "That helped, thank you. Is there any extra practice we could do over the weekend?",
      "2026-11-20T15:10:00.000Z",
      null,
    ),
    message(
      1,
      0,
      "parent",
      firstName(child1.name) +
        " was unwell on Thursday and missed class. Is there anything to catch up on?",
      "2026-11-19T10:15:00.000Z",
      "2026-11-19T11:00:00.000Z",
    ),
    message(
      1,
      1,
      "teacher",
      "Hope " +
        firstName(child1.name) +
        " is feeling better. The class notes are in My Courses; nothing else to catch up on.",
      "2026-11-19T12:40:00.000Z",
      "2026-11-19T13:00:00.000Z",
    ),
  ];
  const notifications: AppNotification[] = [
    {
      id: "ntf-" + teacher + "-message:" + conversations[0].id + "-seed",
      schoolId,
      recipientId: teacher,
      recipientRole: "teacher",
      kind: "message",
      title: source.parent.name + " (parent of " + child0.name + ")",
      body:
        conversations[0].title +
        " · That helped, thank you. Is there any extra practice we could do over the weekend?",
      href: "/demo/teacher/messages?conversation=" + conversations[0].id,
      contextId: conversations[0].id,
      dedupeKey: "message:" + conversations[0].id,
      createdAt: "2026-11-20T15:10:00.000Z",
      readAt: null,
      count: 1,
    },
    {
      id: "ntf-" + parent + "-ptm:" + ptmBookings[0].id + ":booked",
      schoolId,
      recipientId: parent,
      recipientRole: "parent",
      kind: "ptm",
      title: "PTM booking confirmed",
      body:
        source.teacher.name +
        " · " +
        booked.date +
        ", " +
        booked.start +
        "–" +
        booked.end +
        " · for " +
        child0.name,
      href: "/demo/parent/calendar?tab=ptm",
      contextId: ptmBookings[0].id,
      dedupeKey: "ptm:" + ptmBookings[0].id + ":booked",
      createdAt: "2026-11-18T10:00:00.000Z",
      readAt: "2026-11-18T10:05:00.000Z",
      count: 1,
    },
    {
      id: "ntf-" + admin + "-event:" + p + "-event-reading-circle:proposed",
      schoolId,
      recipientId: admin,
      recipientRole: "school-admin",
      kind: "approval",
      title: "Class activity suggestion: Reading circle",
      body:
        source.teacher.name +
        " suggested an activity for 2026-12-10, 14:00–15:00. Review it in the approval queue.",
      href: "/demo/school-admin/calendar?tab=approvals",
      contextId: p + "-event-reading-circle",
      dedupeKey: "event:" + p + "-event-reading-circle:proposed",
      createdAt: created,
      readAt: null,
      count: 1,
    },
  ];
  return {
    events,
    ptmSlots,
    ptmBookings,
    conversations,
    messages,
    notifications,
  };
}

export const communicationSeed: CommunicationState = {
  version: 1,
  schools: {
    westfield: seedSchool("westfield"),
    harborview: seedSchool("harborview"),
    cedar: seedSchool("cedar"),
  },
};

/* ---------- Storage recovery ---------- */

const isString = (value: unknown) => typeof value === "string";
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (row: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => isString(row[key]));
const stringOrNull = (value: unknown) => value === null || isString(value);

const validators: {
  [K in keyof CommunicationSchool]: (row: Record<string, unknown>) => boolean;
} = {
  events: (row) =>
    strings(row, [
      "id",
      "schoolId",
      "year",
      "title",
      "description",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
      "location",
      "meetingUrl",
      "organizerId",
      "organizerRole",
      "status",
      "createdAt",
      "updatedAt",
      "publishedAt",
      "cancelledAt",
      "cancelReason",
    ]) &&
    eventCategories.includes(row.category as SchoolEvent["category"]) &&
    typeof row.allDay === "boolean" &&
    Array.isArray(row.audience) &&
    Array.isArray(row.sections) &&
    (row.ptm === undefined ||
      (isObject(row.ptm) &&
        Array.isArray(row.ptm.teachers) &&
        Number.isFinite(row.ptm.duration))),
  ptmSlots: (row) =>
    strings(row, ["id", "eventId", "teacherId", "date", "start", "end"]) &&
    typeof row.blocked === "boolean",
  ptmBookings: (row) =>
    strings(row, [
      "id",
      "eventId",
      "slotId",
      "teacherId",
      "parentId",
      "studentId",
      "createdAt",
      "updatedAt",
      "notes",
    ]) &&
    ["Confirmed", "Cancelled", "Completed"].includes(row.status as string),
  conversations: (row) =>
    strings(row, [
      "id",
      "schoolId",
      "studentId",
      "parentId",
      "teacherId",
      "sectionId",
      "title",
      "createdAt",
      "updatedAt",
      "lastMessageAt",
      "resolvedAt",
    ]) &&
    Array.isArray(row.subjects) &&
    messageTopics.includes(row.topic as Conversation["topic"]) &&
    ["Open", "Resolved"].includes(row.status as string) &&
    ["parent", "teacher"].includes(row.startedBy as string),
  messages: (row) =>
    strings(row, [
      "id",
      "conversationId",
      "schoolId",
      "senderId",
      "messageBody",
      "createdAt",
    ]) &&
    ["parent", "teacher"].includes(row.senderRole as string) &&
    stringOrNull(row.readAt) &&
    stringOrNull(row.editedAt) &&
    stringOrNull(row.deletedAt),
  notifications: (row) =>
    strings(row, [
      "id",
      "schoolId",
      "recipientId",
      "recipientRole",
      "kind",
      "title",
      "body",
      "href",
      "contextId",
      "dedupeKey",
      "createdAt",
    ]) &&
    stringOrNull(row.readAt) &&
    Number.isFinite(row.count),
};

/** Falls back to the seed when stored data is missing, corrupt or outdated. */
export function decodeCommunicationState(
  raw: string | null,
): CommunicationState {
  if (!raw) return communicationSeed;
  try {
    const data = JSON.parse(raw) as CommunicationState;
    if (!isObject(data) || data.version !== 1 || !isObject(data.schools))
      return communicationSeed;
    const valid = (Object.keys(communicationSeed.schools) as SchoolId[]).every(
      (id) => {
        const school = data.schools[id];
        return (
          isObject(school) &&
          (Object.keys(validators) as (keyof CommunicationSchool)[]).every(
            (key) =>
              Array.isArray(school[key]) &&
              (school[key] as unknown[]).every(
                (row) => isObject(row) && validators[key](row),
              ),
          )
        );
      },
    );
    return valid ? data : communicationSeed;
  } catch {
    return communicationSeed;
  }
}

/** Marks the actor's notifications read: one id, or all of them. */
export function readNotifications(
  state: CommunicationState,
  actor: AssignmentActor,
  id: string | "all",
  now: Date,
): CommunicationState {
  const school = state.schools[actor.school];
  if (!school) return state;
  const notifications = markRead(
    school.notifications,
    actor,
    (item) => id === "all" || item.id === id,
    now.toISOString(),
  );
  return notifications === school.notifications
    ? state
    : {
        ...state,
        schools: {
          ...state.schools,
          [actor.school]: { ...school, notifications },
        },
      };
}

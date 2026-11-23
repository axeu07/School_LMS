import type { SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  type AcademicSchool,
} from "./academic-model";
import { activeAllocations, type AssignmentActor } from "./assignment-model";
import type {
  CommunicationSchool,
  CommunicationState,
} from "./communication-model";
import { markRead, pushNotification } from "./notification-model";

/* ---------- Types ---------- */

export const messageTopics = [
  "Homework",
  "Attendance",
  "Academic Performance",
  "Student Progress",
  "Parent–Teacher Meeting",
  "General Inquiry",
] as const;
export type MessageTopic = (typeof messageTopics)[number];
export type ConversationStatus = "Open" | "Resolved";
export type Participant = "parent" | "teacher";

export type Conversation = {
  id: string;
  schoolId: SchoolId;
  studentId: string;
  parentId: string;
  teacherId: string;
  /** Section the student was in when the conversation started. */
  sectionId: string;
  /** Subject names the teacher teaches the student, for context. */
  subjects: string[];
  topic: MessageTopic;
  /** Short subject line. */
  title: string;
  status: ConversationStatus;
  startedBy: Participant;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  resolvedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  schoolId: SchoolId;
  senderId: string;
  senderRole: Participant;
  /** Plain text only; always rendered as text, never as HTML. */
  messageBody: string;
  createdAt: string;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
};

export const messageLimit = 2000;
export const titleLimit = 120;

/* ---------- Eligibility ---------- */

export type TeacherContact = {
  teacherId: string;
  name: string;
  subjects: string[];
  sectionId: string;
};
export type ParentContact = {
  parentId: string;
  parentName: string;
  relationship: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  subjects: string[];
};

const subjectName = (records: AcademicSchool, id: string) =>
  records.subjects.find((item) => item.id === id)?.name ?? "Subject";

/** Active teachers allocated to a linked child's current section. */
export function teachersForChild(
  records: AcademicSchool,
  school: SchoolId,
  parentId: string,
  studentId: string,
): TeacherContact[] {
  if (!linkedStudents(records, parentId).some((item) => item.id === studentId))
    return [];
  const section = currentEnrollment(records, studentId)?.section;
  if (!section) return [];
  const contacts = new Map<string, TeacherContact>();
  for (const allocation of activeAllocations(records, {
    role: "student",
    school,
    person: studentId,
  })) {
    const teacher = records.teachers.find(
      (item) => item.id === allocation.teacher && item.status === "Active",
    );
    if (!teacher) continue;
    const entry = contacts.get(teacher.id) ?? {
      teacherId: teacher.id,
      name: teacher.name,
      subjects: [],
      sectionId: section,
    };
    entry.subjects.push(subjectName(records, allocation.subject));
    contacts.set(teacher.id, entry);
  }
  return [...contacts.values()];
}

/** Guardians of students in the teacher's currently assigned sections. */
export function parentsForTeacher(
  records: AcademicSchool,
  school: SchoolId,
  teacherId: string,
): ParentContact[] {
  const allocations = activeAllocations(records, {
    role: "teacher",
    school,
    person: teacherId,
  });
  const out: ParentContact[] = [];
  for (const student of records.students) {
    const section = currentEnrollment(records, student.id)?.section;
    const mine = allocations.filter((item) => item.section === section);
    if (!section || !mine.length) continue;
    for (const link of records.links.filter(
      (item) => item.student === student.id,
    )) {
      const guardian = records.guardians.find(
        (item) => item.id === link.guardian,
      );
      if (!guardian) continue;
      out.push({
        parentId: guardian.id,
        parentName: guardian.name,
        relationship: link.relationship,
        studentId: student.id,
        studentName: student.name,
        sectionId: section,
        subjects: mine.map((item) => subjectName(records, item.subject)),
      });
    }
  }
  return out;
}

export function canConverse(
  records: AcademicSchool,
  school: SchoolId,
  parentId: string,
  studentId: string,
  teacherId: string,
) {
  return teachersForChild(records, school, parentId, studentId).some(
    (item) => item.teacherId === teacherId,
  );
}

function participant(actor: AssignmentActor): Participant {
  requireRule(
    actor.role === "parent" || actor.role === "teacher",
    "Only parents and teachers take part in these conversations.",
  );
  return actor.role;
}

/** Is the actor one of the two participants, in the right child scope? */
export function isParticipant(
  records: AcademicSchool,
  actor: AssignmentActor,
  conversation: Conversation,
) {
  if (conversation.schoolId !== actor.school) return false;
  if (actor.role === "parent")
    return (
      conversation.parentId === actor.person &&
      conversation.studentId === actor.child &&
      linkedStudents(records, actor.person).some(
        (item) => item.id === conversation.studentId,
      )
    );
  if (actor.role === "teacher")
    return (
      conversation.teacherId === actor.person &&
      parentsForTeacher(records, actor.school, actor.person).some(
        (item) => item.studentId === conversation.studentId,
      )
    );
  return false;
}

/* ---------- Reading ---------- */

export type ConversationView = Conversation & {
  unread: number;
  lastMessage?: Message;
};

/**
 * Conversations the actor takes part in. Students, school admins and
 * super admins get none: private content is never listed for them.
 */
export function conversationsFor(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
): ConversationView[] {
  const school = state.schools[actor.school];
  if (!school || (actor.role !== "parent" && actor.role !== "teacher"))
    return [];
  return school.conversations
    .filter((item) => isParticipant(records, actor, item))
    .map((item) => {
      const thread = school.messages.filter(
        (message) => message.conversationId === item.id,
      );
      return {
        ...item,
        unread: thread.filter(
          (message) => message.senderRole !== actor.role && !message.readAt,
        ).length,
        lastMessage: thread.at(-1),
      };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function messagesFor(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  conversationId: string,
) {
  const school = state.schools[actor.school];
  const conversation = school?.conversations.find(
    (item) => item.id === conversationId,
  );
  if (!conversation || !isParticipant(records, actor, conversation)) return [];
  return school.messages
    .filter((item) => item.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function unreadMessageCount(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  return conversationsFor(state, records, actor).reduce(
    (sum, item) => sum + item.unread,
    0,
  );
}

/* ---------- Writing ---------- */

/** Trims, removes control characters and enforces the length limit. */
export function cleanMessage(value: string) {
  const text = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  requireRule(text, "Write a message before sending.");
  requireRule(
    text.length <= messageLimit,
    "Messages can be up to " +
      messageLimit.toLocaleString("en-IN") +
      " characters.",
  );
  return text;
}

function replaceSchool(
  state: CommunicationState,
  school: SchoolId,
  value: CommunicationSchool,
): CommunicationState {
  return { ...state, schools: { ...state.schools, [school]: value } };
}

const preview = (text: string) =>
  text.length > 90 ? text.slice(0, 87).trimEnd() + "…" : text;

function notifyCounterpart(
  school: CommunicationSchool,
  records: AcademicSchool,
  conversation: Conversation,
  sender: Participant,
  text: string,
  createdAt: string,
) {
  const student =
    records.students.find((item) => item.id === conversation.studentId)?.name ??
    "your student";
  const senderName =
    sender === "parent"
      ? (records.guardians.find((item) => item.id === conversation.parentId)
          ?.name ?? "A parent")
      : (records.teachers.find((item) => item.id === conversation.teacherId)
          ?.name ?? "A teacher");
  const recipientRole = sender === "parent" ? "teacher" : "parent";
  return pushNotification(
    school.notifications,
    {
      schoolId: conversation.schoolId,
      recipientId:
        recipientRole === "teacher"
          ? conversation.teacherId
          : conversation.parentId,
      recipientRole,
      kind: "message",
      title:
        senderName +
        (sender === "parent" ? " (parent of " + student + ")" : " (teacher)"),
      body: conversation.title + " · " + preview(text),
      href:
        "/demo/" +
        recipientRole +
        "/messages?conversation=" +
        encodeURIComponent(conversation.id),
      contextId: conversation.id,
      dedupeKey: "message:" + conversation.id,
    },
    createdAt,
    "merge",
  );
}

export type NewConversation = {
  /** Teacher id for parents; parent id for teachers. */
  counterpartId: string;
  /** Required for teachers; parents use their active child. */
  studentId?: string;
  topic: MessageTopic;
  title: string;
  body: string;
};

export function startConversation(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: NewConversation,
  now: Date,
  ids: { conversation: string; message: string },
) {
  const role = participant(actor);
  const school = state.schools[actor.school];
  requireRule(school, "Select a valid school.");
  const studentId = role === "parent" ? actor.child : input.studentId;
  requireRule(studentId, "Select a student.");
  const parentId = role === "parent" ? actor.person : input.counterpartId;
  const teacherId = role === "teacher" ? actor.person : input.counterpartId;
  const contact = teachersForChild(
    records,
    actor.school,
    parentId,
    studentId,
  ).find((item) => item.teacherId === teacherId);
  requireRule(
    contact,
    role === "parent"
      ? "You can only message teachers who teach your child."
      : "You can only message parents of students in your classes.",
  );
  requireRule(messageTopics.includes(input.topic), "Choose a topic.");
  const title = input.title.trim();
  requireRule(
    title.length >= 3 && title.length <= titleLimit,
    "Enter a subject between 3 and " + titleLimit + " characters.",
  );
  const text = cleanMessage(input.body);
  const stamp = now.toISOString();
  const conversation: Conversation = {
    id: ids.conversation,
    schoolId: actor.school,
    studentId,
    parentId,
    teacherId,
    sectionId: contact.sectionId,
    subjects: contact.subjects,
    topic: input.topic,
    title,
    status: "Open",
    startedBy: role,
    createdAt: stamp,
    updatedAt: stamp,
    lastMessageAt: stamp,
    resolvedAt: "",
  };
  requireRule(
    !school.conversations.some((item) => item.id === conversation.id),
    "Try again.",
  );
  const message: Message = {
    id: ids.message,
    conversationId: conversation.id,
    schoolId: actor.school,
    senderId: actor.person,
    senderRole: role,
    messageBody: text,
    createdAt: stamp,
    readAt: null,
    editedAt: null,
    deletedAt: null,
  };
  return replaceSchool(state, actor.school, {
    ...school,
    conversations: [...school.conversations, conversation],
    messages: [...school.messages, message],
    notifications: notifyCounterpart(
      school,
      records,
      conversation,
      role,
      text,
      stamp,
    ),
  });
}

function ownConversation(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
) {
  const school = state.schools[actor.school];
  const conversation = school?.conversations.find((item) => item.id === id);
  requireRule(
    conversation && isParticipant(records, actor, conversation),
    "This conversation is unavailable.",
  );
  return { school, conversation };
}

export function sendMessage(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  conversationId: string,
  body: string,
  now: Date,
  id: string,
) {
  const role = participant(actor);
  const { school, conversation } = ownConversation(
    state,
    records,
    actor,
    conversationId,
  );
  requireRule(
    conversation.status === "Open",
    "This conversation is resolved. Reopen it to reply.",
  );
  requireRule(
    canConverse(
      records,
      actor.school,
      conversation.parentId,
      conversation.studentId,
      conversation.teacherId,
    ),
    "This teacher no longer teaches the student, so new messages can't be sent.",
  );
  const text = cleanMessage(body);
  const stamp = now.toISOString();
  const message: Message = {
    id,
    conversationId,
    schoolId: actor.school,
    senderId: actor.person,
    senderRole: role,
    messageBody: text,
    createdAt: stamp,
    readAt: null,
    editedAt: null,
    deletedAt: null,
  };
  // Replying means the sender has read everything before it.
  const read = school.messages.map((item) =>
    item.conversationId === conversationId &&
    item.senderRole !== role &&
    !item.readAt
      ? { ...item, readAt: stamp }
      : item,
  );
  const updated = { ...conversation, updatedAt: stamp, lastMessageAt: stamp };
  return replaceSchool(state, actor.school, {
    ...school,
    conversations: school.conversations.map((item) =>
      item.id === conversationId ? updated : item,
    ),
    messages: [...read, message],
    notifications: notifyCounterpart(
      {
        ...school,
        notifications: markRead(
          school.notifications,
          actor,
          (item) => item.contextId === conversationId,
          stamp,
        ),
      },
      records,
      updated,
      role,
      text,
      stamp,
    ),
  });
}

/** Marks the other participant's messages and the related alerts read. */
export function markConversationRead(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  conversationId: string,
  now: Date,
) {
  const role = participant(actor);
  const { school } = ownConversation(state, records, actor, conversationId);
  const stamp = now.toISOString();
  let changed = false;
  const messages = school.messages.map((item) => {
    if (
      item.conversationId !== conversationId ||
      item.senderRole === role ||
      item.readAt
    )
      return item;
    changed = true;
    return { ...item, readAt: stamp };
  });
  const notifications = markRead(
    school.notifications,
    actor,
    (item) => item.kind === "message" && item.contextId === conversationId,
    stamp,
  );
  if (!changed && notifications === school.notifications) return state;
  return replaceSchool(state, actor.school, {
    ...school,
    messages,
    notifications,
  });
}

export function setConversationStatus(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
  conversationId: string,
  status: ConversationStatus,
  now: Date,
) {
  participant(actor);
  const { school, conversation } = ownConversation(
    state,
    records,
    actor,
    conversationId,
  );
  requireRule(conversation.status !== status, "Nothing to change.");
  const stamp = now.toISOString();
  return replaceSchool(state, actor.school, {
    ...school,
    conversations: school.conversations.map((item) =>
      item.id === conversationId
        ? {
            ...item,
            status,
            updatedAt: stamp,
            resolvedAt: status === "Resolved" ? stamp : "",
          }
        : item,
    ),
  });
}

/* ---------- School admin overview (no message content) ---------- */

export type CommunicationStats = {
  total: number;
  open: number;
  resolved: number;
  /** Open conversations whose latest message is from a parent. */
  awaitingReply: number;
  unreadMessages: number;
  /** Mean minutes from a parent's first message to the teacher's first reply. */
  averageResponseMinutes?: number;
  responded: number;
  byTeacher: {
    teacherId: string;
    name: string;
    conversations: number;
    awaitingReply: number;
  }[];
  byTopic: { topic: MessageTopic; count: number }[];
};

/**
 * Aggregate figures only. School admins never receive message bodies or
 * subject lines; reading private content would need an explicit, audited
 * access request handled by the backend.
 */
export function communicationStats(
  state: CommunicationState,
  records: AcademicSchool,
  actor: AssignmentActor,
): CommunicationStats {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can view communication statistics.",
  );
  const school = state.schools[actor.school];
  const conversations = school?.conversations ?? [];
  const latest = new Map<string, Message>();
  for (const message of school?.messages ?? []) {
    const current = latest.get(message.conversationId);
    if (!current || current.createdAt <= message.createdAt)
      latest.set(message.conversationId, message);
  }
  const awaiting = (item: Conversation) =>
    item.status === "Open" && latest.get(item.id)?.senderRole === "parent";
  const responseTimes = conversations.flatMap((item) => {
    const thread = (school?.messages ?? [])
      .filter((message) => message.conversationId === item.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const asked = thread.find((message) => message.senderRole === "parent");
    const answered =
      asked &&
      thread.find(
        (message) =>
          message.senderRole === "teacher" &&
          message.createdAt > asked.createdAt,
      );
    return asked && answered
      ? [(Date.parse(answered.createdAt) - Date.parse(asked.createdAt)) / 60000]
      : [];
  });
  const teacherIds = [...new Set(conversations.map((item) => item.teacherId))];
  return {
    total: conversations.length,
    open: conversations.filter((item) => item.status === "Open").length,
    resolved: conversations.filter((item) => item.status === "Resolved").length,
    awaitingReply: conversations.filter(awaiting).length,
    unreadMessages: (school?.messages ?? []).filter((item) => !item.readAt)
      .length,
    averageResponseMinutes: responseTimes.length
      ? Math.round(
          responseTimes.reduce((sum, value) => sum + value, 0) /
            responseTimes.length,
        )
      : undefined,
    responded: responseTimes.length,
    byTeacher: teacherIds.map((teacherId) => ({
      teacherId,
      name:
        records.teachers.find((item) => item.id === teacherId)?.name ??
        "Former teacher",
      conversations: conversations.filter(
        (item) => item.teacherId === teacherId,
      ).length,
      awaitingReply: conversations.filter(
        (item) => item.teacherId === teacherId && awaiting(item),
      ).length,
    })),
    byTopic: messageTopics.map((topic) => ({
      topic,
      count: conversations.filter((item) => item.topic === topic).length,
    })),
  };
}

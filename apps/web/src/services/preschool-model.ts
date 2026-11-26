import type { SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
} from "./academic-model";
import type { AssignmentActor } from "./assignment-model";

/**
 * Day-care records for the preschool: the daily diary, pickup and the gate
 * log, health, emergency contacts and broadcasts, and school transport.
 * Every command checks the actor's relationship to the child, and returns a
 * new state (the store persists it).
 */

/* ========================================================================
   Types
   ======================================================================== */

export const mealLevels = ["All", "Most", "Some", "None"] as const;
export type MealLevel = (typeof mealLevels)[number];
export const meals = ["breakfast", "lunch", "snack"] as const;
export type Meal = (typeof meals)[number];

export const moods = [
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "calm", label: "Calm", emoji: "😌" },
  { key: "sleepy", label: "Sleepy", emoji: "😴" },
  { key: "fussy", label: "Fussy", emoji: "😣" },
  { key: "unwell", label: "Unwell", emoji: "🤒" },
] as const;
export type Mood = (typeof moods)[number]["key"];

export const activityOptions = [
  "Circle time",
  "Story time",
  "Painting",
  "Outdoor play",
  "Music & movement",
  "Blocks & puzzles",
  "Sand & water",
  "Phonics",
  "Numbers",
  "Garden walk",
] as const;

export type Diary = {
  id: string;
  student: string;
  date: string;
  meals: Record<Meal, MealLevel>;
  /** "HH:MM", or "" when the child did not nap. */
  napStart: string;
  napEnd: string;
  mood: Mood;
  potty: number;
  diaper: number;
  activities: string[];
  note: string;
  status: "Draft" | "Sent";
  author: string;
  sentAt?: string;
  readAt?: string;
  /** A short thank-you or reply from the parent. */
  reply?: string;
};

export type PickupPerson = {
  id: string;
  student: string;
  name: string;
  relation: string;
  phone: string;
  /** A small photo as a data URL, or "" to show initials. */
  photo: string;
  status: "Approved" | "Pending approval";
  addedBy: "parent" | "school";
};

/** A one-day pass for someone else collecting the child. */
export type PickupPass = {
  id: string;
  student: string;
  date: string;
  name: string;
  relation: string;
  phone: string;
  time: string;
  note: string;
  otp: string;
  /** Encoded in the QR pass and typed in when scanning is not possible. */
  code: string;
  status: "Active" | "Used" | "Cancelled";
  createdAt: string;
  usedAt?: string;
  verifiedBy?: string;
};

export type GateMethod =
  "Parent" | "Authorised person" | "OTP" | "QR pass" | "School bus";
export type GateEvent = {
  id: string;
  student: string;
  date: string;
  kind: "in" | "out";
  time: string;
  /** Who dropped off or collected the child. */
  person: string;
  method: GateMethod;
  /** Staff member who recorded it. */
  by: string;
};

export type Allergy = {
  id: string;
  name: string;
  severity: "Mild" | "Moderate" | "Severe";
  reaction: string;
  action: string;
};
export type Medicine = {
  id: string;
  name: string;
  dose: string;
  time: string;
  until: string;
  notes: string;
};
export type Vaccination = {
  id: string;
  name: string;
  due: string;
  /** Date given, or "" when pending. */
  given: string;
};
export type HealthProfile = {
  student: string;
  bloodGroup: string;
  conditions: string;
  allergies: Allergy[];
  medicines: Medicine[];
  vaccinations: Vaccination[];
  doctor: { name: string; clinic: string; phone: string };
  updatedAt: string;
};

export const incidentKinds = [
  "Minor injury",
  "Bump to the head",
  "Illness",
  "Allergic reaction",
  "Other",
] as const;
export type Incident = {
  id: string;
  student: string;
  date: string;
  time: string;
  kind: (typeof incidentKinds)[number];
  description: string;
  action: string;
  reportedBy: string;
  status: "Awaiting acknowledgement" | "Acknowledged";
  ackAt?: string;
  ackBy?: string;
  parentNote?: string;
};

export type EmergencyContact = {
  id: string;
  student: string;
  name: string;
  relation: string;
  phone: string;
  /** 1 is called first. */
  priority: number;
};

export const broadcastCategories = [
  "Early closure",
  "Rain / weather",
  "Transport delay",
  "Health",
  "Safety",
  "General",
] as const;
export type Broadcast = {
  id: string;
  title: string;
  message: string;
  category: (typeof broadcastCategories)[number];
  /** "all" or a section id. */
  audience: string;
  channels: string[];
  sentAt: string;
  by: string;
  byId: string;
  /** Guardians who have acknowledged it. */
  acks: string[];
  active: boolean;
};

export type RouteStop = {
  id: string;
  name: string;
  /** Map position, 0–100 × 0–70. */
  x: number;
  y: number;
  /** Morning pickup and afternoon drop times. */
  am: string;
  pm: string;
};
export type BusRoute = {
  id: string;
  name: string;
  /** Map waypoints from the first stop to school; stops are included. */
  path: { x: number; y: number; stop?: string }[];
  stops: RouteStop[];
  /** Trip length in minutes, one way. */
  minutes: number;
};
export type Vehicle = {
  id: string;
  number: string;
  label: string;
  kind: "Bus" | "Van";
  capacity: number;
  driver: string;
  driverPhone: string;
  attendant: string;
  attendantPhone: string;
  tracker: string;
  route: string;
  status: "Active" | "Maintenance";
};
export type Rider = { student: string; vehicle: string; stop: string };
export type TripEvent = {
  id: string;
  vehicle: string;
  student: string;
  date: string;
  time: string;
  kind: "Boarded" | "Reached school" | "Left school" | "Dropped at stop";
  stop: string;
};

export type PreschoolSchool = {
  diaries: Diary[];
  pickupPeople: PickupPerson[];
  passes: PickupPass[];
  gate: GateEvent[];
  health: HealthProfile[];
  incidents: Incident[];
  contacts: EmergencyContact[];
  broadcasts: Broadcast[];
  vehicles: Vehicle[];
  routes: BusRoute[];
  riders: Rider[];
  trips: TripEvent[];
};
export type PreschoolState = {
  version: 1;
  /** The day the demo data was generated for (see `decodePreschoolState`). */
  day: string;
  schools: Partial<Record<SchoolId, PreschoolSchool>>;
};

export const emptySchool: PreschoolSchool = {
  diaries: [],
  pickupPeople: [],
  passes: [],
  gate: [],
  health: [],
  incidents: [],
  contacts: [],
  broadcasts: [],
  vehicles: [],
  routes: [],
  riders: [],
  trips: [],
};

/* ========================================================================
   Small helpers
   ======================================================================== */

let counter = 0;
export function newId(prefix: string) {
  counter += 1;
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    counter.toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

export function schoolOf(state: PreschoolState, school: SchoolId) {
  return state.schools[school] ?? emptySchool;
}

function put(
  state: PreschoolState,
  school: SchoolId,
  change: Partial<PreschoolSchool>,
): PreschoolState {
  return {
    ...state,
    schools: {
      ...state.schools,
      [school]: { ...schoolOf(state, school), ...change },
    },
  };
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export const validTime = (value: string) => timePattern.test(value);

/** "HH:MM" for a Date in local time. */
export function clock(date: Date) {
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

/** Indian mobile numbers: ten digits, optionally with +91. */
export function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return digits.length === 10 && /^[6-9]/.test(digits)
    ? "+91 " + digits.slice(0, 5) + " " + digits.slice(5)
    : "";
}

export function addDays(date: string, days: number) {
  const value = new Date(date + "T00:00:00");
  value.setDate(value.getDate() + days);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

/* ========================================================================
   Who can see which child
   ======================================================================== */

/** Active sections a teacher teaches or coordinates. */
export function teacherSections(records: AcademicSchool, teacher: string) {
  const ids = new Set([
    ...records.allocations
      .filter((item) => item.teacher === teacher)
      .map((item) => item.section),
    ...records.sections
      .filter((item) => item.coordinator === teacher)
      .map((item) => item.id),
  ]);
  const active = new Set(
    records.years.filter((y) => y.status === "Active").map((y) => y.id),
  );
  return records.sections.filter(
    (item) =>
      ids.has(item.id) && item.status === "Active" && active.has(item.year),
  );
}

export function sectionLabel(records: AcademicSchool, section?: string) {
  const row = records.sections.find((item) => item.id === section);
  return row ? row.grade + " · " + row.name : "No class";
}

export function sectionOf(records: AcademicSchool, student: string) {
  return currentEnrollment(records, student)?.section;
}

/** Children the actor may see, with their current class. */
export function childrenFor(records: AcademicSchool, actor: AssignmentActor) {
  let students: AcademicSchool["students"] = [];
  if (actor.role === "parent") students = linkedStudents(records, actor.person);
  else if (actor.role === "teacher") {
    const sections = new Set(
      teacherSections(records, actor.person).map((item) => item.id),
    );
    students = records.students.filter((item) =>
      sections.has(sectionOf(records, item.id) ?? ""),
    );
  } else if (actor.role === "school-admin")
    students = records.students.filter((item) => sectionOf(records, item.id));
  return students.map((item) => {
    const section = sectionOf(records, item.id);
    return { ...item, section, sectionLabel: sectionLabel(records, section) };
  });
}

export function canSeeChild(
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
) {
  return childrenFor(records, actor).some((item) => item.id === student);
}

const isStaff = (actor: AssignmentActor) =>
  actor.role === "teacher" || actor.role === "school-admin";

function requireStaffFor(
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
) {
  requireRule(
    isStaff(actor) && canSeeChild(records, actor, student),
    "Only the child's teachers or the school office can do this.",
  );
}

function requireFamilyOf(
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
) {
  requireRule(
    actor.role === "parent" && canSeeChild(records, actor, student),
    "Only a parent linked to this child can do this.",
  );
}

function requireFamilyOrOffice(
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
) {
  requireRule(
    (actor.role === "parent" || actor.role === "school-admin") &&
      canSeeChild(records, actor, student),
    "Only the child's parents or the school office can change this.",
  );
}

export function personName(records: AcademicSchool, actor: AssignmentActor) {
  const rows =
    actor.role === "parent"
      ? records.guardians
      : actor.role === "teacher"
        ? records.teachers
        : [];
  return (
    rows.find((item) => item.id === actor.person)?.name ??
    (actor.role === "school-admin" ? "School office" : "Staff")
  );
}

/* ========================================================================
   Daily diary
   ======================================================================== */

export type DiaryInput = Omit<
  Diary,
  "id" | "status" | "author" | "sentAt" | "readAt" | "reply"
>;

export function diaryFor(
  school: PreschoolSchool,
  student: string,
  date: string,
) {
  return school.diaries.find(
    (item) => item.student === student && item.date === date,
  );
}

export function saveDiary(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: DiaryInput,
  send: boolean,
  now: string,
  /** The local calendar day (not the UTC day in `now`). */
  today: string,
  id = newId("diary"),
): PreschoolState {
  requireStaffFor(records, actor, input.student);
  requireRule(validDate(input.date), "Choose a valid date.");
  requireRule(
    input.date <= today,
    "A diary can't be written for a future day.",
  );
  for (const meal of meals)
    requireRule(
      mealLevels.includes(input.meals[meal]),
      "Choose how much was eaten at each meal.",
    );
  requireRule(
    moods.some((item) => item.key === input.mood),
    "Choose the child's mood.",
  );
  const napped = input.napStart || input.napEnd;
  if (napped)
    requireRule(
      validTime(input.napStart) &&
        validTime(input.napEnd) &&
        input.napEnd > input.napStart,
      "Nap must end after it starts.",
    );
  requireRule(
    Number.isInteger(input.potty) &&
      Number.isInteger(input.diaper) &&
      input.potty >= 0 &&
      input.diaper >= 0 &&
      input.potty <= 15 &&
      input.diaper <= 15,
    "Enter toilet and diaper counts between 0 and 15.",
  );
  const note = input.note.trim();
  requireRule(note.length <= 600, "Keep the note under 600 characters.");
  if (send)
    requireRule(
      note.length >= 5,
      "Add a short note for the parents before sending.",
    );
  const school = schoolOf(state, actor.school);
  const existing = diaryFor(school, input.student, input.date);
  const row: Diary = {
    ...input,
    note,
    activities: [...new Set(input.activities.filter((item) => item.trim()))],
    napStart: napped ? input.napStart : "",
    napEnd: napped ? input.napEnd : "",
    id: existing?.id ?? id,
    author: personName(records, actor),
    status: send || existing?.status === "Sent" ? "Sent" : "Draft",
    sentAt: send ? now : existing?.sentAt,
    // A re-sent diary counts as new for the parent.
    readAt: send ? undefined : existing?.readAt,
    reply: existing?.reply,
  };
  return put(state, actor.school, {
    diaries: existing
      ? school.diaries.map((item) => (item.id === existing.id ? row : item))
      : [...school.diaries, row],
  });
}

/** Diaries a parent can read: only sent ones for their own child. */
export function visibleDiaries(
  school: PreschoolSchool,
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  return school.diaries.filter(
    (item) =>
      canSeeChild(records, actor, item.student) &&
      (actor.role !== "parent" || item.status === "Sent"),
  );
}

export function markDiaryRead(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  now: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.diaries.find((item) => item.id === id);
  if (!row || row.readAt || actor.role !== "parent") return state;
  requireFamilyOf(records, actor, row.student);
  return put(state, actor.school, {
    diaries: school.diaries.map((item) =>
      item.id === id ? { ...item, readAt: now } : item,
    ),
  });
}

export function replyToDiary(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  reply: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.diaries.find((item) => item.id === id);
  requireRule(row?.status === "Sent", "This diary isn't available.");
  requireFamilyOf(records, actor, row.student);
  const text = reply.trim();
  requireRule(
    text.length >= 2 && text.length <= 300,
    "Write a reply of 2 to 300 characters.",
  );
  return put(state, actor.school, {
    diaries: school.diaries.map((item) =>
      item.id === id ? { ...item, reply: text } : item,
    ),
  });
}

/* ========================================================================
   Pickup people, passes and the gate log
   ======================================================================== */

export const maxPhotoLength = 280_000;
const photoPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function addPickupPerson(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: Pick<
    PickupPerson,
    "student" | "name" | "relation" | "phone" | "photo"
  >,
  id = newId("pickup"),
): PreschoolState {
  requireFamilyOrOffice(records, actor, input.student);
  const name = input.name.trim();
  const relation = input.relation.trim();
  const phone = normalisePhone(input.phone);
  requireRule(name.length >= 2, "Enter the person's full name.");
  requireRule(relation.length >= 2, "Enter how they are related to the child.");
  requireRule(phone, "Enter a 10-digit mobile number.");
  requireRule(
    !input.photo ||
      (photoPattern.test(input.photo) && input.photo.length <= maxPhotoLength),
    "Upload a PNG, JPG or WebP photo under 200 KB.",
  );
  const school = schoolOf(state, actor.school);
  requireRule(
    !school.pickupPeople.some(
      (item) => item.student === input.student && item.phone === phone,
    ),
    "This person is already on the pickup list.",
  );
  const row: PickupPerson = {
    id,
    student: input.student,
    name,
    relation,
    phone,
    photo: input.photo,
    // The office checks ID before a new person is approved.
    status: actor.role === "school-admin" ? "Approved" : "Pending approval",
    addedBy: actor.role === "school-admin" ? "school" : "parent",
  };
  return put(state, actor.school, {
    pickupPeople: [...school.pickupPeople, row],
  });
}

export function approvePickupPerson(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.pickupPeople.find((item) => item.id === id);
  requireRule(row, "This person isn't on the list.");
  requireRule(
    actor.role === "school-admin" && canSeeChild(records, actor, row.student),
    "Only the school office can approve pickup people.",
  );
  return put(state, actor.school, {
    pickupPeople: school.pickupPeople.map((item) =>
      item.id === id ? { ...item, status: "Approved" } : item,
    ),
  });
}

export function removePickupPerson(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.pickupPeople.find((item) => item.id === id);
  requireRule(row, "This person isn't on the list.");
  requireFamilyOrOffice(records, actor, row.student);
  return put(state, actor.school, {
    pickupPeople: school.pickupPeople.filter((item) => item.id !== id),
  });
}

const passAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(random: () => number) {
  let code = "";
  for (let index = 0; index < 6; index++)
    code += passAlphabet[Math.floor(random() * passAlphabet.length)];
  return "OI-" + code;
}

export function createPass(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: Pick<
    PickupPass,
    "student" | "date" | "name" | "relation" | "phone" | "time" | "note"
  >,
  today: string,
  now: string,
  random: () => number = Math.random,
  id = newId("pass"),
): PreschoolState {
  requireFamilyOf(records, actor, input.student);
  requireRule(
    validDate(input.date) &&
      input.date >= today &&
      input.date <= addDays(today, 7),
    "Choose a date from today up to a week ahead.",
  );
  const name = input.name.trim();
  const phone = normalisePhone(input.phone);
  requireRule(name.length >= 2, "Enter the person's full name.");
  requireRule(input.relation.trim().length >= 2, "Enter their relation.");
  requireRule(phone, "Enter a 10-digit mobile number.");
  requireRule(validTime(input.time), "Choose a pickup time.");
  const school = schoolOf(state, actor.school);
  requireRule(
    !school.passes.some(
      (item) =>
        item.student === input.student &&
        item.date === input.date &&
        item.status === "Active",
    ),
    "There is already a pickup pass for this day. Cancel it first.",
  );
  const pass: PickupPass = {
    id,
    student: input.student,
    date: input.date,
    name,
    relation: input.relation.trim(),
    phone,
    time: input.time,
    note: input.note.trim().slice(0, 200),
    otp: String(Math.floor(random() * 9000) + 1000),
    code: randomCode(random),
    status: "Active",
    createdAt: now,
  };
  return put(state, actor.school, { passes: [...school.passes, pass] });
}

export function cancelPass(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const pass = school.passes.find((item) => item.id === id);
  requireRule(
    pass?.status === "Active",
    "Only an active pass can be cancelled.",
  );
  requireFamilyOrOffice(records, actor, pass.student);
  return put(state, actor.school, {
    passes: school.passes.map((item) =>
      item.id === id ? { ...item, status: "Cancelled" } : item,
    ),
  });
}

export type DayStatus = {
  in?: GateEvent;
  out?: GateEvent;
  state: "Not arrived" | "In school" | "Picked up";
};

export function dayStatus(
  school: PreschoolSchool,
  student: string,
  date: string,
): DayStatus {
  const events = school.gate
    .filter((item) => item.student === student && item.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const checkIn = events.find((item) => item.kind === "in");
  const checkOut = events.findLast((item) => item.kind === "out");
  return {
    in: checkIn,
    out: checkOut,
    state: checkOut ? "Picked up" : checkIn ? "In school" : "Not arrived",
  };
}

export function checkIn(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  person: string,
  method: GateMethod,
  today: string,
  time: string,
  id = newId("gate"),
): PreschoolState {
  requireStaffFor(records, actor, student);
  const school = schoolOf(state, actor.school);
  requireRule(
    dayStatus(school, student, today).state === "Not arrived",
    "This child is already checked in today.",
  );
  requireRule(person.trim().length >= 2, "Say who dropped the child off.");
  return put(state, actor.school, {
    gate: [
      ...school.gate,
      {
        id,
        student,
        date: today,
        kind: "in",
        time,
        person: person.trim(),
        method,
        by: personName(records, actor),
      },
    ],
  });
}

/** The people allowed to collect a child: approved list plus guardians. */
export function allowedCollectors(
  school: PreschoolSchool,
  records: AcademicSchool,
  student: string,
) {
  const guardians = records.links
    .filter((link) => link.student === student)
    .flatMap((link) => {
      const row = records.guardians.find((item) => item.id === link.guardian);
      return row
        ? [
            {
              id: row.id,
              name: row.name,
              relation: link.relationship,
              photo: "",
              phone: "",
              status: "Approved" as const,
            },
          ]
        : [];
    });
  return [
    ...guardians,
    ...school.pickupPeople.filter((item) => item.student === student),
  ];
}

export function checkOut(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  collector: string,
  today: string,
  time: string,
  id = newId("gate"),
): PreschoolState {
  requireStaffFor(records, actor, student);
  const school = schoolOf(state, actor.school);
  requireRule(
    dayStatus(school, student, today).state === "In school",
    "Only a child who is in school can be checked out.",
  );
  const person = allowedCollectors(school, records, student).find(
    (item) => item.id === collector,
  );
  requireRule(person, "Choose someone on the child's pickup list.");
  requireRule(
    person.status === "Approved",
    "This person is still waiting for approval. Use a pickup pass instead.",
  );
  const guardian = records.guardians.some((item) => item.id === collector);
  return put(state, actor.school, {
    gate: [
      ...school.gate,
      {
        id,
        student,
        date: today,
        kind: "out",
        time,
        person: person.name + " (" + person.relation + ")",
        method: guardian ? "Parent" : "Authorised person",
        by: personName(records, actor),
      },
    ],
  });
}

/**
 * Checks a child out against today's pass. `secret` is the 4-digit OTP the
 * collector received, or the pass code read from its QR.
 */
export function verifyPass(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  secret: string,
  today: string,
  now: string,
  time: string,
  id = newId("gate"),
): PreschoolState {
  requireStaffFor(records, actor, student);
  const school = schoolOf(state, actor.school);
  const value = secret.trim().toUpperCase();
  requireRule(value, "Enter the OTP or scan the QR pass.");
  const passes = school.passes.filter((item) => item.student === student);
  const pass = passes.find((item) => item.otp === value || item.code === value);
  requireRule(pass, "This code doesn't match a pickup pass for this child.");
  requireRule(pass.status !== "Used", "This pass has already been used.");
  requireRule(pass.status !== "Cancelled", "The parent cancelled this pass.");
  requireRule(pass.date === today, "This pass is for another day.");
  requireRule(
    dayStatus(school, student, today).state === "In school",
    "Only a child who is in school can be checked out.",
  );
  const method: GateMethod = value === pass.code ? "QR pass" : "OTP";
  return put(state, actor.school, {
    passes: school.passes.map((item) =>
      item.id === pass.id
        ? {
            ...item,
            status: "Used",
            usedAt: now,
            verifiedBy: personName(records, actor),
          }
        : item,
    ),
    gate: [
      ...school.gate,
      {
        id,
        student,
        date: today,
        kind: "out",
        time,
        person: pass.name + " (" + pass.relation + ")",
        method,
        by: personName(records, actor),
      },
    ],
  });
}

/* ========================================================================
   Health
   ======================================================================== */

export const bloodGroups = [
  "A+",
  "A−",
  "B+",
  "B−",
  "AB+",
  "AB−",
  "O+",
  "O−",
  "Not known",
] as const;

export function healthOf(school: PreschoolSchool, student: string) {
  return (
    school.health.find((item) => item.student === student) ?? {
      student,
      bloodGroup: "Not known",
      conditions: "",
      allergies: [],
      medicines: [],
      vaccinations: [],
      doctor: { name: "", clinic: "", phone: "" },
      updatedAt: "",
    }
  );
}

export function saveHealth(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  change: (profile: HealthProfile) => HealthProfile,
  now: string,
): PreschoolState {
  requireFamilyOrOffice(records, actor, student);
  const school = schoolOf(state, actor.school);
  const next = {
    ...change(healthOf(school, student)),
    student,
    updatedAt: now,
  };
  requireRule(
    (bloodGroups as readonly string[]).includes(next.bloodGroup),
    "Choose a blood group.",
  );
  requireRule(
    next.allergies.every(
      (item) => item.name.trim().length >= 2 && item.action.trim().length >= 3,
    ),
    "Each allergy needs a name and what staff should do.",
  );
  requireRule(
    next.medicines.every(
      (item) =>
        item.name.trim().length >= 2 &&
        item.dose.trim() &&
        validTime(item.time) &&
        validDate(item.until),
    ),
    "Each medicine needs a name, dose, time and end date.",
  );
  requireRule(
    next.vaccinations.every(
      (item) =>
        item.name.trim() &&
        validDate(item.due) &&
        (!item.given || validDate(item.given)),
    ),
    "Each vaccination needs a name and valid dates.",
  );
  // Clinics often give a landline (0135 …), so any 10–12 digit number works.
  requireRule(
    !next.doctor.phone ||
      /^\d{10,12}$/.test(next.doctor.phone.replace(/[\s()+-]/g, "")),
    "Enter the doctor's phone number with its area code.",
  );
  return put(state, actor.school, {
    health: [...school.health.filter((item) => item.student !== student), next],
  });
}

export function reportIncident(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: Pick<
    Incident,
    "student" | "date" | "time" | "kind" | "description" | "action"
  >,
  today: string,
  id = newId("incident"),
): PreschoolState {
  requireStaffFor(records, actor, input.student);
  requireRule(
    validDate(input.date) && input.date <= today,
    "Choose today or an earlier date.",
  );
  requireRule(validTime(input.time), "Enter the time it happened.");
  requireRule(incidentKinds.includes(input.kind), "Choose what happened.");
  requireRule(
    input.description.trim().length >= 10,
    "Describe what happened in at least 10 characters.",
  );
  requireRule(
    input.action.trim().length >= 5,
    "Say what first aid or care was given.",
  );
  const school = schoolOf(state, actor.school);
  return put(state, actor.school, {
    incidents: [
      {
        ...input,
        id,
        description: input.description.trim(),
        action: input.action.trim(),
        reportedBy: personName(records, actor),
        status: "Awaiting acknowledgement",
      },
      ...school.incidents,
    ],
  });
}

export function acknowledgeIncident(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  note: string,
  now: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.incidents.find((item) => item.id === id);
  requireRule(row, "This report isn't available.");
  requireFamilyOf(records, actor, row.student);
  requireRule(
    row.status === "Awaiting acknowledgement",
    "You have already acknowledged this report.",
  );
  return put(state, actor.school, {
    incidents: school.incidents.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Acknowledged",
            ackAt: now,
            ackBy: personName(records, actor),
            parentNote: note.trim().slice(0, 300) || undefined,
          }
        : item,
    ),
  });
}

/* ========================================================================
   Emergency contacts and broadcasts
   ======================================================================== */

export function contactsOf(school: PreschoolSchool, student: string) {
  return school.contacts
    .filter((item) => item.student === student)
    .sort((a, b) => a.priority - b.priority);
}

export function saveContact(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: Pick<EmergencyContact, "student" | "name" | "relation" | "phone"> & {
    id?: string;
  },
  id = newId("contact"),
): PreschoolState {
  requireFamilyOrOffice(records, actor, input.student);
  const name = input.name.trim();
  const phone = normalisePhone(input.phone);
  requireRule(name.length >= 2, "Enter the contact's name.");
  requireRule(input.relation.trim().length >= 2, "Enter their relation.");
  requireRule(phone, "Enter a 10-digit mobile number.");
  const school = schoolOf(state, actor.school);
  const mine = contactsOf(school, input.student);
  if (input.id) {
    requireRule(
      mine.some((item) => item.id === input.id),
      "This contact isn't on the list.",
    );
    return put(state, actor.school, {
      contacts: school.contacts.map((item) =>
        item.id === input.id
          ? { ...item, name, relation: input.relation.trim(), phone }
          : item,
      ),
    });
  }
  requireRule(mine.length < 5, "Add up to five emergency contacts.");
  return put(state, actor.school, {
    contacts: [
      ...school.contacts,
      {
        id,
        student: input.student,
        name,
        relation: input.relation.trim(),
        phone,
        priority: mine.length + 1,
      },
    ],
  });
}

/** Removes a contact or moves it up one place in the calling order. */
export function changeContact(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  change: "remove" | "up",
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.contacts.find((item) => item.id === id);
  requireRule(row, "This contact isn't on the list.");
  requireFamilyOrOffice(records, actor, row.student);
  let list = contactsOf(school, row.student);
  if (change === "remove") {
    requireRule(list.length > 1, "Keep at least one emergency contact.");
    list = list.filter((item) => item.id !== id);
  } else {
    const index = list.findIndex((item) => item.id === id);
    if (index > 0)
      list = [
        ...list.slice(0, index - 1),
        list[index],
        list[index - 1],
        ...list.slice(index + 1),
      ];
  }
  const ordered = list.map((item, index) => ({ ...item, priority: index + 1 }));
  return put(state, actor.school, {
    contacts: [
      ...school.contacts.filter((item) => item.student !== row.student),
      ...ordered,
    ],
  });
}

export function sendBroadcast(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  input: Pick<
    Broadcast,
    "title" | "message" | "category" | "audience" | "channels"
  >,
  now: string,
  id = newId("broadcast"),
): PreschoolState {
  requireRule(isStaff(actor), "Only school staff can send alerts.");
  if (actor.role === "teacher")
    requireRule(
      teacherSections(records, actor.person).some(
        (item) => item.id === input.audience,
      ),
      "Teachers can alert the families of their own classes only.",
    );
  else
    requireRule(
      input.audience === "all" ||
        records.sections.some((item) => item.id === input.audience),
      "Choose who receives the alert.",
    );
  requireRule(
    broadcastCategories.includes(input.category),
    "Choose a category.",
  );
  const title = input.title.trim();
  const message = input.message.trim();
  requireRule(
    title.length >= 4 && title.length <= 80,
    "Enter a title of 4 to 80 characters.",
  );
  requireRule(
    message.length >= 10 && message.length <= 500,
    "Enter a message of 10 to 500 characters.",
  );
  const school = schoolOf(state, actor.school);
  return put(state, actor.school, {
    broadcasts: [
      {
        id,
        title,
        message,
        category: input.category,
        audience: input.audience,
        channels: ["App", ...input.channels.filter((item) => item !== "App")],
        sentAt: now,
        by: personName(records, actor),
        byId: actor.person,
        acks: [],
        active: true,
      },
      ...school.broadcasts,
    ],
  });
}

/** Families an alert reaches: guardians of children in the audience. */
export function broadcastFamilies(records: AcademicSchool, audience: string) {
  const students = records.students.filter((item) => {
    const section = sectionOf(records, item.id);
    return section && (audience === "all" || section === audience);
  });
  const ids = new Set(students.map((item) => item.id));
  return [
    ...new Set(
      records.links
        .filter((link) => ids.has(link.student))
        .map((link) => link.guardian),
    ),
  ];
}

export function broadcastsFor(
  school: PreschoolSchool,
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  if (actor.role === "school-admin") return school.broadcasts;
  if (actor.role === "teacher") {
    const own = new Set(
      teacherSections(records, actor.person).map((item) => item.id),
    );
    return school.broadcasts.filter(
      (item) => item.audience === "all" || own.has(item.audience),
    );
  }
  if (actor.role === "parent")
    return school.broadcasts.filter((item) =>
      broadcastFamilies(records, item.audience).includes(actor.person),
    );
  return [];
}

export function acknowledgeBroadcast(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.broadcasts.find((item) => item.id === id);
  requireRule(row, "This alert isn't available.");
  requireRule(
    actor.role === "parent" &&
      broadcastFamilies(records, row.audience).includes(actor.person),
    "Only families who received this alert can acknowledge it.",
  );
  if (row.acks.includes(actor.person)) return state;
  return put(state, actor.school, {
    broadcasts: school.broadcasts.map((item) =>
      item.id === id ? { ...item, acks: [...item.acks, actor.person] } : item,
    ),
  });
}

export function closeBroadcast(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): PreschoolState {
  const school = schoolOf(state, actor.school);
  const row = school.broadcasts.find((item) => item.id === id);
  requireRule(row, "This alert isn't available.");
  requireRule(
    actor.role === "school-admin" ||
      (actor.role === "teacher" && row.byId === actor.person),
    "Only the sender or the school office can close this alert.",
  );
  return put(state, actor.school, {
    broadcasts: school.broadcasts.map((item) =>
      item.id === id ? { ...item, active: false } : item,
    ),
  });
}

/* ========================================================================
   Transport
   ======================================================================== */

/** "uk07pa4521", for matching however the number is typed. */
export function vehicleKey(number: string) {
  return number.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function findVehicle(school: PreschoolSchool, query: string) {
  const key = vehicleKey(query);
  if (!key) return undefined;
  return (
    school.vehicles.find((item) => vehicleKey(item.number) === key) ??
    school.vehicles.find((item) => vehicleKey(item.number).includes(key))
  );
}

export function riderOf(school: PreschoolSchool, student: string) {
  const rider = school.riders.find((item) => item.student === student);
  if (!rider) return undefined;
  const vehicle = school.vehicles.find((item) => item.id === rider.vehicle);
  const route = school.routes.find((item) => item.id === vehicle?.route);
  const stop = route?.stops.find((item) => item.id === rider.stop);
  return vehicle && route && stop ? { rider, vehicle, route, stop } : undefined;
}

/** Vehicles the actor may track: a parent sees only their child's vehicle. */
export function trackableVehicles(
  school: PreschoolSchool,
  records: AcademicSchool,
  actor: AssignmentActor,
) {
  if (isStaff(actor)) return school.vehicles;
  if (actor.role !== "parent") return [];
  const ids = new Set(
    childrenFor(records, actor).flatMap(
      (child) => riderOf(school, child.id)?.vehicle.id ?? [],
    ),
  );
  return school.vehicles.filter((item) => ids.has(item.id));
}

export function assignRider(
  state: PreschoolState,
  records: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  vehicle: string,
  stop: string,
): PreschoolState {
  requireRule(
    actor.role === "school-admin" && canSeeChild(records, actor, student),
    "Only the school office can assign transport.",
  );
  const school = schoolOf(state, actor.school);
  const others = school.riders.filter((item) => item.student !== student);
  if (!vehicle) return put(state, actor.school, { riders: others });
  const bus = school.vehicles.find((item) => item.id === vehicle);
  requireRule(bus?.status === "Active", "Choose a vehicle in service.");
  const route = school.routes.find((item) => item.id === bus.route);
  requireRule(
    route?.stops.some((item) => item.id === stop),
    "Choose a stop on this vehicle's route.",
  );
  requireRule(
    others.filter((item) => item.vehicle === vehicle).length < bus.capacity,
    "This vehicle is full.",
  );
  return put(state, actor.school, {
    riders: [...others, { student, vehicle, stop }],
  });
}

export function setVehicleStatus(
  state: PreschoolState,
  actor: AssignmentActor,
  vehicle: string,
  status: Vehicle["status"],
): PreschoolState {
  requireRule(
    actor.role === "school-admin",
    "Only the school office can change a vehicle's status.",
  );
  const school = schoolOf(state, actor.school);
  requireRule(
    status === "Active" ||
      !school.riders.some((item) => item.vehicle === vehicle),
    "Move this vehicle's children to another vehicle first.",
  );
  return put(state, actor.school, {
    vehicles: school.vehicles.map((item) =>
      item.id === vehicle ? { ...item, status } : item,
    ),
  });
}

/* ========================================================================
   Decoding
   ======================================================================== */

/**
 * The demo is anchored to a day: diaries, check-ins and trips are seeded for
 * "today". When the saved data belongs to an earlier day, a fresh seed for
 * today replaces it, so the demo always has a live school day to show.
 */
export function decodePreschoolState(
  raw: string | null,
  today: string,
  seed: (day: string) => PreschoolState,
): PreschoolState {
  if (!raw) return seed(today);
  try {
    const data = JSON.parse(raw) as PreschoolState;
    if (
      data?.version !== 1 ||
      data.day !== today ||
      !data.schools ||
      typeof data.schools !== "object"
    )
      return seed(today);
    const keys = Object.keys(emptySchool) as (keyof PreschoolSchool)[];
    const valid = Object.values(data.schools).every(
      (school) => school && keys.every((key) => Array.isArray(school[key])),
    );
    return valid ? data : seed(today);
  } catch {
    return seed(today);
  }
}

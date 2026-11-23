import type { DemoRole, SchoolId } from "@/types/demo";
import {
  academicTables,
  type AcademicSchool,
  type AcademicState,
  type AcademicTable,
} from "./academic-model";
import type { FeeSchool, FeeState } from "./fee-model";
import type { LearningSchool, LearningState } from "./learning-model";

export const auditAreas = [
  "Attendance",
  "Marks",
  "Fees",
  "Records",
  "Assignments",
  "Tests",
  "Privacy",
  "Access",
  "Branding",
  "Import",
] as const;
export type AuditArea = (typeof auditAreas)[number];

export type AuditActor = { role: DemoRole | "system"; name: string };
export type AuditInput = {
  school: SchoolId | "platform";
  area: AuditArea;
  action: string;
  detail: string;
};
export type AuditEntry = AuditInput & {
  id: string;
  at: string;
  actorRole: AuditActor["role"];
  actorName: string;
};
export type AuditState = { version: 1; entries: AuditEntry[] };

export const auditLimit = 1500;

/** A few illustrative entries so the log isn't empty on first open. */
export const auditSeed: AuditState = {
  version: 1,
  entries: (["westfield", "harborview", "cedar"] as SchoolId[]).flatMap(
    (school, index) => [
      {
        id: school + "-audit-2",
        at: "2026-11-20T04:15:00.000Z",
        school,
        actorRole: "teacher" as const,
        actorName: ["Maya Patel", "Leena Das", "Anika Shah"][index],
        area: "Attendance" as const,
        action: "Marked attendance",
        detail: "Weekly attendance for the first section · 2026-11-20",
      },
      {
        id: school + "-audit-1",
        at: "2026-11-05T06:40:00.000Z",
        school,
        actorRole: "school-admin" as const,
        actorName: ["Amelia Brooks", "Nisha Rao", "Rafael D'Souza"][index],
        area: "Fees" as const,
        action: "Recorded payment",
        detail: "Term 2 tuition · UPI",
      },
    ],
  ),
};

export function decodeAuditState(raw: string | null): AuditState {
  if (!raw) return auditSeed;
  try {
    const data = JSON.parse(raw) as AuditState;
    if (
      data?.version !== 1 ||
      !Array.isArray(data.entries) ||
      !data.entries.every(
        (row) =>
          row &&
          [
            "id",
            "at",
            "school",
            "actorRole",
            "actorName",
            "action",
            "detail",
          ].every(
            (key) => typeof (row as Record<string, unknown>)[key] === "string",
          ) &&
          auditAreas.includes(row.area),
      )
    )
      return auditSeed;
    return data;
  } catch {
    return auditSeed;
  }
}

export function appendEntries(
  state: AuditState,
  inputs: AuditInput[],
  actor: AuditActor,
  now: Date,
  makeId: () => string,
): AuditState {
  if (!inputs.length) return state;
  const at = now.toISOString();
  const entries = inputs.map((input) => ({
    ...input,
    id: makeId(),
    at,
    actorRole: actor.role,
    actorName: actor.name,
  }));
  return {
    ...state,
    entries: [...entries.reverse(), ...state.entries].slice(0, auditLimit),
  };
}

/* ---------- Diffs ---------- */

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const singular: Record<AcademicTable, string> = {
  years: "academic year",
  sections: "section",
  subjects: "subject",
  teachers: "teacher",
  allocations: "teacher allocation",
  students: "student",
  enrollments: "enrollment",
  guardians: "guardian",
  links: "guardian link",
  sessions: "timetable session",
  announcements: "announcement",
};

function sectionName(school: AcademicSchool, id: string) {
  const row = school.sections.find((item) => item.id === id);
  return row ? row.grade + " · " + row.name : "a section";
}

function personName(school: AcademicSchool, id: string) {
  return (
    school.students.find((item) => item.id === id)?.name ??
    school.teachers.find((item) => item.id === id)?.name ??
    school.guardians.find((item) => item.id === id)?.name ??
    "a student"
  );
}

function recordLabel(
  school: AcademicSchool,
  table: AcademicTable,
  row: Record<string, string>,
) {
  switch (table) {
    case "sections":
      return row.grade + " · " + row.name;
    case "allocations":
      return (
        (school.subjects.find((item) => item.id === row.subject)?.name ??
          "Subject") +
        " · " +
        sectionName(school, row.section)
      );
    case "enrollments":
      return (
        personName(school, row.student) +
        " in " +
        sectionName(school, row.section) +
        " (" +
        row.status +
        ")"
      );
    case "links":
      return (
        personName(school, row.guardian) +
        " ↔ " +
        personName(school, row.student)
      );
    case "sessions":
      return row.day + " " + row.start + "–" + row.end + " · " + row.room;
    default:
      return row.name ?? row.id;
  }
}

function byId<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

/** Records, attendance and grading changes between two academic states. */
export function diffAcademic(
  before: AcademicState,
  after: AcademicState,
): AuditInput[] {
  const inputs: AuditInput[] = [];
  for (const id of Object.keys(after.schools) as SchoolId[]) {
    const b = before.schools[id];
    const a = after.schools[id];
    if (!b || b === a) continue;
    const push = (area: AuditArea, action: string, detail: string) =>
      inputs.push({ school: id, area, action, detail });
    for (const table of academicTables) {
      if (b[table] === a[table]) continue;
      const old = byId(b[table] as { id: string }[]);
      const now = byId(a[table] as { id: string }[]);
      const changes: [string, string][] = [];
      for (const [key, row] of now) {
        const previous = old.get(key);
        if (!previous)
          changes.push([
            "Added",
            recordLabel(a, table, row as Record<string, string>),
          ]);
        else if (!same(previous, row))
          changes.push([
            "Updated",
            recordLabel(a, table, row as Record<string, string>),
          ]);
      }
      for (const [key, row] of old)
        if (!now.has(key))
          changes.push([
            "Removed",
            recordLabel(b, table, row as Record<string, string>),
          ]);
      if (changes.length > 5) {
        push(
          "Records",
          "Changed " + changes.length + " " + singular[table] + " records",
          changes
            .slice(0, 3)
            .map(([verb, label]) => verb + " " + label)
            .join("; ") + "…",
        );
      } else
        for (const [verb, label] of changes)
          push("Records", verb + " " + singular[table], label);
    }
    if (b.attendance !== a.attendance) {
      const old = new Map(
        b.attendance.map((row) => [row.section + "|" + row.date, row]),
      );
      for (const row of a.attendance) {
        const previous = old.get(row.section + "|" + row.date);
        if (previous && same(previous, row)) continue;
        const marks = Object.values(row.marks);
        const count = (status: string) =>
          marks.filter((mark) => mark === status).length;
        const changed = previous
          ? Object.entries(row.marks)
              .filter(([student, mark]) => previous.marks[student] !== mark)
              .map(
                ([student, mark]) =>
                  personName(a, student) +
                  ": " +
                  (previous.marks[student] ?? "—") +
                  " → " +
                  mark,
              )
          : [];
        push(
          "Attendance",
          previous ? "Edited attendance" : "Marked attendance",
          sectionName(a, row.section) +
            " · " +
            row.date +
            " · Present " +
            count("Present") +
            ", Absent " +
            count("Absent") +
            ", Late " +
            count("Late") +
            (changed.length ? " · " + changed.slice(0, 3).join("; ") : ""),
        );
      }
    }
    if (b.submissions !== a.submissions) {
      for (const row of a.submissions) {
        const previous = b.submissions.find(
          (item) =>
            item.assignment === row.assignment && item.student === row.student,
        );
        if (row.status !== "Graded" && row.status !== "Revision required")
          continue;
        if (
          previous &&
          previous.status === row.status &&
          previous.marks === row.marks
        )
          continue;
        const assignment = a.assignments.find(
          (item) => item.id === row.assignment,
        );
        push(
          "Marks",
          row.status === "Graded"
            ? previous?.status === "Graded"
              ? "Changed assignment grade"
              : "Graded assignment"
            : "Returned for revision",
          (assignment?.title ?? "Assignment") +
            " · " +
            personName(a, row.student) +
            (row.marks !== undefined
              ? " · " +
                (previous?.marks !== undefined && previous.marks !== row.marks
                  ? previous.marks + " → "
                  : "") +
                row.marks +
                "/" +
                (assignment?.maximum ?? "?")
              : ""),
        );
      }
    }
    if (b.assignments !== a.assignments) {
      for (const row of a.assignments) {
        const previous = b.assignments.find((item) => item.id === row.id);
        if (previous && same(previous, row)) continue;
        push(
          "Assignments",
          !previous
            ? "Created assignment"
            : previous.published !== row.published && row.published
              ? "Published assignment"
              : "Updated assignment",
          row.title + " · due " + row.due,
        );
      }
    }
  }
  return inputs;
}

/** Exam marks, results publishing and test changes. */
export function diffLearning(
  before: LearningState,
  after: LearningState,
  names: (school: SchoolId) => AcademicSchool | undefined,
): AuditInput[] {
  const inputs: AuditInput[] = [];
  for (const id of Object.keys(after.schools) as SchoolId[]) {
    const b: LearningSchool | undefined = before.schools[id];
    const a = after.schools[id];
    if (!b || b === a) continue;
    const academic = names(id);
    const subject = (key: string) =>
      academic?.subjects.find((item) => item.id === key)?.name ?? "a subject";
    const student = (key: string) =>
      academic ? personName(academic, key) : "a student";
    const exam = (key: string) =>
      a.exams.find((item) => item.id === key)?.name ?? "an exam";
    if (b.marks !== a.marks) {
      const groups = new Map<string, string[]>();
      for (const row of a.marks) {
        const previous = b.marks.find(
          (item) =>
            item.exam === row.exam &&
            item.student === row.student &&
            item.subject === row.subject,
        );
        if (previous && previous.marks === row.marks) continue;
        const show = (value: number | null) =>
          value === null ? "AB" : String(value);
        const key =
          row.exam +
          "|" +
          row.subject +
          "|" +
          (previous ? "changed" : "entered");
        groups.set(key, [
          ...(groups.get(key) ?? []),
          student(row.student) +
            ": " +
            (previous ? show(previous.marks) + " → " : "") +
            show(row.marks),
        ]);
      }
      for (const [key, changes] of groups) {
        const [examId, subjectId, kind] = key.split("|");
        inputs.push({
          school: id,
          area: "Marks",
          action:
            kind === "changed" ? "Changed exam marks" : "Entered exam marks",
          detail:
            exam(examId) +
            " · " +
            subject(subjectId) +
            " · " +
            changes.slice(0, 4).join("; ") +
            (changes.length > 4 ? "…" : ""),
        });
      }
    }
    if (b.exams !== a.exams)
      for (const row of a.exams) {
        const previous = b.exams.find((item) => item.id === row.id);
        if (previous && same(previous, row)) continue;
        inputs.push({
          school: id,
          area: "Marks",
          action: !previous
            ? "Created exam"
            : previous.published !== row.published
              ? row.published
                ? "Published results"
                : "Unpublished results"
              : "Updated exam",
          detail: row.name + " · " + row.date + " · out of " + row.maximum,
        });
      }
    if (b.tests !== a.tests)
      for (const row of a.tests) {
        const previous = b.tests.find((item) => item.id === row.id);
        if (previous && same(previous, row)) continue;
        inputs.push({
          school: id,
          area: "Tests",
          action: !previous
            ? "Created online test"
            : previous.closes !== row.closes &&
                previous.questions.join() === row.questions.join()
              ? "Changed test closing time"
              : "Updated online test",
          detail:
            row.title +
            " · " +
            row.questions.length +
            " questions · " +
            (row.published ? "published" : "draft"),
        });
      }
  }
  return inputs;
}

/** Payments, invoices, fee structure and gateway changes. */
export function diffFees(
  before: FeeState,
  after: FeeState,
  names: (school: SchoolId) => AcademicSchool | undefined,
): AuditInput[] {
  const inputs: AuditInput[] = [];
  for (const id of Object.keys(after.schools) as SchoolId[]) {
    const b: FeeSchool | undefined = before.schools[id];
    const a = after.schools[id];
    if (!b || b === a) continue;
    const academic = names(id);
    const push = (action: string, detail: string) =>
      inputs.push({ school: id, area: "Fees", action, detail });
    const feeName = (key: string) =>
      a.structure.find((item) => item.id === key)?.name ?? "Fee";
    if (b.payments !== a.payments)
      for (const row of a.payments) {
        if (b.payments.some((item) => item.id === row.id)) continue;
        const invoice = a.invoices.find((item) => item.id === row.invoice);
        push(
          row.status === "Simulated"
            ? "Online payment (demo)"
            : "Recorded payment",
          row.receipt +
            " · " +
            rupees.format(row.amount) +
            " · " +
            row.method +
            " · " +
            (invoice ? invoice.number + " · " + feeName(invoice.fee) : "") +
            (invoice && academic
              ? " · " + personName(academic, invoice.student)
              : ""),
        );
      }
    if (b.invoices !== a.invoices) {
      const created = a.invoices.filter(
        (row) => !b.invoices.some((item) => item.id === row.id),
      );
      const byFee = new Map<string, number>();
      for (const row of created)
        byFee.set(row.fee, (byFee.get(row.fee) ?? 0) + 1);
      for (const [fee, count] of byFee)
        push("Generated invoices", count + " × " + feeName(fee));
      for (const row of a.invoices) {
        const previous = b.invoices.find((item) => item.id === row.id);
        if (previous && !previous.cancelled && row.cancelled)
          push(
            "Cancelled invoice",
            row.number +
              " · " +
              feeName(row.fee) +
              " · " +
              rupees.format(row.amount),
          );
      }
    }
    if (b.structure !== a.structure) {
      for (const row of a.structure) {
        const previous = b.structure.find((item) => item.id === row.id);
        if (previous && same(previous, row)) continue;
        push(
          previous ? "Changed fee" : "Added fee",
          row.name +
            " · " +
            row.grade +
            " · " +
            (previous && previous.amount !== row.amount
              ? rupees.format(previous.amount) + " → "
              : "") +
            rupees.format(row.amount) +
            " · due " +
            row.due,
        );
      }
      for (const row of b.structure)
        if (!a.structure.some((item) => item.id === row.id))
          push("Removed fee", row.name + " · " + row.grade);
    }
    if (!same(b.gateway, a.gateway))
      push(
        "Updated payment gateway",
        "Razorpay · " +
          a.gateway.mode +
          " mode · online payments " +
          (a.gateway.enabled ? "on" : "off") +
          " · key " +
          (a.gateway.keyId ? "set" : "not set"),
      );
    if (b.reminders !== a.reminders) {
      const created = a.reminders.filter(
        (row) => !b.reminders.some((item) => item.id === row.id),
      );
      if (created.length)
        push(
          "Sent fee reminders",
          created.length +
            " via " +
            [...new Set(created.map((row) => row.channel))].join(", "),
        );
    }
  }
  return inputs;
}

/** Rows for a CSV export of the log. */
export function auditCsvRows(entries: AuditEntry[]) {
  return [
    ["Time (UTC)", "User", "Role", "Area", "Action", "Details"],
    ...entries.map((row) => [
      row.at,
      row.actorName,
      row.actorRole,
      row.area,
      row.action,
      row.detail,
    ]),
  ];
}

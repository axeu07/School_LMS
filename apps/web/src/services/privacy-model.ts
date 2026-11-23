import { academicRecords } from "@/mocks/academics";
import type { SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  type AcademicSchool,
  type AcademicState,
} from "./academic-model";
import type { AssignmentActor } from "./assignment-model";
import type { FeeSchool } from "./fee-model";
import type { LearningSchool } from "./learning-model";

/* ---------- Types ---------- */

export const consentVersion = "2026.1";
export const consentPurposes = [
  {
    key: "records",
    label: "Academic records and attendance",
    description: "Needed to run your child's school account.",
    required: true,
  },
  {
    key: "communication",
    label: "SMS and WhatsApp alerts",
    description: "Absence alerts, fee reminders and school notices.",
    required: false,
  },
  {
    key: "media",
    label: "Photos and videos",
    description:
      "Your child may appear in school publications and social media.",
    required: false,
  },
  {
    key: "ai",
    label: "AI learning tools",
    description: "Homework helper, practice questions and revision notes.",
    required: false,
  },
  {
    key: "sharing",
    label: "Sharing with exam boards and partners",
    description: "Results shared with exam boards and approved partners.",
    required: false,
  },
] as const;
export type PurposeKey = (typeof consentPurposes)[number]["key"];
export type ConsentStatus = "Pending" | "Granted" | "Declined" | "Withdrawn";
export type ConsentRecord = {
  id: string;
  student: string;
  guardian: string;
  status: ConsentStatus;
  purposes: Record<PurposeKey, boolean>;
  version: string;
  requestedOn: string;
  respondedOn: string;
  history: { at: string; status: ConsentStatus; by: string }[];
};
export type DataRequestKind = "Export" | "Deletion";
export type DataRequest = {
  id: string;
  student: string;
  guardian: string;
  kind: DataRequestKind;
  status: "Pending" | "Completed" | "Rejected";
  requestedOn: string;
  resolvedOn: string;
  note: string;
};
export type PrivacySchool = {
  consents: ConsentRecord[];
  requests: DataRequest[];
};
export type PrivacyState = {
  version: 1;
  schools: Record<SchoolId, PrivacySchool>;
};

const none = (): Record<PurposeKey, boolean> =>
  Object.fromEntries(
    consentPurposes.map((item) => [item.key, false]),
  ) as Record<PurposeKey, boolean>;

/* ---------- Seed ---------- */

function seedSchool(prefix: SchoolId, index: number): PrivacySchool {
  const source = academicRecords.find((item) => item.schoolId === prefix)!;
  const [first, second] = source.learners;
  const consents: ConsentRecord[] = [
    {
      id: prefix + "-consent-0",
      student: first.id,
      guardian: source.parent.id,
      status: "Granted",
      purposes: {
        records: true,
        communication: true,
        media: false,
        ai: true,
        sharing: false,
      },
      version: consentVersion,
      requestedOn: "2026-06-02",
      respondedOn: "2026-06-04",
      history: [
        { at: "2026-06-02", status: "Pending", by: "School office" },
        { at: "2026-06-04", status: "Granted", by: source.parent.name },
      ],
    },
  ];
  // Westfield has a pending request; the other schools haven't asked yet.
  if (index === 0)
    consents.push({
      id: prefix + "-consent-1",
      student: second.id,
      guardian: source.parent.id,
      status: "Pending",
      purposes: none(),
      version: consentVersion,
      requestedOn: "2026-11-18",
      respondedOn: "",
      history: [{ at: "2026-11-18", status: "Pending", by: "School office" }],
    });
  return { consents, requests: [] };
}

export const privacySeed: PrivacyState = {
  version: 1,
  schools: {
    westfield: seedSchool("westfield", 0),
    harborview: seedSchool("harborview", 1),
    cedar: seedSchool("cedar", 2),
  },
};

export function decodePrivacyState(raw: string | null): PrivacyState {
  if (!raw) return privacySeed;
  try {
    const data = JSON.parse(raw) as PrivacyState;
    if (data?.version !== 1 || !data.schools) return privacySeed;
    const strings = (row: object, keys: string[]) =>
      keys.every(
        (key) => typeof (row as Record<string, unknown>)[key] === "string",
      );
    const valid = (Object.keys(privacySeed.schools) as SchoolId[]).every(
      (id) => {
        const school = data.schools[id];
        return (
          !!school &&
          Array.isArray(school.consents) &&
          school.consents.every(
            (row) =>
              strings(row, [
                "id",
                "student",
                "guardian",
                "status",
                "version",
                "requestedOn",
                "respondedOn",
              ]) &&
              !!row.purposes &&
              consentPurposes.every(
                (item) => typeof row.purposes[item.key] === "boolean",
              ) &&
              Array.isArray(row.history),
          ) &&
          Array.isArray(school.requests) &&
          school.requests.every((row) =>
            strings(row, [
              "id",
              "student",
              "guardian",
              "kind",
              "status",
              "requestedOn",
              "resolvedOn",
              "note",
            ]),
          )
        );
      },
    );
    return valid ? data : privacySeed;
  } catch {
    return privacySeed;
  }
}

/* ---------- Queries ---------- */

/** The latest consent record for a student. */
export function currentConsent(privacy: PrivacySchool, student: string) {
  return privacy.consents.filter((item) => item.student === student).at(-1);
}

/** Every currently enrolled student with their consent status. */
export function consentOverview(
  privacy: PrivacySchool,
  school: AcademicSchool,
) {
  return school.students
    .filter((student) => currentEnrollment(school, student.id))
    .map((student) => {
      const consent = currentConsent(privacy, student.id);
      return {
        student,
        consent,
        status: consent?.status ?? ("Not requested" as const),
      };
    });
}

function primaryGuardian(school: AcademicSchool, student: string) {
  const links = school.links.filter((item) => item.student === student);
  return (links.find((item) => item.primary === "Yes") ?? links[0])?.guardian;
}

function replace(
  state: PrivacyState,
  school: SchoolId,
  value: PrivacySchool,
): PrivacyState {
  return { ...state, schools: { ...state.schools, [school]: value } };
}

/* ---------- Consent rules ---------- */

/** Sends consent requests to each student's primary guardian. */
export function requestConsents(
  state: PrivacyState,
  school: AcademicSchool,
  actor: AssignmentActor,
  students: string[],
  today: string,
  makeId: () => string,
) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can request consent.",
  );
  const privacy = state.schools[actor.school];
  const created: ConsentRecord[] = [];
  for (const student of students) {
    const status = currentConsent(privacy, student)?.status;
    const guardian = primaryGuardian(school, student);
    if (status === "Pending" || status === "Granted" || !guardian) continue;
    created.push({
      id: makeId(),
      student,
      guardian,
      status: "Pending",
      purposes: none(),
      version: consentVersion,
      requestedOn: today,
      respondedOn: "",
      history: [{ at: today, status: "Pending", by: "School office" }],
    });
  }
  requireRule(
    created.length,
    "Every selected student already has a pending or granted consent, or has no linked guardian.",
  );
  return {
    state: replace(state, actor.school, {
      ...privacy,
      consents: [...privacy.consents, ...created],
    }),
    created,
  };
}

function guardianConsent(
  state: PrivacyState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
) {
  requireRule(
    actor.role === "parent",
    "Only a parent or guardian can respond.",
  );
  const consent = state.schools[actor.school].consents.find(
    (item) => item.id === id,
  );
  requireRule(
    consent &&
      linkedStudents(school, actor.person).some(
        (item) => item.id === consent.student,
      ),
    "This consent request is unavailable.",
  );
  return consent;
}

export function respondConsent(
  state: PrivacyState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  purposes: Partial<Record<PurposeKey, boolean>>,
  grant: boolean,
  today: string,
  by: string,
) {
  const consent = guardianConsent(state, school, actor, id);
  requireRule(
    consent.status === "Pending" || consent.status === "Granted",
    "This consent can't be changed. Ask the school to send a new request.",
  );
  const chosen = Object.fromEntries(
    consentPurposes.map((item) => [item.key, grant && !!purposes[item.key]]),
  ) as Record<PurposeKey, boolean>;
  if (grant)
    requireRule(
      consentPurposes.every((item) => !item.required || chosen[item.key]),
      "Academic records consent is required to grant consent. Choose Decline instead.",
    );
  const status: ConsentStatus = grant ? "Granted" : "Declined";
  const privacy = state.schools[actor.school];
  return replace(state, actor.school, {
    ...privacy,
    consents: privacy.consents.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            purposes: chosen,
            respondedOn: today,
            history: [...item.history, { at: today, status, by }],
          }
        : item,
    ),
  });
}

export function withdrawConsent(
  state: PrivacyState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  today: string,
  by: string,
) {
  const consent = guardianConsent(state, school, actor, id);
  requireRule(
    consent.status === "Granted",
    "Only granted consent can be withdrawn.",
  );
  const privacy = state.schools[actor.school];
  return replace(state, actor.school, {
    ...privacy,
    consents: privacy.consents.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Withdrawn",
            purposes: none(),
            respondedOn: today,
            history: [...item.history, { at: today, status: "Withdrawn", by }],
          }
        : item,
    ),
  });
}

/* ---------- Data requests ---------- */

export function requestData(
  state: PrivacyState,
  school: AcademicSchool,
  actor: AssignmentActor,
  kind: DataRequestKind,
  today: string,
  makeId: () => string,
) {
  requireRule(
    actor.role === "parent",
    "Only a parent or guardian can request data.",
  );
  const student = linkedStudents(school, actor.person).find(
    (item) => item.id === actor.child,
  )?.id;
  requireRule(student, "Choose one of your children.");
  const privacy = state.schools[actor.school];
  requireRule(
    !privacy.requests.some(
      (item) =>
        item.student === student &&
        item.kind === kind &&
        item.status === "Pending",
    ),
    "You already have a pending " +
      kind.toLowerCase() +
      " request for this child.",
  );
  return replace(state, actor.school, {
    ...privacy,
    requests: [
      ...privacy.requests,
      {
        id: makeId(),
        student,
        guardian: actor.person,
        kind,
        status: "Pending",
        requestedOn: today,
        resolvedOn: "",
        note: "",
      },
    ],
  });
}

export function resolveRequest(
  state: PrivacyState,
  actor: AssignmentActor,
  id: string,
  outcome: "Completed" | "Rejected",
  note: string,
  today: string,
) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can resolve data requests.",
  );
  const privacy = state.schools[actor.school];
  const request = privacy.requests.find((item) => item.id === id);
  requireRule(
    request?.status === "Pending",
    "This request is no longer pending.",
  );
  requireRule(
    outcome === "Completed" || note.trim(),
    "Explain why the request is rejected.",
  );
  return replace(state, actor.school, {
    ...privacy,
    requests: privacy.requests.map((item) =>
      item.id === id
        ? { ...item, status: outcome, resolvedOn: today, note: note.trim() }
        : item,
    ),
  });
}

/** Everything the school holds about one student, for a data export. */
export function buildExport(
  school: AcademicSchool,
  learning: LearningSchool | undefined,
  fees: FeeSchool | undefined,
  privacy: PrivacySchool,
  studentId: string,
  generatedAt: string,
) {
  const student = school.students.find((item) => item.id === studentId);
  requireRule(student, "This student is unavailable.");
  const section = (id: string) => {
    const row = school.sections.find((item) => item.id === id);
    return row ? row.grade + " · " + row.name : id;
  };
  const subject = (id: string) =>
    school.subjects.find((item) => item.id === id)?.name ?? id;
  return {
    generatedAt,
    student: { name: student.name, studentNumber: student.code },
    enrollments: school.enrollments
      .filter((item) => item.student === studentId)
      .map((item) => ({ section: section(item.section), status: item.status })),
    guardians: school.links
      .filter((item) => item.student === studentId)
      .map((item) => {
        const guardian = school.guardians.find(
          (row) => row.id === item.guardian,
        );
        return {
          name: guardian?.name,
          email: guardian?.email,
          relationship: item.relationship,
          primaryContact: item.primary === "Yes",
        };
      }),
    attendance: school.attendance.flatMap((item) =>
      item.marks[studentId]
        ? [
            {
              date: item.date,
              section: section(item.section),
              status: item.marks[studentId],
            },
          ]
        : [],
    ),
    assignments: school.submissions
      .filter((item) => item.student === studentId)
      .map((item) => {
        const assignment = school.assignments.find(
          (row) => row.id === item.assignment,
        );
        return {
          title: assignment?.title,
          status: item.status,
          response: item.text,
          marks: item.marks,
          maximum: assignment?.maximum,
          feedback: item.feedback,
        };
      }),
    onlineTests: (learning?.attempts ?? [])
      .filter((item) => item.student === studentId)
      .map((attempt) => {
        const test = learning!.tests.find((row) => row.id === attempt.test);
        const correct = (test?.questions ?? []).filter((id) => {
          const question = learning!.questions.find((row) => row.id === id);
          return question && attempt.answers[id] === question.answer;
        }).length;
        return {
          test: test?.title,
          started: attempt.started,
          submitted: attempt.submitted,
          correct,
          total: test?.questions.length,
        };
      }),
    examMarks: (learning?.marks ?? [])
      .filter((item) => item.student === studentId)
      .map((item) => ({
        exam: learning!.exams.find((row) => row.id === item.exam)?.name,
        subject: subject(item.subject),
        marks: item.marks === null ? "Absent" : item.marks,
      })),
    fees: (fees?.invoices ?? [])
      .filter((item) => item.student === studentId)
      .map((invoice) => ({
        invoice: invoice.number,
        fee: fees!.structure.find((row) => row.id === invoice.fee)?.name,
        amount: invoice.amount,
        due: invoice.due,
        cancelled: invoice.cancelled,
        payments: fees!.payments
          .filter((row) => row.invoice === invoice.id)
          .map((row) => ({
            receipt: row.receipt,
            amount: row.amount,
            method: row.method,
            paidOn: row.paidOn,
          })),
      })),
    consent: privacy.consents
      .filter((item) => item.student === studentId)
      .map((item) => ({
        status: item.status,
        purposes: item.purposes,
        version: item.version,
        history: item.history,
      })),
  };
}

/**
 * Carries out a deletion request: removes the student's identity and guardian
 * links and withdraws their enrollments. Anonymised academic history is kept,
 * as schools are usually required to retain it.
 */
export function anonymizeStudent(
  state: AcademicState,
  school: SchoolId,
  studentId: string,
): AcademicState {
  const records = state.schools[school];
  requireRule(
    records.students.some((item) => item.id === studentId),
    "This student is unavailable.",
  );
  return {
    ...state,
    schools: {
      ...state.schools,
      [school]: {
        ...records,
        students: records.students.map((item) =>
          item.id === studentId
            ? {
                ...item,
                name: "Erased student",
                code:
                  "ERASED-" +
                  studentId
                    .replace(/[^A-Za-z0-9]/g, "")
                    .slice(-6)
                    .toUpperCase(),
              }
            : item,
        ),
        links: records.links.filter((item) => item.student !== studentId),
        enrollments: records.enrollments.map((item) =>
          item.student === studentId ? { ...item, status: "Withdrawn" } : item,
        ),
        submissions: records.submissions.map((item) =>
          item.student === studentId ? { ...item, text: "[Erased]" } : item,
        ),
      },
    },
  };
}

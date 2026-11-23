import { academicRecords } from "@/mocks/academics";
import type { SchoolId } from "@/types/demo";
import { requireRule, type AcademicSchool } from "./academic-model";
import { activeAllocations, type AssignmentActor } from "./assignment-model";

export type DoubtStatus = "Open" | "Answered" | "Answered in class";
export type Doubt = {
  id: string;
  section: string;
  subject: string;
  text: string;
  author: string;
  votes: string[];
  created: string;
  status: DoubtStatus;
  reply: string;
};
export type DoubtState = {
  version: 1;
  schools: Record<SchoolId, Doubt[]>;
};

const statuses: DoubtStatus[] = ["Open", "Answered", "Answered in class"];

export const doubtSeed: DoubtState = {
  version: 1,
  schools: Object.fromEntries(
    academicRecords.map((source) => {
      const prefix = source.schoolId;
      const section = source.classes[0].id;
      const subject = prefix + "-subject-0";
      return [
        prefix,
        [
          {
            id: prefix + "-doubt-0",
            section,
            subject,
            text: source.doubts[0].title,
            author: prefix + "-classmate-0",
            votes: [prefix + "-classmate-1", prefix + "-classmate-2"],
            created: "2026-11-20T09:15:00.000Z",
            status: "Open",
            reply: "",
          },
          {
            id: prefix + "-doubt-1",
            section,
            subject,
            text: "Could we get a few extra practice problems before the unit quiz?",
            author: prefix + "-classmate-1",
            votes: [prefix + "-classmate-0"],
            created: "2026-11-18T12:40:00.000Z",
            status: "Answered",
            reply:
              "Yes — a practice set is now attached to this week's assignment. Try the first three before Friday.",
          },
        ],
      ];
    }),
  ) as DoubtState["schools"],
};

export function decodeDoubtState(raw: string | null): DoubtState {
  if (!raw) return doubtSeed;
  try {
    const data = JSON.parse(raw) as DoubtState;
    if (data?.version !== 1 || !data.schools) return doubtSeed;
    const valid = Object.keys(doubtSeed.schools).every((id) => {
      const rows = data.schools[id as SchoolId];
      return (
        Array.isArray(rows) &&
        rows.every(
          (row) =>
            row &&
            ["id", "section", "subject", "text", "author", "created", "reply"]
              .map((key) => (row as Record<string, unknown>)[key])
              .every((value) => typeof value === "string") &&
            Array.isArray(row.votes) &&
            row.votes.every((vote) => typeof vote === "string") &&
            statuses.includes(row.status),
        )
      );
    });
    return valid ? data : doubtSeed;
  } catch {
    return doubtSeed;
  }
}

function visibleSections(school: AcademicSchool, actor: AssignmentActor) {
  if (actor.role !== "teacher" && actor.role !== "student") return new Set();
  return new Set(activeAllocations(school, actor).map((item) => item.section));
}

/**
 * What any viewer (student or teacher) may see of a doubt. The author and
 * voter IDs never leave this module, so no one can learn who asked or who
 * upvoted — only whether the doubt is the viewer's own and whether they voted.
 */
export type DoubtView = {
  id: string;
  section: string;
  subject: string;
  text: string;
  created: string;
  status: DoubtStatus;
  reply: string;
  voteCount: number;
  own: boolean;
  voted: boolean;
};

/** Raw doubts for the actor's sections — internal use only (rule checks). */
function visibleDoubts(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
) {
  const sections = visibleSections(school, actor);
  return (state.schools[actor.school] ?? []).filter((item) =>
    sections.has(item.section),
  );
}

/** Anonymous doubts for the actor's sections, most upvoted first. */
export function doubtsFor(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
): DoubtView[] {
  return visibleDoubts(state, school, actor)
    .sort(
      (a, b) =>
        b.votes.length - a.votes.length || b.created.localeCompare(a.created),
    )
    .map((item) => ({
      id: item.id,
      section: item.section,
      subject: item.subject,
      text: item.text,
      created: item.created,
      status: item.status,
      reply: item.reply,
      voteCount: item.votes.length,
      own: actor.role === "student" && item.author === actor.person,
      voted: item.votes.includes(actor.person),
    }));
}

function replaceDoubts(
  state: DoubtState,
  actor: AssignmentActor,
  rows: Doubt[],
): DoubtState {
  return { ...state, schools: { ...state.schools, [actor.school]: rows } };
}

function findVisible(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
) {
  const doubt = visibleDoubts(state, school, actor).find(
    (item) => item.id === id,
  );
  requireRule(doubt, "This doubt is unavailable for your class.");
  return doubt;
}

export function postDoubt(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
  allocationId: string,
  text: string,
  id: string,
  now = new Date().toISOString(),
): DoubtState {
  requireRule(actor.role === "student", "Only students can post doubts.");
  const allocation = activeAllocations(school, actor).find(
    (item) => item.id === allocationId,
  );
  requireRule(allocation, "Choose one of your subjects.");
  const value = text.trim();
  requireRule(
    value.length >= 10,
    "Describe your doubt in at least 10 characters.",
  );
  requireRule(value.length <= 500, "Keep your doubt under 500 characters.");
  return replaceDoubts(state, actor, [
    ...(state.schools[actor.school] ?? []),
    {
      id,
      section: allocation.section,
      subject: allocation.subject,
      text: value,
      author: actor.person,
      votes: [],
      created: now,
      status: "Open",
      reply: "",
    },
  ]);
}

export function toggleDoubtVote(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
): DoubtState {
  requireRule(actor.role === "student", "Only students can upvote doubts.");
  const doubt = findVisible(state, school, actor, id);
  requireRule(
    doubt.author !== actor.person,
    "You can't upvote your own doubt.",
  );
  const votes = doubt.votes.includes(actor.person)
    ? doubt.votes.filter((vote) => vote !== actor.person)
    : [...doubt.votes, actor.person];
  return replaceDoubts(
    state,
    actor,
    state.schools[actor.school].map((item) =>
      item.id === id ? { ...item, votes } : item,
    ),
  );
}

export function answerDoubt(
  state: DoubtState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  reply: string,
  inClass: boolean,
): DoubtState {
  requireRule(actor.role === "teacher", "Only teachers can answer doubts.");
  findVisible(state, school, actor, id);
  const value = reply.trim();
  requireRule(inClass || value, "Write a reply or mark it answered in class.");
  return replaceDoubts(
    state,
    actor,
    state.schools[actor.school].map((item) =>
      item.id === id
        ? {
            ...item,
            reply: value,
            status: inClass ? "Answered in class" : "Answered",
          }
        : item,
    ),
  );
}

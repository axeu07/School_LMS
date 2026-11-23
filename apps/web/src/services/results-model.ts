import {
  currentEnrollment,
  requireRule,
  validDate,
  type AcademicSchool,
} from "./academic-model";
import { activeAllocations, type AssignmentActor } from "./assignment-model";
import { attendanceRoster } from "./attendance-model";
import {
  attemptComplete,
  subjectsFor,
  topicPath,
  type Exam,
  type LearningSchool,
  type LearningState,
  type Question,
} from "./learning-model";

/* ---------- Grading ---------- */

/** Fixed grading scale: minimum percentage for each grade. */
export const gradingScale = [
  ["A1", 91],
  ["A2", 81],
  ["B1", 71],
  ["B2", 61],
  ["C1", 51],
  ["C2", 41],
  ["D", 33],
  ["E", 0],
] as const;

export function gradeFor(percent: number) {
  return gradingScale.find(([, minimum]) => percent >= minimum)![0];
}

/* ---------- Exams and marks ---------- */

export function examsFor(
  learning: LearningSchool,
  school: AcademicSchool,
  actor: AssignmentActor,
  student?: string,
) {
  const active = school.years.find((item) => item.status === "Active")?.id;
  const exams = [...learning.exams].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (actor.role === "school-admin") return exams;
  if (actor.role === "teacher")
    return exams.filter((item) => item.year === active);
  const section = school.sections.find(
    (item) =>
      item.id === (student && currentEnrollment(school, student)?.section),
  );
  return exams.filter((item) => item.year === section?.year);
}

function replaceLearning(
  state: LearningState,
  actor: AssignmentActor,
  learning: LearningSchool,
): LearningState {
  return { ...state, schools: { ...state.schools, [actor.school]: learning } };
}

export function saveExam(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: Exam,
) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can set up exams.",
  );
  const learning = state.schools[actor.school];
  const name = value.name.trim();
  requireRule(name, "Enter an exam name.");
  const year = school.years.find((item) => item.id === value.year);
  requireRule(
    year && year.status !== "Archived",
    "Choose an open academic year.",
  );
  requireRule(
    validDate(value.date) && value.date >= year.start && value.date <= year.end,
    "Choose a date within the academic year.",
  );
  requireRule(
    Number.isInteger(value.maximum) &&
      value.maximum > 0 &&
      value.maximum <= 1000,
    "Maximum marks must be a whole number from 1 to 1000.",
  );
  requireRule(
    !learning.exams.some(
      (item) =>
        item.id !== value.id &&
        item.year === value.year &&
        item.name.toLowerCase() === name.toLowerCase(),
    ),
    "That exam already exists in this academic year.",
  );
  const existing = learning.exams.find((item) => item.id === value.id);
  const marked = learning.marks.some((item) => item.exam === value.id);
  requireRule(
    !marked ||
      (existing!.year === value.year && existing!.maximum === value.maximum),
    "Marks have been entered, so the year and maximum marks are locked.",
  );
  const exam = { ...value, name };
  return replaceLearning(state, actor, {
    ...learning,
    exams: existing
      ? learning.exams.map((item) => (item.id === value.id ? exam : item))
      : [...learning.exams, exam],
  });
}

/** Marks for every student on an allocation's roster: a number or "AB". */
export function saveMarks(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  examId: string,
  allocationId: string,
  entries: Record<string, string>,
) {
  const allocation = activeAllocations(school, actor).find(
    (item) => item.id === allocationId,
  );
  requireRule(
    actor.role === "teacher" && allocation,
    "Choose one of your teaching allocations.",
  );
  const learning = state.schools[actor.school];
  const exam = learning.exams.find((item) => item.id === examId);
  const section = school.sections.find(
    (item) => item.id === allocation.section,
  );
  requireRule(
    exam && exam.year === section?.year,
    "Choose an exam in this section's academic year.",
  );
  requireRule(!exam.published, "Results are published, so marks are locked.");
  const roster = attendanceRoster(school, allocation.section);
  requireRule(roster.length, "This section has no enrolled students.");
  const marks = roster.map((student) => {
    const raw = (entries[student.id] ?? "").trim().toUpperCase();
    requireRule(raw, "Enter marks or AB for every student.");
    if (raw === "AB")
      return {
        exam: examId,
        student: student.id,
        subject: allocation.subject,
        marks: null,
      };
    const value = Number(raw);
    requireRule(
      Number.isFinite(value) && value >= 0 && value <= exam.maximum,
      "Marks must be between 0 and " + exam.maximum + ".",
    );
    return {
      exam: examId,
      student: student.id,
      subject: allocation.subject,
      marks: value,
    };
  });
  const ids = new Set(roster.map((item) => item.id));
  return replaceLearning(state, actor, {
    ...learning,
    marks: [
      ...learning.marks.filter(
        (item) =>
          !(
            item.exam === examId &&
            item.subject === allocation.subject &&
            ids.has(item.student)
          ),
      ),
      ...marks,
    ],
  });
}

/** Totals, percentages and grades for one student in one exam. */
export function reportCard(
  learning: LearningSchool,
  school: AcademicSchool,
  student: string,
  examId: string,
) {
  const exam = learning.exams.find((item) => item.id === examId);
  const section = currentEnrollment(school, student)?.section;
  const subjects = [
    ...new Set(
      school.allocations
        .filter((item) => item.section === section)
        .map((item) => item.subject),
    ),
  ];
  const rows = subjects.map((subject) => {
    const mark = learning.marks.find(
      (item) =>
        item.exam === examId &&
        item.student === student &&
        item.subject === subject,
    );
    const marks = mark ? mark.marks : undefined;
    const percent =
      exam && typeof marks === "number"
        ? Math.round((100 * marks) / exam.maximum)
        : undefined;
    return {
      subject,
      name: school.subjects.find((item) => item.id === subject)?.name ?? "—",
      marks,
      percent,
      grade: percent === undefined ? undefined : gradeFor(percent),
    };
  });
  const entered = rows.filter((row) => row.marks !== undefined);
  const total = entered.reduce((sum, row) => sum + (row.marks ?? 0), 0);
  const maximum = entered.length * (exam?.maximum ?? 0);
  const percent = maximum ? Math.round((100 * total) / maximum) : undefined;
  return {
    exam,
    rows,
    total,
    maximum,
    percent,
    grade: percent === undefined ? undefined : gradeFor(percent),
    complete: rows.length > 0 && entered.length === rows.length,
  };
}

/** How many of an exam's section/subject mark sheets are complete. */
export function markingProgress(
  learning: LearningSchool,
  school: AcademicSchool,
  examId: string,
) {
  const exam = learning.exams.find((item) => item.id === examId);
  const sheets = school.allocations
    .filter((item) =>
      school.sections.some(
        (section) =>
          section.id === item.section &&
          section.year === exam?.year &&
          section.status === "Active",
      ),
    )
    .map((allocation) => {
      const roster = attendanceRoster(school, allocation.section);
      const done =
        roster.length > 0 &&
        roster.every((student) =>
          learning.marks.some(
            (item) =>
              item.exam === examId &&
              item.student === student.id &&
              item.subject === allocation.subject,
          ),
        );
      return { allocation, roster, done };
    });
  return {
    sheets,
    done: sheets.filter((item) => item.done).length,
    total: sheets.length,
  };
}

/* ---------- Weak-topic analysis ---------- */

export type TopicScore = {
  topic: string;
  title: string;
  chapter: string;
  subject: string;
  correct: number;
  total: number;
  percent: number;
};

/** Topic-wise scores from completed test attempts by the given students. */
export function topicScores(
  learning: LearningSchool,
  students: string[],
  now: Date,
  subjects?: string[],
) {
  const totals = new Map<string, { correct: number; total: number }>();
  for (const attempt of learning.attempts) {
    if (!students.includes(attempt.student)) continue;
    const test = learning.tests.find((item) => item.id === attempt.test);
    if (!test || !attemptComplete(test, attempt, now)) continue;
    for (const id of test.questions) {
      const question = learning.questions.find((item) => item.id === id);
      if (!question || (subjects && !subjects.includes(question.subject)))
        continue;
      const entry = totals.get(question.topic) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (attempt.answers[id] === question.answer) entry.correct += 1;
      totals.set(question.topic, entry);
    }
  }
  return [...totals].map(([topic, { correct, total }]): TopicScore => {
    const path = topicPath(learning, topic);
    return {
      topic,
      title: path.topic?.title ?? "Removed topic",
      chapter: path.chapter?.title ?? "—",
      subject: path.chapter?.subject ?? "",
      correct,
      total,
      percent: Math.round((100 * correct) / total),
    };
  });
}

export const weakThreshold = 60;

/** A student's topic scores beside their section's average, weakest first. */
export function studentTopicReport(
  learning: LearningSchool,
  school: AcademicSchool,
  student: string,
  now: Date,
) {
  const section = currentEnrollment(school, student)?.section;
  const classmates = section
    ? attendanceRoster(school, section).map((item) => item.id)
    : [student];
  const subjects = school.allocations
    .filter((item) => item.section === section)
    .map((item) => item.subject);
  const classScores = topicScores(learning, classmates, now, subjects);
  return topicScores(learning, [student], now, subjects)
    .map((score) => {
      const average = classScores.find(
        (item) => item.topic === score.topic,
      )?.percent;
      return {
        ...score,
        classAverage: average ?? score.percent,
        weak:
          score.percent < weakThreshold ||
          (average !== undefined && score.percent <= average - 10),
      };
    })
    .sort((a, b) => a.percent - b.percent || a.title.localeCompare(b.title));
}

/** Class topic scores for a section, weakest first, with students below the threshold. */
export function sectionTopicReport(
  learning: LearningSchool,
  school: AcademicSchool,
  section: string,
  now: Date,
  subjects?: string[],
) {
  const roster = attendanceRoster(school, section);
  const ids = roster.map((item) => item.id);
  return topicScores(learning, ids, now, subjects)
    .map((score) => ({
      ...score,
      struggling: roster.filter((student) => {
        const own = topicScores(learning, [student.id], now).find(
          (item) => item.topic === score.topic,
        );
        return own !== undefined && own.percent < weakThreshold;
      }),
    }))
    .sort((a, b) => a.percent - b.percent || a.title.localeCompare(b.title));
}

/* ---------- Practice ---------- */

function hash(text: string) {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/**
 * Practice questions from the learner's subjects, weak topics first.
 * The same seed (for example, today's date) gives the same set.
 */
export function practiceSet(
  learning: LearningSchool,
  school: AcademicSchool,
  actor: AssignmentActor,
  student: string,
  size: number,
  seed: string,
  now: Date,
) {
  const subjects = subjectsFor(school, actor);
  const weak = new Set(
    studentTopicReport(learning, school, student, now)
      .filter((item) => item.weak)
      .map((item) => item.topic),
  );
  const order = (question: Question) => hash(seed + question.id);
  const pool = learning.questions.filter((item) =>
    subjects.includes(item.subject),
  );
  const pickFrom = (rows: Question[]) =>
    [...rows].sort((a, b) => order(a) - order(b));
  return [
    ...pickFrom(pool.filter((item) => weak.has(item.topic))),
    ...pickFrom(pool.filter((item) => !weak.has(item.topic))),
  ]
    .slice(0, size)
    .map((question) => ({ question, weak: weak.has(question.topic) }));
}

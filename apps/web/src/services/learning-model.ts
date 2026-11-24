import { academicRecords } from "@/mocks/academics";
import type { SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
} from "./academic-model";
import { activeAllocations, type AssignmentActor } from "./assignment-model";

/* ---------- Types ---------- */

export type Chapter = {
  id: string;
  subject: string;
  title: string;
  order: number;
};
export type Topic = { id: string; chapter: string; title: string };
export const materialKinds = ["Notes", "PDF", "Video link"] as const;
export type MaterialKind = (typeof materialKinds)[number];
export type Material = {
  id: string;
  topic: string;
  kind: MaterialKind;
  title: string;
  body: string;
  url: string;
};
export const difficulties = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof difficulties)[number];
export type Question = {
  id: string;
  subject: string;
  topic: string;
  text: string;
  options: string[];
  answer: number;
  difficulty: Difficulty;
};
/** Times are local "YYYY-MM-DDTHH:mm" strings. */
export type OnlineTest = {
  id: string;
  allocation: string;
  title: string;
  questions: string[];
  duration: number;
  opens: string;
  closes: string;
  published: boolean;
};
/** `started` and `submitted` are ISO timestamps; `submitted` is "" while in progress. */
export type Attempt = {
  test: string;
  student: string;
  answers: Record<string, number>;
  started: string;
  submitted: string;
};
export type Exam = {
  id: string;
  year: string;
  name: string;
  date: string;
  maximum: number;
  published: boolean;
};
/** `marks` is null when the student was absent. */
export type Mark = {
  exam: string;
  student: string;
  subject: string;
  marks: number | null;
};
export type LearningSchool = {
  chapters: Chapter[];
  topics: Topic[];
  materials: Material[];
  questions: Question[];
  tests: OnlineTest[];
  attempts: Attempt[];
  exams: Exam[];
  marks: Mark[];
};
export type LearningState = {
  version: 1;
  schools: Record<SchoolId, LearningSchool>;
};

/* ---------- Seed ---------- */

type SeedQuestion = [string, string[], number, Difficulty];
type SeedTopic = [title: string, notes: string, questions: SeedQuestion[]];
type SeedChapter = [title: string, topics: SeedTopic[]];

const mathematics: SeedChapter[] = [
  [
    "Integers",
    [
      [
        "Negative numbers",
        "Multiplying or dividing two numbers with the same sign gives a positive result; different signs give a negative result. Adding a negative number moves left on the number line.",
        [
          ["What is (−4) × (−3)?", ["−12", "12", "−7", "7"], 1, "Easy"],
          ["What is −8 + 5?", ["−3", "3", "−13", "13"], 0, "Easy"],
        ],
      ],
      [
        "Order of operations",
        "Work inside brackets first, then multiplication and division from left to right, then addition and subtraction from left to right.",
        [
          ["Evaluate 6 + 4 × 3.", ["30", "18", "13", "24"], 1, "Easy"],
          ["Evaluate (10 − 4) ÷ 2 + 3.", ["6", "9", "4", "3"], 0, "Medium"],
        ],
      ],
    ],
  ],
  [
    "Fractions and decimals",
    [
      [
        "Equivalent fractions",
        "Multiply or divide the numerator and denominator by the same number to get an equivalent fraction. Simplify by dividing both by their highest common factor.",
        [
          [
            "Which fraction is equal to 3/4?",
            ["6/8", "4/6", "9/16", "3/8"],
            0,
            "Easy",
          ],
          ["Simplify 18/24.", ["2/3", "3/4", "9/12", "6/8"], 1, "Medium"],
        ],
      ],
      [
        "Converting fractions to decimals",
        "Divide the numerator by the denominator. Fractions with denominators of 10, 100 or 1000 can be written directly as decimals.",
        [
          [
            "Write 3/8 as a decimal.",
            ["0.38", "0.375", "0.83", "0.35"],
            1,
            "Medium",
          ],
          [
            "Which fraction equals 0.6?",
            ["3/5", "6/100", "1/6", "2/3"],
            0,
            "Easy",
          ],
        ],
      ],
    ],
  ],
  [
    "Algebra basics",
    [
      [
        "Expressions",
        "Collect like terms and expand brackets by multiplying every term inside by the term outside. Substitute values carefully, one letter at a time.",
        [
          [
            "Simplify 3(x + 4) − 2x.",
            ["x + 12", "5x + 4", "x + 4", "x − 12"],
            0,
            "Medium",
          ],
          [
            "What is 2a + b when a = 3 and b = 4?",
            ["10", "14", "9", "24"],
            0,
            "Easy",
          ],
        ],
      ],
      [
        "Simple equations",
        "Do the same operation to both sides to keep the equation balanced. Undo addition or subtraction first, then multiplication or division.",
        [
          [
            "Solve 2x + 5 = 17.",
            ["x = 6", "x = 11", "x = 7", "x = 8.5"],
            0,
            "Easy",
          ],
          [
            "Solve 3(x − 2) = 12.",
            ["x = 6", "x = 2", "x = 4", "x = 14/3"],
            0,
            "Medium",
          ],
        ],
      ],
    ],
  ],
];

const science: SeedChapter[] = [
  [
    "Living systems",
    [
      [
        "Photosynthesis",
        "Plants use light energy, carbon dioxide and water to make glucose and release oxygen. It happens in chloroplasts, which contain chlorophyll.",
        [
          [
            "Which gas do plants take in for photosynthesis?",
            ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
            1,
            "Easy",
          ],
          [
            "Where in a plant cell does photosynthesis happen?",
            ["Nucleus", "Chloroplast", "Cell wall", "Vacuole"],
            1,
            "Easy",
          ],
        ],
      ],
      [
        "Food chains",
        "A food chain starts with a producer and shows what eats what. Arrows point in the direction energy flows, from the food to the feeder.",
        [
          [
            "In a food chain, which organism is a producer?",
            ["Grass", "Rabbit", "Fox", "Hawk"],
            0,
            "Easy",
          ],
          [
            "What do the arrows in a food chain show?",
            [
              "Which animal is bigger",
              "The flow of energy",
              "Where animals live",
              "The order of extinction",
            ],
            1,
            "Medium",
          ],
        ],
      ],
    ],
  ],
  [
    "Matter",
    [
      [
        "States of matter",
        "Solids keep their shape, liquids take the shape of their container, and gases fill any space. Heating or cooling changes the state.",
        [
          [
            "Which state of matter has a fixed shape?",
            ["Solid", "Liquid", "Gas", "Plasma"],
            0,
            "Easy",
          ],
          [
            "What is it called when a liquid turns into a gas?",
            ["Condensation", "Evaporation", "Freezing", "Melting"],
            1,
            "Easy",
          ],
        ],
      ],
      [
        "Mixtures and solutions",
        "A mixture can be separated by physical methods such as filtering, evaporating or using a magnet. A solution forms when a solute dissolves in a solvent.",
        [
          [
            "Which method separates sand from water?",
            ["Filtration", "Evaporation", "Magnetism", "Chromatography"],
            0,
            "Medium",
          ],
          [
            "Salt dissolved in water is an example of a…",
            ["Solution", "Suspension", "Compound", "Element"],
            0,
            "Easy",
          ],
        ],
      ],
    ],
  ],
];

function seedSchool(prefix: SchoolId): LearningSchool {
  const school: LearningSchool = {
    chapters: [],
    topics: [],
    materials: [],
    questions: [],
    tests: [],
    attempts: [],
    exams: [],
    marks: [],
  };
  const banks = [mathematics, science];
  const topicQuestions: string[][][] = [];
  banks.forEach((bank, subjectIndex) => {
    const subject = prefix + "-subject-" + subjectIndex;
    topicQuestions[subjectIndex] = [];
    bank.forEach(([chapterTitle, topics], chapterIndex) => {
      const chapter = prefix + "-ch-" + subjectIndex + "-" + chapterIndex;
      school.chapters.push({
        id: chapter,
        subject,
        title: chapterTitle,
        order: chapterIndex + 1,
      });
      topics.forEach(([title, notes, questions], topicIndex) => {
        const key = subjectIndex + "-" + chapterIndex + "-" + topicIndex;
        const topic = prefix + "-tp-" + key;
        school.topics.push({ id: topic, chapter, title });
        school.materials.push({
          id: prefix + "-mt-" + key + "-notes",
          topic,
          kind: "Notes",
          title: title + " · key notes",
          body: notes,
          url: "",
        });
        if (topicIndex === 0)
          school.materials.push(
            {
              id: prefix + "-mt-" + key + "-pdf",
              topic,
              kind: "PDF",
              title: chapterTitle + " worksheet",
              body: "",
              url: "https://example.org/school-lms/worksheet-" + key + ".pdf",
            },
            {
              id: prefix + "-mt-" + key + "-video",
              topic,
              kind: "Video link",
              title: title + " explained",
              body: "",
              url: "https://example.org/school-lms/video-" + key,
            },
          );
        const ids = questions.map(([text, options, answer, difficulty], n) => {
          const id = prefix + "-q-" + key + "-" + n;
          school.questions.push({
            id,
            subject,
            topic,
            text,
            options,
            answer,
            difficulty,
          });
          return id;
        });
        topicQuestions[subjectIndex].push(ids);
      });
    });
  });
  const pick = (subjectIndex: number, topics: number[]) =>
    topics.flatMap((index) => topicQuestions[subjectIndex][index]);
  const closed = { opens: "2026-11-10T09:00", closes: "2026-11-12T17:00" };
  const open = { opens: "2026-11-20T08:00", closes: "2027-05-31T17:00" };
  school.tests.push(
    {
      id: prefix + "-test-0",
      allocation: prefix + "-class-0-allocation",
      title: "Integers & fractions check",
      questions: pick(0, [0, 1, 2, 3]),
      duration: 20,
      ...closed,
      published: true,
    },
    {
      id: prefix + "-test-1",
      allocation: prefix + "-class-0-allocation",
      title: "Algebra basics quiz",
      questions: pick(0, [4, 5]),
      duration: 15,
      ...open,
      published: true,
    },
    {
      id: prefix + "-test-2",
      allocation: prefix + "-class-1-allocation",
      title: "Living systems check",
      questions: pick(1, [0, 1]),
      duration: 15,
      ...closed,
      published: true,
    },
    {
      id: prefix + "-test-3",
      allocation: prefix + "-class-1-allocation",
      title: "Matter quiz",
      questions: pick(1, [2, 3]),
      duration: 15,
      ...open,
      published: true,
    },
    {
      // Class 10: a timed revision test ahead of the board exams.
      id: prefix + "-test-senior",
      allocation: prefix + "-class-senior-allocation-0",
      title: "Board revision: algebra",
      questions: pick(0, [4, 5]),
      duration: 25,
      ...open,
      published: true,
    },
  );
  const answer = (id: string, correct: boolean) => {
    const question = school.questions.find((item) => item.id === id)!;
    return correct
      ? question.answer
      : (question.answer + 1) % question.options.length;
  };
  const attempt = (test: string, student: string, wrong: number[]): Attempt => {
    const ids = school.tests.find((item) => item.id === test)!.questions;
    return {
      test,
      student,
      answers: Object.fromEntries(
        ids.map((id, index) => [id, answer(id, !wrong.includes(index))]),
      ),
      started: "2026-11-11T04:30:00.000Z",
      submitted: "2026-11-11T04:44:00.000Z",
    };
  };
  // Student 0 misses both negative-number questions and one conversion.
  school.attempts.push(
    attempt(prefix + "-test-0", prefix + "-student-0", [0, 1, 7]),
  );
  // Student 1 misses one food-chain question.
  school.attempts.push(attempt(prefix + "-test-2", prefix + "-student-1", [3]));
  const year = prefix + "-year";
  school.exams.push(
    {
      id: prefix + "-exam-0",
      year,
      name: "Unit Test 1",
      date: "2026-09-15",
      maximum: 50,
      published: true,
    },
    {
      id: prefix + "-exam-1",
      year,
      name: "Mid-term Examination",
      date: "2026-11-30",
      maximum: 100,
      published: false,
    },
  );
  school.marks.push(
    {
      exam: prefix + "-exam-0",
      student: prefix + "-student-0",
      subject: prefix + "-subject-0",
      marks: 41,
    },
    {
      exam: prefix + "-exam-0",
      student: prefix + "-student-1",
      subject: prefix + "-subject-1",
      marks: 36,
    },
    // The Class 10 student sat Unit Test 1 in every subject.
    ...[44, 39, 42].map((marks, index) => ({
      exam: prefix + "-exam-0",
      student: prefix + "-student-senior",
      subject: prefix + "-subject-" + index,
      marks,
    })),
  );
  return school;
}

export const learningSeed: LearningState = {
  version: 1,
  schools: Object.fromEntries(
    academicRecords.map((source) => [
      source.schoolId,
      seedSchool(source.schoolId),
    ]),
  ) as LearningState["schools"],
};

const isString = (value: unknown) => typeof value === "string";
const tableChecks: Record<keyof LearningSchool, (row: never) => boolean> = {
  chapters: (row: Chapter) =>
    [row.id, row.subject, row.title].every(isString) &&
    Number.isFinite(row.order),
  topics: (row: Topic) => [row.id, row.chapter, row.title].every(isString),
  materials: (row: Material) =>
    [row.id, row.topic, row.title, row.body, row.url].every(isString) &&
    materialKinds.includes(row.kind),
  questions: (row: Question) =>
    [row.id, row.subject, row.topic, row.text].every(isString) &&
    Array.isArray(row.options) &&
    row.options.every(isString) &&
    Number.isInteger(row.answer) &&
    difficulties.includes(row.difficulty),
  tests: (row: OnlineTest) =>
    [row.id, row.allocation, row.title, row.opens, row.closes].every(
      isString,
    ) &&
    Array.isArray(row.questions) &&
    row.questions.every(isString) &&
    Number.isFinite(row.duration) &&
    typeof row.published === "boolean",
  attempts: (row: Attempt) =>
    [row.test, row.student, row.started, row.submitted].every(isString) &&
    !!row.answers &&
    typeof row.answers === "object" &&
    Object.values(row.answers).every((value) => Number.isInteger(value)),
  exams: (row: Exam) =>
    [row.id, row.year, row.name, row.date].every(isString) &&
    Number.isFinite(row.maximum) &&
    typeof row.published === "boolean",
  marks: (row: Mark) =>
    [row.exam, row.student, row.subject].every(isString) &&
    (row.marks === null || Number.isFinite(row.marks)),
};

export function decodeLearningState(raw: string | null): LearningState {
  if (!raw) return learningSeed;
  try {
    const data = JSON.parse(raw) as LearningState;
    if (data?.version !== 1 || !data.schools) return learningSeed;
    const valid = Object.keys(learningSeed.schools).every((id) => {
      const school = data.schools[id as SchoolId];
      return (
        !!school &&
        (Object.keys(tableChecks) as (keyof LearningSchool)[]).every(
          (table) =>
            Array.isArray(school[table]) &&
            (school[table] as never[]).every(
              (row) => !!row && tableChecks[table](row),
            ),
        )
      );
    });
    return valid ? data : learningSeed;
  } catch {
    return learningSeed;
  }
}

/* ---------- Shared helpers ---------- */

export function localDateTime(date = new Date()) {
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

export function validDateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/.exec(value);
  return !!match && validDate(match[1]);
}

function replaceSchool(
  state: LearningState,
  actor: AssignmentActor,
  school: LearningSchool,
): LearningState {
  return { ...state, schools: { ...state.schools, [actor.school]: school } };
}

function upsert<T extends { id: string }>(rows: T[], value: T) {
  return rows.some((row) => row.id === value.id)
    ? rows.map((row) => (row.id === value.id ? value : row))
    : [...rows, value];
}

/** The student whose learning data the actor may see. */
export function learnerFor(school: AcademicSchool, actor: AssignmentActor) {
  if (actor.role === "student")
    return school.students.some((item) => item.id === actor.person)
      ? actor.person
      : undefined;
  if (actor.role === "parent")
    return linkedStudents(school, actor.person).find(
      (item) => item.id === actor.child,
    )?.id;
  return undefined;
}

/** Subjects the actor teaches or studies in the active year. */
export function subjectsFor(school: AcademicSchool, actor: AssignmentActor) {
  if (actor.role === "school-admin")
    return school.subjects.map((item) => item.id);
  return [
    ...new Set(activeAllocations(school, actor).map((item) => item.subject)),
  ];
}

function requireTeacherSubject(
  school: AcademicSchool,
  actor: AssignmentActor,
  subject: string,
) {
  requireRule(
    actor.role === "teacher" && subjectsFor(school, actor).includes(subject),
    "Choose one of the subjects you teach.",
  );
}

export function topicPath(learning: LearningSchool, topicId: string) {
  const topic = learning.topics.find((item) => item.id === topicId);
  const chapter = learning.chapters.find((item) => item.id === topic?.chapter);
  return { topic, chapter };
}

/* ---------- Learning content ---------- */

export function chaptersFor(learning: LearningSchool, subject: string) {
  return learning.chapters
    .filter((item) => item.subject === subject)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function saveChapter(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: Chapter,
) {
  const learning = state.schools[actor.school];
  requireTeacherSubject(school, actor, value.subject);
  const existing = learning.chapters.find((item) => item.id === value.id);
  requireRule(
    !existing || existing.subject === value.subject,
    "A chapter can't move to another subject.",
  );
  const title = value.title.trim();
  requireRule(title, "Enter a chapter title.");
  requireRule(
    Number.isInteger(value.order) && value.order > 0,
    "Enter a positive whole number for the chapter order.",
  );
  requireRule(
    !learning.chapters.some(
      (item) =>
        item.id !== value.id &&
        item.subject === value.subject &&
        item.title.toLowerCase() === title.toLowerCase(),
    ),
    "This subject already has a chapter with that title.",
  );
  return replaceSchool(state, actor, {
    ...learning,
    chapters: upsert(learning.chapters, { ...value, title }),
  });
}

export function saveTopic(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: Topic,
) {
  const learning = state.schools[actor.school];
  const chapter = learning.chapters.find((item) => item.id === value.chapter);
  requireRule(chapter, "Choose a chapter.");
  requireTeacherSubject(school, actor, chapter.subject);
  const existing = learning.topics.find((item) => item.id === value.id);
  requireRule(
    !existing || existing.chapter === value.chapter,
    "A topic can't move to another chapter.",
  );
  const title = value.title.trim();
  requireRule(title, "Enter a topic title.");
  requireRule(
    !learning.topics.some(
      (item) =>
        item.id !== value.id &&
        item.chapter === value.chapter &&
        item.title.toLowerCase() === title.toLowerCase(),
    ),
    "This chapter already has a topic with that title.",
  );
  return replaceSchool(state, actor, {
    ...learning,
    topics: upsert(learning.topics, { ...value, title }),
  });
}

export function saveMaterial(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: Material,
) {
  const learning = state.schools[actor.school];
  const { chapter } = topicPath(learning, value.topic);
  requireRule(chapter, "Choose a topic.");
  requireTeacherSubject(school, actor, chapter.subject);
  requireRule(materialKinds.includes(value.kind), "Choose a material type.");
  const title = value.title.trim();
  const body = value.body.trim();
  const url = value.url.trim();
  requireRule(title, "Enter a title.");
  if (value.kind === "Notes") requireRule(body, "Write the notes.");
  else
    requireRule(
      /^https?:\/\/\S+\.\S+/.test(url),
      "Enter a link starting with http:// or https://.",
    );
  return replaceSchool(state, actor, {
    ...learning,
    materials: upsert(learning.materials, {
      ...value,
      title,
      body: value.kind === "Notes" ? body : "",
      url: value.kind === "Notes" ? "" : url,
    }),
  });
}

export function removeContent(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  table: "chapters" | "topics" | "materials",
  id: string,
) {
  const learning = state.schools[actor.school];
  const subject =
    table === "chapters"
      ? learning.chapters.find((item) => item.id === id)?.subject
      : table === "topics"
        ? topicPath(learning, id).chapter?.subject
        : topicPath(
            learning,
            learning.materials.find((item) => item.id === id)?.topic ?? "",
          ).chapter?.subject;
  requireRule(subject, "This item is unavailable.");
  requireTeacherSubject(school, actor, subject);
  if (table === "chapters")
    requireRule(
      !learning.topics.some((item) => item.chapter === id),
      "Remove the chapter's topics first.",
    );
  if (table === "topics")
    requireRule(
      !learning.questions.some((item) => item.topic === id) &&
        !learning.materials.some((item) => item.topic === id),
      "Remove the topic's materials and questions first.",
    );
  return replaceSchool(state, actor, {
    ...learning,
    [table]: (learning[table] as { id: string }[]).filter(
      (item) => item.id !== id,
    ),
  });
}

/* ---------- Question bank ---------- */

function questionInUse(learning: LearningSchool, id: string) {
  return learning.tests.filter((test) => test.questions.includes(id));
}

export function saveQuestion(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: Question,
) {
  const learning = state.schools[actor.school];
  const { chapter } = topicPath(learning, value.topic);
  requireRule(chapter, "Choose a topic for this question.");
  requireTeacherSubject(school, actor, chapter.subject);
  const options = value.options.map((item) => item.trim()).filter(Boolean);
  const text = value.text.trim();
  requireRule(text, "Enter the question.");
  requireRule(
    options.length >= 2 && options.length <= 6,
    "Enter between two and six options.",
  );
  requireRule(
    new Set(options.map((item) => item.toLowerCase())).size === options.length,
    "Each option must be different.",
  );
  requireRule(
    Number.isInteger(value.answer) &&
      value.answer >= 0 &&
      value.answer < options.length,
    "Choose which option is correct.",
  );
  requireRule(difficulties.includes(value.difficulty), "Choose a difficulty.");
  const existing = learning.questions.find((item) => item.id === value.id);
  if (existing) {
    const attempted = questionInUse(learning, value.id).some((test) =>
      learning.attempts.some((item) => item.test === test.id),
    );
    requireRule(
      !attempted ||
        (existing.answer === value.answer &&
          existing.options.join("\n") === options.join("\n") &&
          existing.topic === value.topic),
      "Students have already answered this question, so its options, answer and topic are locked.",
    );
  }
  return replaceSchool(state, actor, {
    ...learning,
    questions: upsert(learning.questions, {
      ...value,
      subject: chapter.subject,
      text,
      options,
    }),
  });
}

export function removeQuestion(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
) {
  const learning = state.schools[actor.school];
  const question = learning.questions.find((item) => item.id === id);
  requireRule(question, "This question is unavailable.");
  requireTeacherSubject(school, actor, question.subject);
  requireRule(
    !questionInUse(learning, id).length,
    "Remove this question from its tests first.",
  );
  return replaceSchool(state, actor, {
    ...learning,
    questions: learning.questions.filter((item) => item.id !== id),
  });
}

/* ---------- Online tests ---------- */

export type TestStatus = "Draft" | "Upcoming" | "Open" | "Closed";

export function testStatus(test: OnlineTest, now: Date): TestStatus {
  if (!test.published) return "Draft";
  const current = localDateTime(now);
  if (current < test.opens) return "Upcoming";
  return current < test.closes ? "Open" : "Closed";
}

export function testsFor(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
) {
  const allocations = new Set(
    activeAllocations(school, actor).map((item) => item.id),
  );
  return state.schools[actor.school].tests
    .filter(
      (test) =>
        allocations.has(test.allocation) &&
        (actor.role === "teacher" || test.published),
    )
    .sort((a, b) => b.opens.localeCompare(a.opens));
}

export function saveTest(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: OnlineTest,
) {
  const learning = state.schools[actor.school];
  const allocation = activeAllocations(school, actor).find(
    (item) => item.id === value.allocation,
  );
  requireRule(
    actor.role === "teacher" && allocation,
    "Choose one of your teaching allocations.",
  );
  const existing = learning.tests.find((item) => item.id === value.id);
  requireRule(
    !existing || testsFor(state, school, actor).some((t) => t.id === value.id),
    "This test belongs to another teacher.",
  );
  const title = value.title.trim();
  requireRule(title, "Enter a test title.");
  requireRule(value.questions.length > 0, "Add at least one question.");
  requireRule(
    new Set(value.questions).size === value.questions.length &&
      value.questions.every((id) =>
        learning.questions.some(
          (item) => item.id === id && item.subject === allocation.subject,
        ),
      ),
    "Choose questions from this subject's question bank.",
  );
  requireRule(
    Number.isInteger(value.duration) &&
      value.duration >= 5 &&
      value.duration <= 180,
    "Set a duration between 5 and 180 minutes.",
  );
  requireRule(
    validDateTime(value.opens) &&
      validDateTime(value.closes) &&
      value.opens < value.closes,
    "Enter valid times with the opening before the closing.",
  );
  const attempted = learning.attempts.some((item) => item.test === value.id);
  requireRule(
    !attempted ||
      (existing!.allocation === value.allocation &&
        existing!.questions.join() === value.questions.join() &&
        value.published),
    "Students have started this test, so its class and questions are locked and it must stay published.",
  );
  return replaceSchool(state, actor, {
    ...learning,
    tests: upsert(learning.tests, { ...value, title }),
  });
}

/** Closes an open test now so students can see their results. */
export function closeTest(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  id: string,
  now = new Date(),
) {
  const test = testsFor(state, school, actor).find((item) => item.id === id);
  requireRule(
    actor.role === "teacher" && test,
    "This test belongs to another teacher.",
  );
  requireRule(
    testStatus(test, now) === "Open",
    "Only an open test can be closed.",
  );
  const learning = state.schools[actor.school];
  const closes = localDateTime(now);
  return replaceSchool(state, actor, {
    ...learning,
    tests: learning.tests.map((item) =>
      item.id === id
        ? { ...item, closes, opens: item.opens < closes ? item.opens : closes }
        : item,
    ),
  });
}

export function attemptFor(
  learning: LearningSchool,
  test: string,
  student: string | undefined,
) {
  return learning.attempts.find(
    (item) => item.test === test && item.student === student,
  );
}

/** The moment an attempt must end: its time limit or the test closing. */
export function attemptDeadline(test: OnlineTest, attempt: Attempt) {
  return Math.min(
    new Date(attempt.started).getTime() + test.duration * 60_000,
    new Date(test.closes).getTime(),
  );
}

export function attemptComplete(
  test: OnlineTest,
  attempt: Attempt | undefined,
  now: Date,
) {
  return (
    !!attempt &&
    (!!attempt.submitted || now.getTime() >= attemptDeadline(test, attempt))
  );
}

function studentTest(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  testId: string,
) {
  requireRule(actor.role === "student", "Only students can take tests.");
  const test = testsFor(state, school, actor).find(
    (item) => item.id === testId,
  );
  requireRule(test, "This test is unavailable for your class.");
  return test;
}

export function startAttempt(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  testId: string,
  now = new Date(),
) {
  const test = studentTest(state, school, actor, testId);
  const learning = state.schools[actor.school];
  const existing = attemptFor(learning, testId, actor.person);
  if (existing && !attemptComplete(test, existing, now)) return state;
  requireRule(!existing, "You have already completed this test.");
  requireRule(testStatus(test, now) === "Open", "This test is not open.");
  return replaceSchool(state, actor, {
    ...learning,
    attempts: [
      ...learning.attempts,
      {
        test: testId,
        student: actor.person,
        answers: {},
        started: now.toISOString(),
        submitted: "",
      },
    ],
  });
}

function updateAttempt(
  state: LearningState,
  actor: AssignmentActor,
  attempt: Attempt,
  next: Attempt,
) {
  const learning = state.schools[actor.school];
  return replaceSchool(state, actor, {
    ...learning,
    attempts: learning.attempts.map((item) => (item === attempt ? next : item)),
  });
}

export function answerQuestion(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  testId: string,
  questionId: string,
  choice: number,
  now = new Date(),
) {
  const test = studentTest(state, school, actor, testId);
  const learning = state.schools[actor.school];
  const attempt = attemptFor(learning, testId, actor.person);
  requireRule(attempt && !attempt.submitted, "Start the test first.");
  requireRule(
    now.getTime() < attemptDeadline(test, attempt),
    "Time is up for this test.",
  );
  const question = learning.questions.find((item) => item.id === questionId);
  requireRule(
    question && test.questions.includes(questionId),
    "This question is not part of the test.",
  );
  requireRule(
    Number.isInteger(choice) && choice >= 0 && choice < question.options.length,
    "Choose one of the options.",
  );
  return updateAttempt(state, actor, attempt, {
    ...attempt,
    answers: { ...attempt.answers, [questionId]: choice },
  });
}

export function submitAttempt(
  state: LearningState,
  school: AcademicSchool,
  actor: AssignmentActor,
  testId: string,
  now = new Date(),
) {
  studentTest(state, school, actor, testId);
  const learning = state.schools[actor.school];
  const attempt = attemptFor(learning, testId, actor.person);
  requireRule(attempt, "Start the test first.");
  if (attempt.submitted) return state;
  return updateAttempt(state, actor, attempt, {
    ...attempt,
    submitted: now.toISOString(),
  });
}

/** Auto-evaluates an attempt against the answer key. */
export function scoreAttempt(
  learning: LearningSchool,
  test: OnlineTest,
  attempt: Attempt,
) {
  const correct = test.questions.filter((id) => {
    const question = learning.questions.find((item) => item.id === id);
    return question && attempt.answers[id] === question.answer;
  }).length;
  return {
    correct,
    total: test.questions.length,
    percent: test.questions.length
      ? Math.round((100 * correct) / test.questions.length)
      : 0,
  };
}

/** Students see scores and answers only after the test closes. */
export function resultsReleased(test: OnlineTest, now: Date) {
  return testStatus(test, now) === "Closed";
}

export function learnerSection(school: AcademicSchool, student?: string) {
  return student ? currentEnrollment(school, student)?.section : undefined;
}

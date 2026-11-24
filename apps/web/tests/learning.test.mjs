import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(
        new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href,
        context,
      );
    }
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    ) {
      return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});

const { academicSeed } = await import("../src/services/academic-seed.ts");
const learning = await import("../src/services/learning-model.ts");
const results = await import("../src/services/results-model.ts");

const {
  learningSeed,
  decodeLearningState,
  saveChapter,
  saveTopic,
  saveMaterial,
  removeContent,
  saveQuestion,
  removeQuestion,
  saveTest,
  closeTest,
  testsFor,
  testStatus,
  startAttempt,
  answerQuestion,
  submitAttempt,
  scoreAttempt,
  attemptFor,
  resultsReleased,
} = learning;

const school = academicSeed.schools.westfield;
const admin = {
  school: "westfield",
  role: "school-admin",
  person: "westfield-admin",
};
const teacher = {
  school: "westfield",
  role: "teacher",
  person: "westfield-teacher",
};
const student = {
  school: "westfield",
  role: "student",
  person: "westfield-student-0",
};
const otherStudent = { ...student, person: "westfield-student-1" };
const parent = {
  school: "westfield",
  role: "parent",
  person: "westfield-parent",
  child: "westfield-student-0",
};
const math = "westfield-subject-0";
const allocation = "westfield-class-0-allocation";
const at = (value) => new Date(value);
const data = (state) => state.schools.westfield;

test("teachers manage chapters, topics and materials only for their subjects", () => {
  let state = saveChapter(learningSeed, school, teacher, {
    id: "ch-new",
    subject: math,
    title: "  Geometry  ",
    order: 4,
  });
  assert.equal(data(state).chapters.at(-1).title, "Geometry");
  assert.throws(
    () =>
      saveChapter(state, school, teacher, {
        id: "dup",
        subject: math,
        title: "geometry",
        order: 5,
      }),
    /already has a chapter/,
  );
  assert.throws(
    () =>
      saveChapter(state, school, student, {
        id: "x",
        subject: math,
        title: "Nope",
        order: 1,
      }),
    /subjects you teach/,
  );
  assert.throws(
    () =>
      saveChapter(state, school, teacher, {
        id: "x",
        subject: "westfield-subject-2",
        title: "Not mine",
        order: 1,
      }),
    /subjects you teach/,
  );
  state = saveTopic(state, school, teacher, {
    id: "tp-new",
    chapter: "ch-new",
    title: "Angles",
  });
  assert.throws(
    () =>
      saveMaterial(state, school, teacher, {
        id: "m",
        topic: "tp-new",
        kind: "Video link",
        title: "Video",
        body: "",
        url: "not a link",
      }),
    /http/,
  );
  state = saveMaterial(state, school, teacher, {
    id: "m",
    topic: "tp-new",
    kind: "Notes",
    title: "Angle notes",
    body: "Angles on a line add to 180°.",
    url: "ignored",
  });
  assert.equal(data(state).materials.at(-1).url, "");
  assert.throws(
    () => removeContent(state, school, teacher, "chapters", "ch-new"),
    /topics first/,
  );
  assert.throws(
    () => removeContent(state, school, teacher, "topics", "tp-new"),
    /materials and questions first/,
  );
  state = removeContent(state, school, teacher, "materials", "m");
  state = removeContent(state, school, teacher, "topics", "tp-new");
  state = removeContent(state, school, teacher, "chapters", "ch-new");
  assert.deepEqual(data(state).chapters, data(learningSeed).chapters);
  assert.equal(state.schools.cedar, learningSeed.schools.cedar);
});

test("the question bank validates options and locks answered questions", () => {
  const topic = "westfield-tp-0-2-0";
  const question = {
    id: "q-new",
    subject: "",
    topic,
    text: "What is 7 × 8?",
    options: ["54", " 56 ", "", "64"],
    answer: 1,
    difficulty: "Easy",
  };
  const state = saveQuestion(learningSeed, school, teacher, question);
  const saved = data(state).questions.at(-1);
  assert.deepEqual(saved.options, ["54", "56", "64"]);
  assert.equal(saved.subject, math);
  assert.throws(
    () =>
      saveQuestion(state, school, teacher, {
        ...question,
        options: ["a", "A"],
      }),
    /different/,
  );
  assert.throws(
    () => saveQuestion(state, school, teacher, { ...question, answer: 5 }),
    /correct/,
  );
  const answered = data(learningSeed).questions[0];
  assert.throws(
    () =>
      saveQuestion(learningSeed, school, teacher, { ...answered, answer: 0 }),
    /locked/,
  );
  assert.doesNotThrow(() =>
    saveQuestion(learningSeed, school, teacher, {
      ...answered,
      text: "Reworded?",
    }),
  );
  assert.throws(
    () => removeQuestion(learningSeed, school, teacher, answered.id),
    /tests first/,
  );
  assert.equal(
    data(removeQuestion(state, school, teacher, "q-new")).questions.length,
    data(learningSeed).questions.length,
  );
});

test("tests validate questions, timing and ownership", () => {
  const base = {
    id: "t-new",
    allocation,
    title: "Practice test",
    questions: ["westfield-q-0-0-0-0"],
    duration: 10,
    opens: "2026-12-01T09:00",
    closes: "2026-12-01T10:00",
    published: false,
  };
  const state = saveTest(learningSeed, school, teacher, base);
  assert.equal(
    testStatus(data(state).tests.at(-1), at("2026-12-01T09:30")),
    "Draft",
  );
  assert.throws(
    () =>
      saveTest(state, school, teacher, {
        ...base,
        questions: ["westfield-q-1-0-0-0"],
      }),
    /this subject/,
  );
  assert.throws(
    () => saveTest(state, school, teacher, { ...base, closes: base.opens }),
    /opening before the closing/,
  );
  assert.throws(
    () => saveTest(state, school, teacher, { ...base, duration: 2 }),
    /between 5 and 180/,
  );
  assert.throws(
    () => saveTest(state, school, student, base),
    /teaching allocations/,
  );
  const attempted = data(learningSeed).tests[0];
  assert.throws(
    () =>
      saveTest(learningSeed, school, teacher, {
        ...attempted,
        questions: attempted.questions.slice(1),
      }),
    /locked/,
  );
  assert.equal(
    testsFor(state, school, student).some((t) => t.id === "t-new"),
    false,
  );
  assert.equal(
    testsFor(state, school, teacher).some((t) => t.id === "t-new"),
    true,
  );
  assert.equal(testsFor(learningSeed, school, otherStudent).length, 2);
});

test("students take a timed test once; scores release when it closes", () => {
  const testId = "westfield-test-1";
  const opened = at("2026-11-23T10:00");
  let state = startAttempt(learningSeed, school, student, testId, opened);
  assert.equal(startAttempt(state, school, student, testId, opened), state);
  const runningTest = data(state).tests.find((t) => t.id === testId);
  for (const id of runningTest.questions) {
    const question = data(state).questions.find((q) => q.id === id);
    state = answerQuestion(
      state,
      school,
      student,
      testId,
      id,
      question.answer,
      at("2026-11-23T10:05"),
    );
  }
  assert.throws(
    () =>
      answerQuestion(
        state,
        school,
        student,
        testId,
        runningTest.questions[0],
        0,
        at("2026-11-23T10:16"),
      ),
    /Time is up/,
  );
  assert.throws(
    () =>
      answerQuestion(
        state,
        school,
        student,
        "westfield-test-0",
        "x",
        0,
        opened,
      ),
    /Start the test/,
  );
  assert.throws(
    () => startAttempt(state, school, teacher, testId, opened),
    /Only students/,
  );
  assert.throws(
    () => startAttempt(state, school, otherStudent, testId, opened),
    /unavailable/,
  );
  state = submitAttempt(state, school, student, testId, at("2026-11-23T10:06"));
  const attempt = attemptFor(data(state), testId, student.person);
  assert.deepEqual(scoreAttempt(data(state), runningTest, attempt), {
    correct: 4,
    total: 4,
    percent: 100,
  });
  assert.throws(
    () => startAttempt(state, school, student, testId, at("2026-11-23T11:00")),
    /already completed/,
  );
  assert.equal(resultsReleased(runningTest, at("2026-11-24T10:00")), false);
  assert.throws(
    () => closeTest(state, school, student, testId),
    /another teacher/,
  );
  state = closeTest(state, school, teacher, testId, at("2026-11-24T10:00"));
  const closed = data(state).tests.find((t) => t.id === testId);
  assert.equal(resultsReleased(closed, at("2026-11-24T10:00")), true);
  assert.throws(
    () => startAttempt(state, school, otherStudent, "westfield-test-0", opened),
    /unavailable/,
  );
});

test("seed attempts auto-score and decode safely", () => {
  const school0 = data(learningSeed);
  const seeded = school0.tests[0];
  const attempt = attemptFor(school0, seeded.id, student.person);
  assert.deepEqual(scoreAttempt(school0, seeded, attempt), {
    correct: 5,
    total: 8,
    percent: 63,
  });
  assert.deepEqual(
    decodeLearningState(JSON.stringify(learningSeed)),
    learningSeed,
  );
  assert.equal(decodeLearningState("{oops"), learningSeed);
  const broken = structuredClone(learningSeed);
  broken.schools.westfield.questions[0].options = "nope";
  assert.equal(decodeLearningState(JSON.stringify(broken)), learningSeed);
});

test("exams, marks entry, grades and report cards", () => {
  const {
    saveExam,
    saveMarks,
    reportCard,
    gradeFor,
    markingProgress,
    examsFor,
  } = results;
  const exam = {
    id: "exam-new",
    year: "westfield-year",
    name: "Final",
    date: "2027-03-15",
    maximum: 80,
    published: false,
  };
  assert.throws(
    () => saveExam(learningSeed, school, teacher, exam),
    /administrator/,
  );
  assert.throws(
    () =>
      saveExam(learningSeed, school, admin, { ...exam, date: "2028-01-01" }),
    /within the academic year/,
  );
  assert.throws(
    () =>
      saveExam(learningSeed, school, admin, { ...exam, name: "unit test 1" }),
    /already exists/,
  );
  let state = saveExam(learningSeed, school, admin, exam);
  assert.throws(
    () => saveMarks(state, school, teacher, "exam-new", allocation, {}),
    /every student/,
  );
  assert.throws(
    () =>
      saveMarks(state, school, teacher, "exam-new", allocation, {
        "westfield-student-0": "81",
      }),
    /between 0 and 80/,
  );
  state = saveMarks(state, school, teacher, "exam-new", allocation, {
    "westfield-student-0": "72",
  });
  assert.throws(
    () => saveExam(state, school, admin, { ...exam, maximum: 100 }),
    /locked/,
  );
  const card = reportCard(
    data(state),
    school,
    "westfield-student-0",
    "exam-new",
  );
  assert.equal(card.rows[0].marks, 72);
  assert.equal(card.percent, 90);
  assert.equal(card.grade, "A2");
  assert.equal(card.complete, true);
  assert.equal(gradeFor(91), "A1");
  assert.equal(gradeFor(32), "E");
  state = saveMarks(state, school, teacher, "exam-new", allocation, {
    "westfield-student-0": "ab",
  });
  assert.equal(
    reportCard(data(state), school, "westfield-student-0", "exam-new").rows[0]
      .marks,
    null,
  );
  state = saveExam(state, school, admin, { ...exam, published: true });
  assert.throws(
    () =>
      saveMarks(state, school, teacher, "exam-new", allocation, {
        "westfield-student-0": "50",
      }),
    /locked/,
  );
  const progress = markingProgress(
    data(learningSeed),
    school,
    "westfield-exam-0",
  );
  // Two Grade 7/8 sheets plus one per subject for the Class 10 section.
  assert.deepEqual([progress.done, progress.total], [5, 5]);
  assert.equal(
    examsFor(data(learningSeed), school, parent, "westfield-student-0").length,
    2,
  );
});

test("weak-topic analysis and practice sets use tagged test answers", () => {
  const { studentTopicReport, sectionTopicReport, practiceSet } = results;
  const now = at("2026-11-23T10:00");
  const report = studentTopicReport(
    data(learningSeed),
    school,
    student.person,
    now,
  );
  assert.equal(report[0].title, "Negative numbers");
  assert.equal(report[0].percent, 0);
  assert.equal(report[0].weak, true);
  assert.equal(
    report.find((row) => row.title === "Equivalent fractions").weak,
    false,
  );
  const section = sectionTopicReport(
    data(learningSeed),
    school,
    "westfield-class-0",
    now,
  );
  assert.equal(section[0].title, "Negative numbers");
  assert.deepEqual(
    section[0].struggling.map((item) => item.id),
    [student.person],
  );
  const set = practiceSet(
    data(learningSeed),
    school,
    student,
    student.person,
    5,
    "2026-11-23",
    now,
  );
  assert.equal(set.length, 5);
  assert.ok(set.slice(0, 2).every((item) => item.weak));
  assert.ok(set.every((item) => item.question.subject === math));
  assert.deepEqual(
    practiceSet(
      data(learningSeed),
      school,
      student,
      student.person,
      5,
      "2026-11-23",
      now,
    ),
    set,
  );
});

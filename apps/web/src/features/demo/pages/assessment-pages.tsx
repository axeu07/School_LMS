"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  CircleX,
  Clock,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  activeAllocations,
  localCalendarDate,
} from "@/services/assignment-model";
import { attendanceRoster } from "@/services/attendance-model";
import { sectionLabel, subjectName } from "@/services/insights";
import {
  answerQuestion,
  attemptComplete,
  attemptDeadline,
  attemptFor,
  chaptersFor,
  closeTest,
  difficulties,
  learnerFor,
  localDateTime,
  removeQuestion,
  resultsReleased,
  saveQuestion,
  saveTest,
  scoreAttempt,
  startAttempt,
  subjectsFor,
  submitAttempt,
  testStatus,
  testsFor,
  topicPath,
  type Attempt,
  type Difficulty,
  type LearningSchool,
  type OnlineTest,
  type Question,
  type TestStatus,
} from "@/services/learning-model";
import {
  updateLearningState,
  useLearningState,
  useNow,
} from "@/services/learning-store";
import { examsFor, practiceSet, saveMarks } from "@/services/results-model";
import { useDemo } from "../demo-context";
import { EmptyState, Meter } from "../dashboard-widgets";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { formatCountdown, formatDate, formatDateTime } from "../format";
import { SectionCard } from "../page-header";

const statusPill: Record<TestStatus, string> = {
  Draft: "pill-muted",
  Upcoming: "pill-warning",
  Open: "pill-success",
  Closed: "pill-muted",
};

function useRunner() {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const run = (action: () => void, message: string) => {
    setError("");
    setNotice("");
    try {
      action();
      setNotice(message);
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  };
  const messages = (
    <>
      <p role="status" className="form-notice">
        {notice}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
  return { run, messages, setNotice };
}

function topicOptions(learning: LearningSchool, subject: string) {
  return chaptersFor(learning, subject).flatMap((chapter) =>
    learning.topics
      .filter((topic) => topic.chapter === chapter.id)
      .map((topic) => ({
        value: topic.id,
        label: topic.title,
        group: "Chapter " + chapter.order + " · " + chapter.title,
      })),
  );
}

function topicLabel(learning: LearningSchool, topic: string) {
  const path = topicPath(learning, topic);
  return (path.chapter?.title ?? "—") + " · " + (path.topic?.title ?? "—");
}

/* ======================= Teacher ======================= */

export function TeacherAssessments() {
  const [tab, setTab] = useState<"tests" | "bank" | "marks">("tests");
  return (
    <>
      <nav className="segmented-tabs" aria-label="Assessment tools">
        {(
          [
            ["tests", "Online tests"],
            ["bank", "Question bank"],
            ["marks", "Marks entry"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "tests" ? (
        <TeacherTests />
      ) : tab === "bank" ? (
        <QuestionBank />
      ) : (
        <MarksEntry />
      )}
    </>
  );
}

function TeacherTests() {
  const { records, actor } = useDemo();
  const state = useLearningState();
  const learning = state.schools[actor.school];
  const now = useNow();
  const allocations = activeAllocations(records, actor);
  const [picked, setPicked] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const [expanded, setExpanded] = useState<string>();
  const { run, messages, setNotice } = useRunner();
  const allocation =
    allocations.find((item) => item.id === picked) ?? allocations[0];
  if (!allocation)
    return <EmptyState>No classes are assigned in the active year.</EmptyState>;
  const tests = testsFor(state, records, actor).filter(
    (item) => item.allocation === allocation.id,
  );
  const roster = attendanceRoster(records, allocation.section);
  const bank = learning.questions.filter(
    (item) => item.subject === allocation.subject,
  );
  const options = topicOptions(learning, allocation.subject).flatMap((topic) =>
    bank
      .filter((question) => question.topic === topic.value)
      .map((question) => ({
        value: question.id,
        label: question.text + " (" + question.difficulty + ")",
        group: topic.group + " › " + topic.label,
      })),
  );

  const testForm = (test?: OnlineTest): FormConfig => {
    const start = now ?? new Date();
    const week = new Date(start.getTime() + 7 * 86_400_000);
    const locked = !!test && learning.attempts.some((a) => a.test === test.id);
    return {
      title: test ? "Edit test" : "New online test",
      description:
        subjectName(records, allocation.subject) +
        " · " +
        sectionLabel(records, allocation.section) +
        (locked
          ? " · Students have started this test, so its questions are locked."
          : ""),
      fields: [
        { name: "title", label: "Title" },
        {
          name: "duration",
          label: "Time limit (minutes)",
          type: "number",
          min: 5,
          max: 180,
        },
        { name: "opens", label: "Opens", type: "datetime-local" },
        { name: "closes", label: "Closes", type: "datetime-local" },
        {
          name: "questions",
          label: "Questions",
          type: "checklist",
          options,
          hint: "Choose from this subject's question bank.",
        },
        { name: "published", label: "Publish to students", type: "checkbox" },
      ],
      values: {
        title: test?.title ?? "",
        duration: String(test?.duration ?? 20),
        opens: test?.opens ?? localDateTime(start),
        closes: test?.closes ?? localDateTime(week),
        questions: test?.questions ?? [],
        published: test?.published ?? false,
      },
      onSubmit: (fields) => {
        updateLearningState((current) =>
          saveTest(current, records, actor, {
            id: test?.id ?? crypto.randomUUID(),
            allocation: allocation.id,
            title: String(fields.get("title")),
            questions: fields.getAll("questions").map(String),
            duration: Number(fields.get("duration")),
            opens: String(fields.get("opens")),
            closes: String(fields.get("closes")),
            published: fields.get("published") === "on",
          }),
        );
        setNotice("Test saved.");
      },
    };
  };

  return (
    <>
      <div className="filter-bar spread">
        <label>
          Class
          <select
            value={allocation.id}
            onChange={(event) => setPicked(event.target.value)}
          >
            {allocations.map((item) => (
              <option key={item.id} value={item.id}>
                {subjectName(records, item.subject)} ·{" "}
                {sectionLabel(records, item.section)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-primary"
          disabled={!bank.length}
          title={bank.length ? undefined : "Add questions to the bank first"}
          onClick={() => setForm(testForm())}
        >
          <Plus size={16} aria-hidden="true" />
          New test
        </button>
      </div>
      {messages}
      {!now ? (
        <p className="field-hint">Loading test schedule…</p>
      ) : tests.length ? (
        <div className="test-list">
          {tests.map((test) => {
            const status = testStatus(test, now);
            const attempts = learning.attempts.filter(
              (item) => item.test === test.id,
            );
            const complete = attempts.filter((item) =>
              attemptComplete(test, item, now),
            );
            const scores = complete.map(
              (item) => scoreAttempt(learning, test, item).percent,
            );
            const average = scores.length
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : undefined;
            const open = expanded === test.id;
            return (
              <SectionCard
                key={test.id}
                title={test.title}
                description={
                  formatDateTime(test.opens) +
                  " – " +
                  formatDateTime(test.closes) +
                  " · " +
                  test.questions.length +
                  " questions · " +
                  test.duration +
                  " min"
                }
                actions={
                  <div className="card-actions">
                    <span className={"pill " + statusPill[status]}>
                      {status}
                    </span>
                    {status === "Open" && (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() =>
                          confirmAction(
                            "Close this test now? Students who haven't finished will be stopped and results will be released.",
                          ) &&
                          run(
                            () =>
                              updateLearningState((current) =>
                                closeTest(current, records, actor, test.id),
                              ),
                            "Test closed. Results are now visible to students.",
                          )
                        }
                      >
                        <Lock size={15} aria-hidden="true" />
                        Close now
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setForm(testForm(test))}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? undefined : test.id)}
                    >
                      {open ? "Hide results" : "Results"}
                    </button>
                  </div>
                }
              >
                <div className="kpi-strip compact">
                  <div>
                    <span>Submitted</span>
                    <strong>
                      {complete.length}/{roster.length}
                    </strong>
                  </div>
                  <div>
                    <span>In progress</span>
                    <strong>{attempts.length - complete.length}</strong>
                  </div>
                  <div>
                    <span>Class average</span>
                    <strong>
                      {average === undefined ? "—" : average + "%"}
                    </strong>
                  </div>
                  <div>
                    <span>Results</span>
                    <strong className="kpi-text">
                      {resultsReleased(test, now)
                        ? "Released"
                        : "After closing"}
                    </strong>
                  </div>
                </div>
                {open && (
                  <TestResults
                    learning={learning}
                    test={test}
                    roster={roster}
                    now={now}
                  />
                )}
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <EmptyState>No tests for this class yet.</EmptyState>
      )}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </>
  );
}

function TestResults({
  learning,
  test,
  roster,
  now,
}: {
  learning: LearningSchool;
  test: OnlineTest;
  roster: { id: string; name: string }[];
  now: Date;
}) {
  const attempts = learning.attempts.filter((item) => item.test === test.id);
  const complete = attempts.filter((item) => attemptComplete(test, item, now));
  return (
    <div className="results-grid">
      <div className="table-wrap">
        <table className="pro-table">
          <caption className="sr-only">
            Student results for {test.title}
          </caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Status</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((student) => {
              const attempt = attempts.find(
                (item) => item.student === student.id,
              );
              const done = attemptComplete(test, attempt, now);
              const score =
                attempt && done && scoreAttempt(learning, test, attempt);
              return (
                <tr key={student.id}>
                  <th scope="row">{student.name}</th>
                  <td>
                    {!attempt
                      ? "Not started"
                      : done
                        ? "Submitted"
                        : "In progress"}
                  </td>
                  <td>
                    {score
                      ? score.correct +
                        "/" +
                        score.total +
                        " · " +
                        score.percent +
                        "%"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="pro-table">
          <caption className="sr-only">Question analysis</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Answered correctly</th>
            </tr>
          </thead>
          <tbody>
            {test.questions.map((id, index) => {
              const question = learning.questions.find(
                (item) => item.id === id,
              );
              const right = complete.filter(
                (item) => question && item.answers[id] === question.answer,
              ).length;
              const percent = complete.length
                ? Math.round((100 * right) / complete.length)
                : undefined;
              return (
                <tr key={id}>
                  <th scope="row">
                    {index + 1}. {question?.text ?? "Removed question"}
                    <small>
                      {question ? topicLabel(learning, question.topic) : ""}
                    </small>
                  </th>
                  <td>
                    <span className="meter-cell">
                      {percent === undefined ? "—" : percent + "%"}
                      <Meter
                        value={percent}
                        label={(percent ?? 0) + "% correct"}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionBank() {
  const { records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const subjects = subjectsFor(records, actor);
  const [picked, setPicked] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const { run, messages, setNotice } = useRunner();
  const subject = subjects.includes(picked) ? picked : subjects[0];
  if (!subject)
    return <EmptyState>No subjects in the active academic year.</EmptyState>;
  const topics = topicOptions(learning, subject);
  const questions = learning.questions.filter(
    (item) =>
      item.subject === subject &&
      (!topic || item.topic === topic) &&
      (!difficulty || item.difficulty === difficulty),
  );

  const questionForm = (question?: Question): FormConfig => ({
    title: question ? "Edit question" : "Add question",
    description:
      "Multiple choice with one correct answer. Tag it with a topic so it counts towards weak-topic analysis.",
    fields: [
      { name: "topic", label: "Topic", type: "select", options: topics },
      { name: "text", label: "Question", type: "textarea" },
      { name: "option0", label: "Option 1" },
      { name: "option1", label: "Option 2" },
      { name: "option2", label: "Option 3", required: false },
      { name: "option3", label: "Option 4", required: false },
      {
        name: "answer",
        label: "Correct option",
        type: "select",
        options: [0, 1, 2, 3].map((index) => ({
          value: String(index),
          label: "Option " + (index + 1),
        })),
      },
      {
        name: "difficulty",
        label: "Difficulty",
        type: "select",
        options: difficulties.map((item) => ({ value: item, label: item })),
      },
    ],
    values: {
      topic: question?.topic ?? topic ?? "",
      text: question?.text ?? "",
      option0: question?.options[0] ?? "",
      option1: question?.options[1] ?? "",
      option2: question?.options[2] ?? "",
      option3: question?.options[3] ?? "",
      answer: String(question?.answer ?? 0),
      difficulty: question?.difficulty ?? "Easy",
    },
    onSubmit: (fields) => {
      const raw = [0, 1, 2, 3].map((index) =>
        String(fields.get("option" + index) ?? "").trim(),
      );
      const answer = Number(fields.get("answer"));
      if (!raw[answer]) throw new Error("The correct option can't be empty.");
      // Blank options are dropped, so shift the answer index to match.
      const answerIndex = raw.slice(0, answer).filter(Boolean).length;
      updateLearningState((current) =>
        saveQuestion(current, records, actor, {
          id: question?.id ?? crypto.randomUUID(),
          subject,
          topic: String(fields.get("topic")),
          text: String(fields.get("text")),
          options: raw.filter(Boolean),
          answer: answerIndex,
          difficulty: String(fields.get("difficulty")) as Difficulty,
        }),
      );
      setNotice("Question saved.");
    },
  });

  return (
    <>
      <div className="filter-bar spread">
        <div className="filter-bar">
          {subjects.length > 1 && (
            <label>
              Subject
              <select
                value={subject}
                onChange={(event) => {
                  setPicked(event.target.value);
                  setTopic("");
                }}
              >
                {subjects.map((id) => (
                  <option key={id} value={id}>
                    {subjectName(records, id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Topic
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option value="">All topics</option>
              {topics.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.group} › {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="">All</option>
              {difficulties.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={!topics.length}
          title={
            topics.length
              ? undefined
              : "Add a chapter and topic in Courses & Lessons first"
          }
          onClick={() => setForm(questionForm())}
        >
          <Plus size={16} aria-hidden="true" />
          Add question
        </button>
      </div>
      {messages}
      <SectionCard
        title={questions.length + " questions"}
        description={subjectName(records, subject) + " question bank"}
      >
        {questions.length ? (
          <ul className="question-list">
            {questions.map((question) => {
              const used = learning.tests.filter((test) =>
                test.questions.includes(question.id),
              ).length;
              return (
                <li key={question.id}>
                  <div className="topic-head">
                    <strong>{question.text}</strong>
                    <span className="card-actions push">
                      <button
                        type="button"
                        className="icon-button small"
                        aria-label="Edit question"
                        title="Edit question"
                        onClick={() => setForm(questionForm(question))}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button small"
                        aria-label="Remove question"
                        title="Remove question"
                        onClick={() =>
                          confirmAction("Remove this question?") &&
                          run(
                            () =>
                              updateLearningState((current) =>
                                removeQuestion(
                                  current,
                                  records,
                                  actor,
                                  question.id,
                                ),
                              ),
                            "Question removed.",
                          )
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  <ol className="option-list">
                    {question.options.map((option, index) => (
                      <li
                        key={option}
                        className={index === question.answer ? "is-answer" : ""}
                      >
                        {option}
                        {index === question.answer && (
                          <span className="sr-only"> (correct answer)</span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="tag-row">
                    <span className="pill pill-muted">
                      {topicLabel(learning, question.topic)}
                    </span>
                    <span className="pill pill-muted">
                      {question.difficulty}
                    </span>
                    <span className="doubt-meta">
                      Used in {used} {used === 1 ? "test" : "tests"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No questions match these filters.</EmptyState>
        )}
      </SectionCard>
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </>
  );
}

function MarksEntry() {
  const { records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const allocations = activeAllocations(records, actor);
  const exams = examsFor(learning, records, actor);
  const [examId, setExam] = useState("");
  const [allocationId, setAllocation] = useState("");
  const { run, messages } = useRunner();
  const exam =
    exams.find((item) => item.id === examId) ??
    exams.find((item) => !item.published) ??
    exams[0];
  const allocation =
    allocations.find((item) => item.id === allocationId) ?? allocations[0];
  if (!exam || !allocation)
    return (
      <EmptyState>
        {exam
          ? "No classes are assigned in the active year."
          : "No exams have been set up for the active year yet."}
      </EmptyState>
    );
  const roster = attendanceRoster(records, allocation.section);
  const existing = (student: string) => {
    const mark = learning.marks.find(
      (item) =>
        item.exam === exam.id &&
        item.student === student &&
        item.subject === allocation.subject,
    );
    return mark ? (mark.marks === null ? "AB" : String(mark.marks)) : "";
  };
  return (
    <>
      <div className="filter-bar">
        <label>
          Exam
          <select
            value={exam.id}
            onChange={(event) => setExam(event.target.value)}
          >
            {exams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {formatDate(item.date)}
                {item.published ? " · published" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Class
          <select
            value={allocation.id}
            onChange={(event) => setAllocation(event.target.value)}
          >
            {allocations.map((item) => (
              <option key={item.id} value={item.id}>
                {subjectName(records, item.subject)} ·{" "}
                {sectionLabel(records, item.section)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {messages}
      <SectionCard
        title={exam.name + " · " + subjectName(records, allocation.subject)}
        description={
          "Out of " +
          exam.maximum +
          ". Enter AB for an absent student." +
          (exam.published ? " Results are published, so marks are locked." : "")
        }
      >
        {roster.length ? (
          <form
            key={exam.id + allocation.id}
            className="marks-form"
            onSubmit={(event) => {
              event.preventDefault();
              const entries = Object.fromEntries(
                new FormData(event.currentTarget),
              ) as Record<string, string>;
              run(
                () =>
                  updateLearningState((current) =>
                    saveMarks(
                      current,
                      records,
                      actor,
                      exam.id,
                      allocation.id,
                      entries,
                    ),
                  ),
                "Marks saved.",
              );
            }}
          >
            <fieldset disabled={exam.published}>
              <legend className="sr-only">Marks</legend>
              <div className="table-wrap">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Student number</th>
                      <th scope="col">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student) => (
                      <tr key={student.id}>
                        <th scope="row">{student.name}</th>
                        <td>{student.code}</td>
                        <td>
                          <input
                            className="marks-input"
                            name={student.id}
                            defaultValue={existing(student.id)}
                            inputMode="decimal"
                            aria-label={"Marks for " + student.name}
                            placeholder={"0–" + exam.maximum}
                            required
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="submit" className="button button-primary">
                Save marks
              </button>
            </fieldset>
          </form>
        ) : (
          <EmptyState>No students are enrolled in this section.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}

/* ======================= Student & parent ======================= */

function AttemptReview({
  learning,
  test,
  attempt,
}: {
  learning: LearningSchool;
  test: OnlineTest;
  attempt: Attempt;
}) {
  return (
    <ol className="review-list">
      {test.questions.map((id) => {
        const question = learning.questions.find((item) => item.id === id);
        if (!question) return null;
        const chosen = attempt.answers[id];
        const right = chosen === question.answer;
        return (
          <li key={id} className={right ? "is-right" : "is-wrong"}>
            <div className="topic-head">
              {right ? (
                <CircleCheck size={17} aria-label="Correct" />
              ) : (
                <CircleX size={17} aria-label="Incorrect" />
              )}
              <strong>{question.text}</strong>
            </div>
            <p>
              Your answer:{" "}
              {chosen === undefined ? "Not answered" : question.options[chosen]}
              {!right && (
                <> · Correct answer: {question.options[question.answer]}</>
              )}
            </p>
            <span className="pill pill-muted">
              {topicLabel(learning, question.topic)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LearnerTests() {
  const { role, records, actor } = useDemo();
  const state = useLearningState();
  const learning = state.schools[actor.school];
  const now = useNow();
  const [running, setRunning] = useState<string>();
  const [review, setReview] = useState<string>();
  const { run, messages } = useRunner();
  const student = learnerFor(records, actor);
  if (!student)
    return (
      <EmptyState>
        {role === "parent"
          ? "No children are linked to this parent in the selected school."
          : "You need a current enrollment to see tests."}
      </EmptyState>
    );
  if (running)
    return <TestRunner testId={running} onExit={() => setRunning(undefined)} />;
  if (!now) return <p className="field-hint">Loading tests…</p>;
  const tests = testsFor(state, records, actor);
  const allocation = (test: OnlineTest) =>
    records.allocations.find((item) => item.id === test.allocation);
  const subjectOf = (test: OnlineTest) =>
    subjectName(records, allocation(test)?.subject ?? "");
  const available = tests.filter(
    (test) =>
      testStatus(test, now) === "Open" &&
      !attemptComplete(test, attemptFor(learning, test.id, student), now),
  );
  const upcoming = tests.filter((test) => testStatus(test, now) === "Upcoming");
  const finished = tests.filter(
    (test) =>
      testStatus(test, now) === "Closed" ||
      attemptComplete(test, attemptFor(learning, test.id, student), now),
  );
  const exams = examsFor(learning, records, actor, student);

  return (
    <>
      {messages}
      <SectionCard
        title="Available now"
        description={
          role === "student"
            ? "Each test is timed and can be taken once. Your answers save as you go."
            : "Tests your child can take now."
        }
      >
        {available.length ? (
          <ul className="test-rows">
            {available.map((test) => {
              const attempt = attemptFor(learning, test.id, student);
              return (
                <li key={test.id}>
                  <div>
                    <strong>{test.title}</strong>
                    <span>
                      {subjectOf(test)} · {test.questions.length} questions ·{" "}
                      {test.duration} min · closes {formatDateTime(test.closes)}
                    </span>
                  </div>
                  {role === "student" ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        if (
                          !attempt &&
                          !confirmAction(
                            "Start " +
                              test.title +
                              "? You will have " +
                              test.duration +
                              " minutes and only one attempt.",
                          )
                        )
                          return;
                        if (
                          run(
                            () =>
                              updateLearningState((current) =>
                                startAttempt(current, records, actor, test.id),
                              ),
                            "",
                          )
                        )
                          setRunning(test.id);
                      }}
                    >
                      <Clock size={15} aria-hidden="true" />
                      {attempt ? "Resume test" : "Start test"}
                    </button>
                  ) : (
                    <span className="pill pill-warning">
                      {attempt ? "In progress" : "Not attempted yet"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No tests are open right now.</EmptyState>
        )}
      </SectionCard>
      <div className="dashboard-grid">
        <SectionCard title="Upcoming tests">
          {upcoming.length ? (
            <ul className="stack-list">
              {upcoming.map((test) => (
                <li key={test.id}>
                  <strong>{test.title}</strong>
                  <span>
                    {subjectOf(test)} · opens {formatDateTime(test.opens)} ·{" "}
                    {test.duration} min
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No upcoming online tests.</EmptyState>
          )}
        </SectionCard>
        <SectionCard
          title="Exam schedule"
          description="Offline exams this academic year."
        >
          {exams.length ? (
            <ul className="stack-list">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <strong>{exam.name}</strong>
                  <span>
                    {formatDate(exam.date)} · out of {exam.maximum} per subject
                    · {exam.published ? "Results published" : "Results pending"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No exams scheduled.</EmptyState>
          )}
        </SectionCard>
      </div>
      <SectionCard
        title="Completed and closed"
        description="Scores and correct answers appear once a test closes."
      >
        {finished.length ? (
          <ul className="test-rows">
            {finished.map((test) => {
              const attempt = attemptFor(learning, test.id, student);
              const released = resultsReleased(test, now);
              const score =
                attempt && released && scoreAttempt(learning, test, attempt);
              const open = review === test.id;
              return (
                <li key={test.id} className="stacked">
                  <div className="test-row-head">
                    <div>
                      <strong>{test.title}</strong>
                      <span>
                        {subjectOf(test)} · closed {formatDateTime(test.closes)}
                      </span>
                    </div>
                    {!attempt ? (
                      <span className="pill pill-muted">Missed</span>
                    ) : score ? (
                      <span className="score-chip">
                        {score.correct}/{score.total} · {score.percent}%
                      </span>
                    ) : (
                      <span className="pill pill-warning">
                        Results after {formatDateTime(test.closes)}
                      </span>
                    )}
                    {score && (
                      <button
                        type="button"
                        className="text-button"
                        aria-expanded={open}
                        onClick={() => setReview(open ? undefined : test.id)}
                      >
                        {open ? "Hide answers" : "Review answers"}
                      </button>
                    )}
                  </div>
                  {open && attempt && (
                    <AttemptReview
                      learning={learning}
                      test={test}
                      attempt={attempt}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No completed tests yet.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}

function TestRunner({
  testId,
  onExit,
}: {
  testId: string;
  onExit: () => void;
}) {
  const { records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const now = useNow(1000);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const test = learning.tests.find((item) => item.id === testId);
  const attempt = attemptFor(learning, testId, actor.person);
  const remaining =
    test && attempt && now ? attemptDeadline(test, attempt) - now.getTime() : 1;
  const expired = remaining <= 0;
  const inProgress = !!attempt && !attempt.submitted;

  // Submit automatically when time runs out.
  useEffect(() => {
    if (expired && inProgress)
      updateLearningState((current) =>
        submitAttempt(current, records, actor, testId),
      );
  }, [expired, inProgress, records, actor, testId]);

  if (!test || !attempt)
    return <EmptyState>This test is unavailable.</EmptyState>;
  const answered = test.questions.filter((id) => id in attempt.answers).length;

  if (attempt.submitted || expired)
    return (
      <SectionCard
        title={test.title + " submitted"}
        description={
          answered +
          " of " +
          test.questions.length +
          " questions answered. Your score and the correct answers will be available after the test closes on " +
          formatDateTime(test.closes) +
          "."
        }
      >
        <div className="card-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onExit}
          >
            Back to tests
          </button>
        </div>
      </SectionCard>
    );

  const question = learning.questions.find(
    (item) => item.id === test.questions[index],
  );
  const choose = (choice: number) => {
    setError("");
    try {
      updateLearningState((current) =>
        answerQuestion(current, records, actor, testId, question!.id, choice),
      );
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  const submit = () => {
    const missing = test.questions.length - answered;
    if (
      !confirmAction(
        missing
          ? missing + " questions are unanswered. Submit anyway?"
          : "Submit your answers? You can't change them afterwards.",
      )
    )
      return;
    updateLearningState((current) =>
      submitAttempt(current, records, actor, testId),
    );
  };

  return (
    <div className="runner">
      <div className="runner-bar">
        <div>
          <strong>{test.title}</strong>
          <span>
            {answered} of {test.questions.length} answered · answers save
            automatically
          </span>
        </div>
        <span
          className={"runner-timer" + (remaining < 60_000 ? " is-low" : "")}
          role="timer"
          aria-label="Time remaining"
        >
          <Clock size={16} aria-hidden="true" />
          {now ? formatCountdown(remaining) : "--:--"}
        </span>
        <button
          type="button"
          className="button button-primary"
          onClick={submit}
        >
          Submit test
        </button>
      </div>
      <nav className="question-nav" aria-label="Questions">
        {test.questions.map((id, position) => (
          <button
            key={id}
            type="button"
            aria-current={position === index ? "step" : undefined}
            className={id in attempt.answers ? "is-answered" : ""}
            aria-label={
              "Question " +
              (position + 1) +
              (id in attempt.answers ? ", answered" : ", not answered")
            }
            onClick={() => setIndex(position)}
          >
            {position + 1}
          </button>
        ))}
      </nav>
      {question && (
        <SectionCard
          title={"Question " + (index + 1) + " of " + test.questions.length}
          description={topicLabel(learning, question.topic)}
        >
          <fieldset className="choice-list">
            <legend>{question.text}</legend>
            {question.options.map((option, choice) => (
              <label
                key={option}
                className={
                  attempt.answers[question.id] === choice ? "is-chosen" : ""
                }
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={attempt.answers[question.id] === choice}
                  onChange={() => choose(choice)}
                />
                {option}
              </label>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="card-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={index === test.questions.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              Next
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function DailyQuiz() {
  const { records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const now = useNow(60_000);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const student = learnerFor(records, actor);
  if (!student)
    return <EmptyState>You need a current enrollment to practise.</EmptyState>;
  if (!now) return <p className="field-hint">Preparing today’s quiz…</p>;
  const today = localCalendarDate(now);
  const set = practiceSet(
    learning,
    records,
    actor,
    student,
    5,
    today + "#" + round,
    now,
  );
  if (!set.length)
    return (
      <EmptyState>
        Your teachers haven’t added questions to the question bank yet.
      </EmptyState>
    );
  const done = set.every(({ question }) => question.id in answers);
  const score = set.filter(
    ({ question }) => answers[question.id] === question.answer,
  ).length;
  const weakCount = set.filter((item) => item.weak).length;
  return (
    <SectionCard
      title={round ? "Practice round " + (round + 1) : "Today's warm-up"}
      description={
        (done
          ? "You scored " + score + " out of " + set.length + ". "
          : Object.keys(answers).filter((id) =>
              set.some((item) => item.question.id === id),
            ).length +
            " of " +
            set.length +
            " answered. ") +
        (weakCount
          ? weakCount + " questions come from your weak topics."
          : "Questions come from your class question bank.")
      }
      actions={
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            setRound(round + 1);
            setAnswers({});
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          New set
        </button>
      }
    >
      <ol className="quiz-list">
        {set.map(({ question, weak }) => {
          const answer = answers[question.id];
          return (
            <li key={question.id}>
              <div className="topic-head">
                <strong>{question.text}</strong>
                {weak && <span className="pill pill-warning">Weak topic</span>}
              </div>
              <span className="field-hint">
                {topicLabel(learning, question.topic)}
              </span>
              <div className="card-actions">
                {question.options.map((option, choice) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      "button button-outline" +
                      (answer !== undefined && choice === question.answer
                        ? " is-correct"
                        : answer === choice
                          ? " is-wrong"
                          : "")
                    }
                    aria-pressed={answer === choice}
                    disabled={answer !== undefined}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: choice,
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
              {answer !== undefined && (
                <p className="form-notice" role="status">
                  {answer === question.answer
                    ? "Correct."
                    : "Not quite — the answer is " +
                      question.options[question.answer] +
                      "."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

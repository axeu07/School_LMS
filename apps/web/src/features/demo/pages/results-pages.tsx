"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Printer } from "lucide-react";
import { activeAllocations } from "@/services/assignment-model";
import { attendanceRoster } from "@/services/attendance-model";
import { sectionLabel, subjectName } from "@/services/insights";
import {
  attemptComplete,
  attemptFor,
  learnerFor,
  resultsReleased,
  scoreAttempt,
  testsFor,
  type Exam,
} from "@/services/learning-model";
import {
  updateLearningState,
  useLearningState,
  useNow,
} from "@/services/learning-store";
import {
  examsFor,
  gradeFor,
  gradingScale,
  markingProgress,
  reportCard,
  saveExam,
  sectionTopicReport,
  studentTopicReport,
  weakThreshold,
} from "@/services/results-model";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, StatCards } from "../dashboard-widgets";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { formatDate, formatDateTime } from "../format";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";

function printReport() {
  window.print();
}

/* ======================= School Admin ======================= */

export function ExamsAdmin() {
  const { records, actor, school } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const exams = examsFor(learning, records, actor);
  const [form, setForm] = useState<FormConfig>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sheetExam, setSheetExam] = useState("");
  const [sheetSection, setSheetSection] = useState("");
  const years = records.years.filter((item) => item.status !== "Archived");
  const activeYear = records.years.find((item) => item.status === "Active");

  const examForm = (exam?: Exam): FormConfig => ({
    title: exam ? "Edit exam" : "New exam",
    description:
      "Teachers enter marks for their subjects. Publish when results are ready for students and parents.",
    fields: [
      { name: "name", label: "Exam name" },
      {
        name: "year",
        label: "Academic year",
        type: "select",
        options: years.map((item) => ({ value: item.id, label: item.name })),
      },
      { name: "date", label: "Exam date", type: "date" },
      {
        name: "maximum",
        label: "Maximum marks per subject",
        type: "number",
        min: 1,
        max: 1000,
      },
      { name: "published", label: "Publish results", type: "checkbox" },
    ],
    values: {
      name: exam?.name ?? "",
      year: exam?.year ?? activeYear?.id ?? "",
      date: exam?.date ?? "",
      maximum: String(exam?.maximum ?? 100),
      published: exam?.published ?? false,
    },
    onSubmit: (fields) => {
      updateLearningState((state) =>
        saveExam(state, records, actor, {
          id: exam?.id ?? crypto.randomUUID(),
          name: String(fields.get("name")),
          year: String(fields.get("year")),
          date: String(fields.get("date")),
          maximum: Number(fields.get("maximum")),
          published: fields.get("published") === "on",
        }),
      );
      setNotice("Exam saved.");
    },
  });

  function togglePublish(exam: Exam) {
    setError("");
    setNotice("");
    const progress = markingProgress(learning, records, exam.id);
    if (
      !exam.published &&
      progress.done < progress.total &&
      !confirmAction(
        progress.done +
          " of " +
          progress.total +
          " mark sheets are complete. Publish anyway?",
      )
    )
      return;
    try {
      updateLearningState((state) =>
        saveExam(state, records, actor, {
          ...exam,
          published: !exam.published,
        }),
      );
      setNotice(exam.published ? "Results unpublished." : "Results published.");
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  const exam = exams.find((item) => item.id === sheetExam) ?? exams[0];
  const sections = records.sections.filter(
    (item) => item.year === exam?.year && item.status === "Active",
  );
  const section =
    sections.find((item) => item.id === sheetSection) ?? sections[0];
  const roster = section ? attendanceRoster(records, section.id) : [];
  const subjects = section
    ? [
        ...new Set(
          records.allocations
            .filter((item) => item.section === section.id)
            .map((item) => item.subject),
        ),
      ]
    : [];

  return (
    <>
      <StatCards
        stats={[
          {
            label: "Exams",
            value: String(exams.length),
            note: "All academic years",
            icon: "calendar",
          },
          {
            label: "Published",
            value: String(exams.filter((item) => item.published).length),
            note: "Visible to students and parents",
            icon: "classes",
          },
          {
            label: "Awaiting marks",
            value: String(
              exams.filter((item) => {
                const progress = markingProgress(learning, records, item.id);
                return progress.done < progress.total;
              }).length,
            ),
            note: "Exams with incomplete mark sheets",
            icon: "tasks",
          },
          {
            label: "Grading scale",
            value: gradingScale.length + " grades",
            note: "A1 to E",
            icon: "attendance",
          },
        ]}
      />
      <SectionCard
        title="Exams"
        description="Set up exams and publish results when marking is complete."
        className="page-section"
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() => setForm(examForm())}
          >
            <Plus size={16} aria-hidden="true" />
            New exam
          </button>
        }
      >
        <p role="status" className="form-notice">
          {notice}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {exams.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Exam</th>
                  <th scope="col">Date</th>
                  <th scope="col">Max marks</th>
                  <th scope="col">Mark sheets</th>
                  <th scope="col">Results</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {exams.map((item) => {
                  const progress = markingProgress(learning, records, item.id);
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        {item.name}
                        <small>
                          {records.years.find((year) => year.id === item.year)
                            ?.name ?? "—"}
                        </small>
                      </th>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.maximum}</td>
                      <td>
                        <span className="meter-cell">
                          {progress.done}/{progress.total} complete
                          <Meter
                            value={
                              progress.total
                                ? (100 * progress.done) / progress.total
                                : 0
                            }
                            label={
                              progress.done +
                              " of " +
                              progress.total +
                              " mark sheets complete"
                            }
                          />
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            "pill " +
                            (item.published ? "pill-success" : "pill-muted")
                          }
                        >
                          {item.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <span className="card-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => togglePublish(item)}
                          >
                            {item.published ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            type="button"
                            className="icon-button small"
                            aria-label={"Edit " + item.name}
                            title="Edit exam"
                            onClick={() => setForm(examForm(item))}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No exams yet.</EmptyState>
        )}
      </SectionCard>
      {exam && (
        <SectionCard
          title="Result sheet"
          description="Totals, percentages and grades are calculated automatically."
          className="page-section print-area"
          actions={
            <div className="card-actions no-print">
              <label className="inline-label">
                <span className="sr-only">Exam</span>
                <select
                  value={exam.id}
                  onChange={(event) => setSheetExam(event.target.value)}
                >
                  {exams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {sections.length > 0 && section && (
                <label className="inline-label">
                  <span className="sr-only">Section</span>
                  <select
                    value={section.id}
                    onChange={(event) => setSheetSection(event.target.value)}
                  >
                    {sections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.grade} · {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="button button-outline"
                onClick={printReport}
              >
                <Printer size={15} aria-hidden="true" />
                Print / save PDF
              </button>
            </div>
          }
        >
          <p className="print-only">
            {school.name} · {exam.name} ·{" "}
            {section ? section.grade + " · " + section.name : ""}
          </p>
          {section && roster.length ? (
            <div className="table-wrap">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    {subjects.map((subject) => (
                      <th scope="col" key={subject}>
                        {subjectName(records, subject)}
                      </th>
                    ))}
                    <th scope="col">Total</th>
                    <th scope="col">%</th>
                    <th scope="col">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student) => {
                    const card = reportCard(
                      learning,
                      records,
                      student.id,
                      exam.id,
                    );
                    return (
                      <tr key={student.id}>
                        <th scope="row">
                          {student.name}
                          <small>{student.code}</small>
                        </th>
                        {card.rows.map((row) => (
                          <td key={row.subject}>
                            {row.marks === undefined
                              ? "—"
                              : row.marks === null
                                ? "AB"
                                : row.marks}
                          </td>
                        ))}
                        <td>
                          {card.maximum ? card.total + "/" + card.maximum : "—"}
                        </td>
                        <td>{card.percent ?? "—"}</td>
                        <td>
                          {card.grade ? (
                            <span className="grade-chip">{card.grade}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>
              No enrolled students for this exam&apos;s sections.
            </EmptyState>
          )}
        </SectionCard>
      )}
      <SectionCard
        title="Grading scale"
        description="Applied to subject and overall percentages."
        className="page-section"
      >
        <ul className="grade-scale">
          {gradingScale.map(([grade, minimum], index) => (
            <li key={grade}>
              <span className="grade-chip">{grade}</span>
              {index === 0
                ? minimum + "–100%"
                : minimum + "–" + (gradingScale[index - 1][1] - 1) + "%"}
            </li>
          ))}
        </ul>
      </SectionCard>
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </>
  );
}

/* ======================= Student & parent ======================= */

export function ReportCards() {
  const { records, actor, school, data } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const student = learnerFor(records, actor);
  const [picked, setPicked] = useState("");
  if (!student) return null;
  const exams = examsFor(learning, records, actor, student);
  const published = exams.filter((item) => item.published);
  const exam = published.find((item) => item.id === picked) ?? published.at(-1);
  const name =
    records.students.find((item) => item.id === student)?.name ??
    data.person.name;
  const section = records.enrollments.find(
    (item) => item.student === student && item.status === "Enrolled",
  )?.section;
  const card = exam && reportCard(learning, records, student, exam.id);
  const pending = exams.filter((item) => !item.published);
  return (
    <SectionCard
      title="Report card"
      description={
        published.length
          ? "Exam marks with automatic totals and grades."
          : "No exam results have been published yet."
      }
      className="page-section print-area"
      actions={
        exam ? (
          <div className="card-actions no-print">
            {published.length > 1 && (
              <label className="inline-label">
                <span className="sr-only">Exam</span>
                <select
                  value={exam.id}
                  onChange={(event) => setPicked(event.target.value)}
                >
                  {published.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="button button-outline"
              onClick={printReport}
            >
              <Printer size={15} aria-hidden="true" />
              Download report card
            </button>
          </div>
        ) : undefined
      }
    >
      {exam && card ? (
        <>
          <dl className="report-head">
            <div>
              <dt>Student</dt>
              <dd>{name}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{section ? sectionLabel(records, section) : "—"}</dd>
            </div>
            <div>
              <dt>Exam</dt>
              <dd>
                {exam.name} · {formatDate(exam.date)}
              </dd>
            </div>
            <div>
              <dt>School</dt>
              <dd>{school.name}</dd>
            </div>
          </dl>
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Marks</th>
                  <th scope="col">Percentage</th>
                  <th scope="col">Grade</th>
                </tr>
              </thead>
              <tbody>
                {card.rows.map((row) => (
                  <tr key={row.subject}>
                    <th scope="row">{row.name}</th>
                    <td>
                      {row.marks === undefined
                        ? "Not entered"
                        : row.marks === null
                          ? "Absent"
                          : row.marks + "/" + exam.maximum}
                    </td>
                    <td>
                      {row.percent === undefined ? "—" : row.percent + "%"}
                    </td>
                    <td>
                      {row.grade ? (
                        <span className="grade-chip">{row.grade}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>
                    {card.maximum ? card.total + "/" + card.maximum : "—"}
                  </td>
                  <td>
                    {card.percent === undefined ? "—" : card.percent + "%"}
                  </td>
                  <td>
                    {card.grade ? (
                      <span className="grade-chip">{card.grade}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <EmptyState>
          Results appear here once the school publishes them.
        </EmptyState>
      )}
      {pending.length > 0 && (
        <p className="field-hint no-print">
          Results pending: {pending.map((item) => item.name).join(", ")}.
        </p>
      )}
    </SectionCard>
  );
}

export function LearnerTestResults() {
  const { records, actor } = useDemo();
  const state = useLearningState();
  const learning = state.schools[actor.school];
  const now = useNow();
  const student = learnerFor(records, actor);
  if (!student || !now) return null;
  const rows = testsFor(state, records, actor)
    .filter((test) => resultsReleased(test, now))
    .map((test) => {
      const attempt = attemptFor(learning, test.id, student);
      return {
        test,
        subject: subjectName(
          records,
          records.allocations.find((item) => item.id === test.allocation)
            ?.subject ?? "",
        ),
        score:
          attempt && attemptComplete(test, attempt, now)
            ? scoreAttempt(learning, test, attempt)
            : undefined,
      };
    });
  return (
    <SectionCard
      title="Online test results"
      description="Auto-evaluated scores, shown after each test closes."
      className="page-section"
    >
      {rows.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Closed</th>
                <th scope="col">Score</th>
                <th scope="col">Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ test, subject, score }) => (
                <tr key={test.id}>
                  <th scope="row">
                    {test.title}
                    <small>{subject}</small>
                  </th>
                  <td>{formatDateTime(test.closes)}</td>
                  <td>
                    {score ? (
                      <span className="meter-cell">
                        {score.correct}/{score.total} · {score.percent}%
                        <Meter
                          value={score.percent}
                          label={score.percent + "%"}
                        />
                      </span>
                    ) : (
                      "Missed"
                    )}
                  </td>
                  <td>
                    {score ? (
                      <span className="grade-chip">
                        {gradeFor(score.percent)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No closed tests yet.</EmptyState>
      )}
    </SectionCard>
  );
}

/** A student's (or a parent's child's) weak topics beside the class average. */
export function LearnerTopics() {
  const { role, records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const now = useNow(60_000);
  const student = learnerFor(records, actor);
  if (!student) return null;
  const report = now ? studentTopicReport(learning, records, student, now) : [];
  const weak = report.filter((item) => item.weak);
  return (
    <SectionCard
      title="Weak topics"
      description={
        "Topic scores from online tests compared with the class average. Below " +
        weakThreshold +
        "%, or 10 points under the class, counts as weak."
      }
      actions={
        role === "student" && weak.length ? (
          <Link
            className="button button-primary"
            href={roleHref(role, "daily-quiz")}
          >
            Practise weak topics
          </Link>
        ) : undefined
      }
    >
      {report.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Score</th>
                <th scope="col">Class average</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row) => (
                <tr key={row.topic}>
                  <th scope="row">
                    {row.title}
                    <small>
                      {subjectName(records, row.subject)} · {row.chapter}
                    </small>
                  </th>
                  <td>
                    <span className="meter-cell">
                      {row.percent}% ({row.correct}/{row.total})
                      <Meter value={row.percent} label={row.percent + "%"} />
                    </span>
                  </td>
                  <td>{row.classAverage}%</td>
                  <td>
                    <span
                      className={
                        "pill " + (row.weak ? "pill-warning" : "pill-success")
                      }
                    >
                      {row.weak ? "Needs practice" : "On track"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>
          Topic scores appear after the first online test is completed.
        </EmptyState>
      )}
    </SectionCard>
  );
}

/** Lowest-scoring topics for a section, for teachers and school admins. */
export function SectionTopics() {
  const { role, records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const now = useNow(60_000);
  const [picked, setPicked] = useState("");
  const teacher = role === "teacher";
  const allocations = teacher ? activeAllocations(records, actor) : [];
  const activeYear = records.years.find((item) => item.status === "Active");
  const sections = teacher
    ? [...new Set(allocations.map((item) => item.section))]
    : records.sections
        .filter(
          (item) => item.status === "Active" && item.year === activeYear?.id,
        )
        .map((item) => item.id);
  const section = sections.includes(picked) ? picked : sections[0];
  if (!section) return null;
  const subjects = teacher
    ? allocations
        .filter((item) => item.section === section)
        .map((item) => item.subject)
    : undefined;
  const report = now
    ? sectionTopicReport(learning, records, section, now, subjects)
    : [];
  return (
    <SectionCard
      title="Weak topics by class"
      description="From tagged online test questions, lowest-scoring topics first."
      className="page-section"
      actions={
        sections.length > 1 ? (
          <label className="inline-label">
            <span className="sr-only">Section</span>
            <select
              value={section}
              onChange={(event) => setPicked(event.target.value)}
            >
              {sections.map((id) => (
                <option key={id} value={id}>
                  {sectionLabel(records, id)}
                </option>
              ))}
            </select>
          </label>
        ) : undefined
      }
    >
      {report.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Class score</th>
                <th scope="col">Students below {weakThreshold}%</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row) => (
                <tr key={row.topic}>
                  <th scope="row">
                    {row.title}
                    <small>
                      {subjectName(records, row.subject)} · {row.chapter}
                    </small>
                  </th>
                  <td>
                    <span className="meter-cell">
                      {row.percent}%
                      <Meter value={row.percent} label={row.percent + "%"} />
                    </span>
                  </td>
                  <td>
                    {row.struggling.length
                      ? row.struggling.map((item) => item.name).join(", ")
                      : "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>
          No completed online tests for {sectionLabel(records, section)} yet.
        </EmptyState>
      )}
    </SectionCard>
  );
}

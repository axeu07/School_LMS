"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { AcademicTable } from "@/services/academic-model";
import { resetAcademicState } from "@/services/academic-store";
import { attendancePercentage } from "@/services/attendance-model";
import { resetDoubtState } from "@/services/doubt-store";
import {
  formatPercent,
  gradeAverage,
  sectionLabel,
  sectionSummary,
  studentSummary,
  subjectName,
} from "@/services/insights";
import { currentEnrollment } from "@/services/academic-model";
import { AcademicWorkspace } from "../academic-workspace";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, StatCards, TrendChart } from "../dashboard-widgets";
import { navigation } from "../navigation";
import { SectionCard } from "../page-header";

export function AcademicPage({ tables }: { tables: AcademicTable[] }) {
  const { actor, records } = useDemo();
  return <AcademicWorkspace actor={actor} school={records} tables={tables} />;
}

export function AdminAssignments() {
  const { records } = useDemo();
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const rows = records.assignments.map((assignment) => {
    const allocation = records.allocations.find(
      (item) => item.id === assignment.allocation,
    );
    const work = records.submissions.filter(
      (item) => item.assignment === assignment.id,
    );
    return {
      assignment,
      section: allocation?.section ?? "",
      subject: allocation ? subjectName(records, allocation.subject) : "—",
      teacher:
        records.teachers.find((item) => item.id === allocation?.teacher)
          ?.name ?? "—",
      status: assignment.published ? "Published" : "Draft",
      submitted: work.filter((item) => item.status === "Submitted").length,
      graded: work.filter((item) => item.status === "Graded").length,
      revision: work.filter((item) => item.status === "Revision required")
        .length,
    };
  });
  const visible = rows.filter(
    (row) =>
      (!section || row.section === section) &&
      (!status || row.status === status),
  );
  return (
    <>
      <StatCards
        stats={[
          {
            label: "Assignments",
            value: String(rows.length),
            note: "Across all sections",
            icon: "tasks",
          },
          {
            label: "Published",
            value: String(
              rows.filter((row) => row.status === "Published").length,
            ),
            note: "Visible to students",
            icon: "classes",
          },
          {
            label: "Awaiting review",
            value: String(rows.reduce((sum, row) => sum + row.submitted, 0)),
            note: "Submitted, not yet graded",
            icon: "calendar",
          },
          {
            label: "Graded",
            value: String(rows.reduce((sum, row) => sum + row.graded, 0)),
            note: "Submissions with marks",
            icon: "attendance",
          },
        ]}
      />
      <SectionCard
        title="All assignments"
        description="Teachers create and grade assignments. This view tracks their progress across the school."
        className="page-section"
      >
        <div className="filter-bar">
          <label>
            Section
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              <option value="">All sections</option>
              {records.sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.grade} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option>Published</option>
              <option>Draft</option>
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Assignment</th>
                  <th scope="col">Class</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Graded</th>
                  <th scope="col">Revision</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.assignment.id}>
                    <th scope="row">
                      {row.assignment.title}
                      <small>{row.subject}</small>
                    </th>
                    <td>{sectionLabel(records, row.section)}</td>
                    <td>{row.teacher}</td>
                    <td>{row.assignment.due}</td>
                    <td>
                      <span
                        className={
                          "pill " +
                          (row.status === "Published"
                            ? "pill-success"
                            : "pill-muted")
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.submitted}</td>
                    <td>{row.graded}</td>
                    <td>{row.revision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No assignments match these filters.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}

export function SchoolPerformance() {
  const { records, data, scopeKey } = useDemo();
  const activeYear = records.years.find((item) => item.status === "Active");
  const sections = records.sections.filter(
    (item) => item.status === "Active" && item.year === activeYear?.id,
  );
  const summaries = sections.map((item) => sectionSummary(records, item.id));
  const enrolled = records.students.filter((item) =>
    currentEnrollment(records, item.id),
  );
  const published = new Set(
    records.assignments.filter((item) => item.published).map((item) => item.id),
  );
  const attention = enrolled
    .map((student) => ({
      student,
      summary: studentSummary(records, student.id),
    }))
    .filter(
      ({ summary }) =>
        (summary.attendance !== undefined && summary.attendance < 90) ||
        (summary.average !== undefined && summary.average < 60),
    );
  return (
    <>
      <StatCards
        stats={[
          {
            label: "Enrolled students",
            value: String(enrolled.length),
            note: activeYear ? activeYear.name : "No active year",
            icon: "students",
          },
          {
            label: "Attendance",
            value: formatPercent(attendancePercentage(records.attendance)),
            note: "All recorded sessions",
            icon: "attendance",
          },
          {
            label: "Average grade",
            value: formatPercent(gradeAverage(records, published)),
            note: "Graded assignments",
            icon: "tasks",
          },
          {
            label: "Active sections",
            value: String(sections.length),
            note: "In the active year",
            icon: "classes",
          },
        ]}
      />
      <SectionCard
        title="Sections at a glance"
        description="Live figures from enrollments, attendance and graded work."
        className="page-section"
      >
        {summaries.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Enrollment</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">Submission rate</th>
                  <th scope="col">Average grade</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => (
                  <tr key={summary.section!.id}>
                    <th scope="row">
                      {summary.section!.grade} · {summary.section!.name}
                      <small>
                        {summary.subjects.join(" · ") || "No subjects"}
                      </small>
                    </th>
                    <td>
                      <span className="meter-cell">
                        {summary.roster.length}/{summary.capacity}
                        <Meter
                          value={
                            (100 * summary.roster.length) /
                            (summary.capacity || 1)
                          }
                          label={
                            summary.roster.length +
                            " of " +
                            summary.capacity +
                            " seats filled"
                          }
                        />
                      </span>
                    </td>
                    <td>{formatPercent(summary.attendance)}</td>
                    <td>{formatPercent(summary.submissionRate)}</td>
                    <td>{formatPercent(summary.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            No active sections in the active academic year.
          </EmptyState>
        )}
      </SectionCard>
      <div className="dashboard-grid">
        <TrendChart key={scopeKey} chart={data.chart} sample />
        <SectionCard
          title="Students needing attention"
          description="Attendance below 90% or an average grade below 60%."
        >
          {attention.length ? (
            <ul className="stack-list">
              {attention.map(({ student, summary }) => (
                <li key={student.id}>
                  <strong>{student.name}</strong>
                  <span>
                    {summary.section ?? "No section"} · Attendance{" "}
                    {formatPercent(summary.attendance)} · Average{" "}
                    {formatPercent(summary.average)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No students currently need attention.</EmptyState>
          )}
        </SectionCard>
      </div>
    </>
  );
}

const planLimits: Record<string, number> = { Starter: 750, Professional: 2000 };

export function SchoolSettings() {
  const { school, records } = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState("");
  const enrolled = records.students.filter((item) =>
    currentEnrollment(records, item.id),
  ).length;
  const limit = planLimits[school.plan] ?? 2000;
  const modules = new Map<string, "live" | "preview">();
  for (const groups of Object.values(navigation))
    for (const group of groups)
      for (const entry of group.items)
        if (entry.slug && !modules.has(entry.title))
          modules.set(entry.title, entry.status);
  return (
    <>
      <div className="dashboard-grid">
        <SectionCard
          title="School profile"
          description="Profile and branding editing arrive with white-label setup."
        >
          <div className="profile-summary">
            <span className="school-badge">{school.initials}</span>
            <div>
              <strong>{school.name}</strong>
              <span>{school.location}</span>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Plan</dt>
              <dd>{school.plan}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>
                <span
                  className={
                    "pill " +
                    (school.status === "Active"
                      ? "pill-success"
                      : "pill-warning")
                  }
                >
                  {school.status}
                </span>
              </dd>
            </div>
            <div>
              <dt>Active academic year</dt>
              <dd>
                {records.years.find((item) => item.status === "Active")?.name ??
                  "None"}
              </dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard
          title="Plan usage"
          description="Student seats use live enrollments. Other limits are sample figures."
        >
          <ul className="usage-list">
            <li>
              <span>
                Students{" "}
                <strong>
                  {enrolled} / {limit}
                </strong>
              </span>
              <Meter
                value={(100 * enrolled) / limit}
                label={enrolled + " of " + limit + " student seats used"}
              />
            </li>
            <li>
              <span>
                Storage <strong>12 / 200 GB</strong>{" "}
                <span className="pill pill-preview">Sample</span>
              </span>
              <Meter value={6} label="6% of storage used" />
            </li>
            <li>
              <span>
                AI requests this month <strong>1,240 / 5,000</strong>{" "}
                <span className="pill pill-preview">Sample</span>
              </span>
              <Meter value={25} label="25% of AI requests used" />
            </li>
          </ul>
        </SectionCard>
      </div>
      <SectionCard
        title="Modules"
        description="Live modules use the shared demo records. Preview modules show sample content."
        className="page-section"
      >
        <ul className="module-grid">
          {[...modules].map(([title, status]) => (
            <li key={title}>
              {title}
              <span
                className={
                  "pill " +
                  (status === "live" ? "pill-success" : "pill-preview")
                }
              >
                {status === "live" ? "Live" : "Preview"}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard
        title="Demo data"
        description="Restore the original records for all three demo schools, including academics, assignments, attendance and doubts."
        className="page-section"
        actions={
          <button
            type="button"
            className="button button-outline"
            onClick={() => dialog.current?.showModal()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reset Demo Data
          </button>
        }
      >
        <p role="status" className="form-notice">
          {notice}
        </p>
      </SectionCard>
      <dialog
        ref={dialog}
        className="search-dialog academic-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Reset Demo Data?</h2>
        <p>Restore the original academic records for every demo school.</p>
        <div className="academic-toolbar">
          <button
            type="button"
            className="button button-outline"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              resetAcademicState();
              resetDoubtState();
              setNotice("Demo data reset.");
              dialog.current?.close();
            }}
          >
            Confirm reset
          </button>
        </div>
      </dialog>
    </>
  );
}

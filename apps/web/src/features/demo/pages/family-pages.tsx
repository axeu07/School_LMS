"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { formatPercent, studentSummary } from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, TrendChart } from "../dashboard-widgets";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";
import {
  LearnerTestResults,
  LearnerTopics,
  ReportCards,
} from "./results-pages";

export function ChildrenPage() {
  const { role, records, data, setChild } = useDemo();
  if (!data.children.length)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  return (
    <div className="child-grid">
      {data.children.map((child) => {
        const summary = studentSummary(records, child.id);
        const link = records.links.find(
          (item) =>
            item.guardian === data.person.id && item.student === child.id,
        );
        const active = data.child?.id === child.id;
        const initials = child.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2);
        return (
          <SectionCard
            key={child.id}
            title={child.name}
            description={
              (summary.section ?? "No current enrollment") + " · " + child.code
            }
            className={active ? "is-selected" : ""}
            actions={
              active ? (
                <span className="pill pill-success">
                  <CircleCheck size={13} aria-hidden="true" />
                  Selected
                </span>
              ) : (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setChild(child.id)}
                >
                  View this child
                </button>
              )
            }
          >
            <div className="profile-summary">
              <span className="school-badge">{initials}</span>
              <div>
                <strong>{link?.relationship ?? "Guardian"}</strong>
                <span>
                  {link?.primary === "Yes"
                    ? "You are the primary contact"
                    : "Secondary contact"}
                </span>
              </div>
            </div>
            <ul className="usage-list">
              <li>
                <span>
                  Attendance{" "}
                  <strong>{formatPercent(summary.attendance)}</strong>
                </span>
                <Meter value={summary.attendance} label="Attendance" />
              </li>
              <li>
                <span>
                  Homework submitted{" "}
                  <strong>{formatPercent(summary.completion)}</strong>
                </span>
                <Meter value={summary.completion} label="Homework submitted" />
              </li>
              <li>
                <span>
                  Average grade{" "}
                  <strong>{formatPercent(summary.average)}</strong>
                </span>
                <Meter value={summary.average} label="Average grade" />
              </li>
            </ul>
            <div className="card-actions">
              {(
                [
                  ["attendance", "Attendance"],
                  ["homework", "Homework"],
                  ["performance", "Performance"],
                ] as const
              ).map(([slug, title]) => (
                <Link
                  key={slug}
                  className="button button-outline"
                  href={roleHref(role, slug)}
                  onClick={() => setChild(child.id)}
                >
                  {title}
                </Link>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

/** Grades, feedback and attendance for a student, or a parent's active child. */
export function LearnerProgress() {
  const { role, records, data, scopeKey } = useDemo();
  const student = role === "parent" ? data.child?.id : data.person.id;
  if (!student)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  const summary = studentSummary(records, student);
  return (
    <>
      <div className="kpi-strip">
        <div>
          <span>Attendance</span>
          <strong>{formatPercent(summary.attendance)}</strong>
        </div>
        <div>
          <span>Average grade</span>
          <strong>{formatPercent(summary.average)}</strong>
        </div>
        <div>
          <span>Homework submitted</span>
          <strong>{formatPercent(summary.completion)}</strong>
        </div>
        <div>
          <span>Graded assignments</span>
          <strong>{summary.graded.length}</strong>
        </div>
      </div>
      <ReportCards />
      <SectionCard
        title="Assignment results"
        description="Marks and feedback from teachers, updated as soon as work is graded."
        className="page-section"
      >
        {summary.graded.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Assignment</th>
                  <th scope="col">Marks</th>
                  <th scope="col">Score</th>
                  <th scope="col">Teacher feedback</th>
                </tr>
              </thead>
              <tbody>
                {summary.graded.map((row) => (
                  <tr key={row.assignment.id}>
                    <th scope="row">
                      {row.assignment.title}
                      <small>{row.subject}</small>
                    </th>
                    <td>
                      {row.marks}/{row.assignment.maximum}
                    </td>
                    <td>
                      <span className="meter-cell">
                        {row.score}%
                        <Meter value={row.score} label={row.score + "%"} />
                      </span>
                    </td>
                    <td>{row.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            No graded assignments yet. Results appear here once a teacher grades
            submitted work.
          </EmptyState>
        )}
      </SectionCard>
      <LearnerTestResults />
      <div className="dashboard-grid feature-grid">
        <LearnerTopics />
        <TrendChart key={scopeKey} chart={data.chart} sample />
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Megaphone, Search } from "lucide-react";
import { SectionTopics } from "./results-pages";
import { visibleAnnouncements } from "@/services/academic-model";
import { activeAllocations, assignmentsFor } from "@/services/assignment-model";
import { attendanceRoster } from "@/services/attendance-model";
import {
  formatPercent,
  gradeAverage,
  percent,
  sectionLabel,
  sectionSummary,
  studentAttendance,
  subjectName,
} from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState, TrendChart } from "../dashboard-widgets";
import { roleHref } from "../navigation";
import { TimetableLeaveNotice } from "../leave/leave-widgets";
import { SectionCard } from "../page-header";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

function NoChild() {
  return (
    <EmptyState>
      No children are linked to this parent in the selected school.
    </EmptyState>
  );
}

/** Read-only weekly timetable for teachers, students and parents. */
export function TimetableView() {
  const { role, records, actor, data } = useDemo();
  if (role === "parent" && !data.child) return <NoChild />;
  const allocations = activeAllocations(records, actor);
  const sessions = records.sessions
    .filter((item) => allocations.some((entry) => entry.id === item.allocation))
    .sort((a, b) => a.start.localeCompare(b.start));
  const days = weekdays.filter(
    (day) => day !== "Sunday" || sessions.some((item) => item.day === day),
  );
  const hours =
    sessions.reduce(
      (sum, item) => sum + minutes(item.end) - minutes(item.start),
      0,
    ) / 60;
  return (
    <>
      <div className="kpi-strip">
        <div>
          <span>Weekly sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div>
          <span>Teaching hours</span>
          <strong>{Math.round(hours * 10) / 10}</strong>
        </div>
        <div>
          <span>Subjects</span>
          <strong>
            {new Set(allocations.map((item) => item.subject)).size}
          </strong>
        </div>
        <div>
          <span>Sections</span>
          <strong>
            {new Set(allocations.map((item) => item.section)).size}
          </strong>
        </div>
      </div>
      <SectionCard
        title="Week view"
        description="Sessions are scheduled by the School Admin and update here immediately."
        className="page-section"
      >
        {sessions.length ? (
          <div className="week-grid" role="list">
            {days.map((day) => (
              <div className="week-day" role="listitem" key={day}>
                <h3>{day}</h3>
                {sessions
                  .filter((item) => item.day === day)
                  .map((item) => {
                    const allocation = allocations.find(
                      (entry) => entry.id === item.allocation,
                    )!;
                    return (
                      <article className="session-card" key={item.id}>
                        <span className="session-time">
                          <CalendarClock size={13} aria-hidden="true" />
                          {item.start}–{item.end}
                        </span>
                        <strong>
                          {subjectName(records, allocation.subject)}
                        </strong>
                        <span>
                          {role === "teacher"
                            ? sectionLabel(records, allocation.section)
                            : records.teachers.find(
                                (teacher) => teacher.id === allocation.teacher,
                              )?.name}
                        </span>
                        <span className="session-room">
                          <MapPin size={13} aria-hidden="true" />
                          {item.room}
                        </span>
                      </article>
                    );
                  })}
                {!sessions.some((item) => item.day === day) && (
                  <p className="week-empty">No sessions</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No sessions are scheduled for this week.</EmptyState>
        )}
      </SectionCard>
      <TimetableLeaveNotice />
    </>
  );
}

export function TeacherClasses() {
  const { role, records, actor } = useDemo();
  const allocations = activeAllocations(records, actor);
  const sectionIds = [...new Set(allocations.map((item) => item.section))];
  if (!sectionIds.length)
    return <EmptyState>No classes are assigned in the active year.</EmptyState>;
  return (
    <div className="class-list">
      {sectionIds.map((id) => {
        const summary = sectionSummary(records, id);
        const mine = allocations.filter((item) => item.section === id);
        const ids = new Set(
          assignmentsFor(records, actor)
            .filter((item) =>
              mine.some((entry) => entry.id === item.allocation),
            )
            .map((item) => item.id),
        );
        return (
          <SectionCard
            key={id}
            title={sectionLabel(records, id)}
            description={
              mine
                .map((item) => subjectName(records, item.subject))
                .join(" · ") +
              " · " +
              (records.years.find((year) => year.id === summary.section?.year)
                ?.name ?? "")
            }
            actions={
              <div className="card-actions">
                {summary.section?.coordinator === actor.person && (
                  <span className="pill pill-success">Class coordinator</span>
                )}
                <Link
                  className="button button-outline"
                  href={roleHref(role, "attendance")}
                >
                  Take attendance
                </Link>
                <Link
                  className="button button-outline"
                  href={roleHref(role, "assignments")}
                >
                  Assignments
                </Link>
              </div>
            }
          >
            <div className="kpi-strip compact">
              <div>
                <span>Students</span>
                <strong>
                  {summary.roster.length}/{summary.capacity}
                </strong>
              </div>
              <div>
                <span>Attendance</span>
                <strong>{formatPercent(summary.attendance)}</strong>
              </div>
              <div>
                <span>Submission rate</span>
                <strong>{formatPercent(summary.submissionRate)}</strong>
              </div>
              <div>
                <span>Awaiting review</span>
                <strong>{summary.awaitingReview}</strong>
              </div>
            </div>
            {summary.roster.length ? (
              <div className="table-wrap">
                <table className="pro-table">
                  <caption className="sr-only">
                    Roster for {sectionLabel(records, id)}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Student number</th>
                      <th scope="col">Attendance</th>
                      <th scope="col">Average grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.roster.map((student) => (
                      <tr key={student.id}>
                        <th scope="row">{student.name}</th>
                        <td>{student.code}</td>
                        <td>
                          {formatPercent(
                            studentAttendance(records, student.id),
                          )}
                        </td>
                        <td>
                          {formatPercent(
                            gradeAverage(records, ids, student.id),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No students are enrolled in this section.</EmptyState>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

export function ClassPerformance() {
  const { records, actor, data, scopeKey } = useDemo();
  const allocations = activeAllocations(records, actor);
  const assignments = assignmentsFor(records, actor).filter(
    (item) => item.published,
  );
  const rows = allocations.map((allocation) => {
    const own = assignments.filter((item) => item.allocation === allocation.id);
    const ids = new Set(own.map((item) => item.id));
    const roster = attendanceRoster(records, allocation.section);
    const work = records.submissions.filter((item) => ids.has(item.assignment));
    return {
      allocation,
      roster,
      count: own.length,
      submissionRate: percent(
        work.filter(
          (item) => item.status === "Submitted" || item.status === "Graded",
        ).length,
        own.length * roster.length,
      ),
      average: gradeAverage(records, ids),
      attendance: sectionSummary(records, allocation.section).attendance,
    };
  });
  const allIds = new Set(assignments.map((item) => item.id));
  const students = [
    ...new Map(
      rows.flatMap((row) =>
        row.roster.map((student) => [
          student.id,
          { student, section: row.allocation.section },
        ]),
      ),
    ).values(),
  ];
  return (
    <>
      <SectionCard
        title="By subject and section"
        description="Live figures from your published assignments and attendance."
        className="page-section"
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Assignments</th>
                  <th scope="col">Submission rate</th>
                  <th scope="col">Average grade</th>
                  <th scope="col">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.allocation.id}>
                    <th scope="row">
                      {subjectName(records, row.allocation.subject)}
                      <small>
                        {sectionLabel(records, row.allocation.section)}
                      </small>
                    </th>
                    <td>{row.count}</td>
                    <td>{formatPercent(row.submissionRate)}</td>
                    <td>{formatPercent(row.average)}</td>
                    <td>{formatPercent(row.attendance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No classes are assigned in the active year.</EmptyState>
        )}
      </SectionCard>
      <div className="dashboard-grid">
        <SectionCard
          title="Students"
          description="Attendance and average grade across your subjects."
        >
          {students.length ? (
            <ul className="stack-list">
              {students.map(({ student, section }) => (
                <li key={student.id}>
                  <strong>{student.name}</strong>
                  <span>
                    {sectionLabel(records, section)} · Attendance{" "}
                    {formatPercent(studentAttendance(records, student.id))} ·
                    Average{" "}
                    {formatPercent(gradeAverage(records, allIds, student.id))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No enrolled students yet.</EmptyState>
          )}
        </SectionCard>
        <TrendChart key={scopeKey} chart={data.chart} sample />
      </div>
      <SectionTopics />
    </>
  );
}

export function AnnouncementsFeed() {
  const { role, records, data } = useDemo();
  const [query, setQuery] = useState("");
  const items = visibleAnnouncements(
    records,
    role,
    data.person.id,
    data.child?.id,
  );
  const term = query.trim().toLowerCase();
  const visible = items.filter((item) =>
    (item.name + " " + item.message).toLowerCase().includes(term),
  );
  return (
    <SectionCard
      title={items.length + " published notices"}
      description="Published by your School Admin for your school, role or section."
      className="page-section"
      actions={
        <label className="inline-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search announcements</span>
          <input
            type="search"
            placeholder="Search announcements"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      }
    >
      {visible.length ? (
        <ul className="announcement-list">
          {visible.map((item) => (
            <li key={item.id}>
              <span className="stat-icon tint-1">
                <Megaphone size={17} aria-hidden="true" />
              </span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.message}</p>
                <div className="tag-row">
                  <span className="pill pill-muted">
                    {item.audience === "All"
                      ? "Everyone"
                      : item.audience[0].toUpperCase() +
                        item.audience.slice(1) +
                        "s"}
                  </span>
                  <span className="pill pill-muted">
                    {item.section
                      ? sectionLabel(records, item.section)
                      : "Whole school"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>
          {items.length
            ? "No announcements match your search."
            : "No announcements yet."}
        </EmptyState>
      )}
    </SectionCard>
  );
}

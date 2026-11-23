"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import type {
  AcademicSchool,
  AttendanceStatus,
} from "@/services/academic-model";
import {
  activeAllocations,
  localCalendarDate,
  type AssignmentActor,
} from "@/services/assignment-model";
import {
  attendanceFor,
  attendancePercentage,
  attendanceRoster,
} from "@/services/attendance-model";
import {
  approvedLeaveOn,
  leaveSchool,
  pendingLeaveOn,
  studentAttendanceWithLeave,
} from "@/services/leave-model";
import { recordAttendance, useLeaveState } from "@/services/leave-store";

const statuses: AttendanceStatus[] = ["Present", "Absent", "Late"];

export function AttendanceWorkspace({
  school,
  actor,
}: {
  school: AcademicSchool;
  actor: AssignmentActor;
}) {
  const teacher = actor.role === "teacher";
  const sections = school.sections.filter(
    (group) =>
      !teacher ||
      activeAllocations(school, actor).some(
        (item) => item.section === group.id,
      ),
  );
  const [section, setSection] = useState(
    teacher ? (sections[0]?.id ?? "") : "",
  );
  const [date, setDate] = useState(localCalendarDate);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const visible = attendanceFor(school, actor)
    .filter((item) => !section || item.section === section)
    .sort((a, b) => b.date.localeCompare(a.date));
  const roster = attendanceRoster(school, section);
  const saved = visible.find((item) => item.date === date);
  const percent = attendancePercentage(visible);
  const manager = teacher || actor.role === "school-admin";
  const leave = leaveSchool(useLeaveState(), actor.school);
  const learner =
    actor.role === "student"
      ? actor.person
      : actor.role === "parent"
        ? actor.child
        : undefined;
  const withLeave = learner
    ? studentAttendanceWithLeave(school, leave, learner)
    : undefined;
  /** Absent marks on a record that are covered by approved student leave. */
  const excused = (record: (typeof visible)[number]) =>
    Object.entries(record.marks).filter(
      ([student, mark]) =>
        mark === "Absent" &&
        approvedLeaveOn(leave, "student", student, record.date),
    ).length;
  return (
    <Card id="attendance-workspace" className="dash-card academic-workspace">
      <div className="academic-toolbar">
        <div>
          <h2>Attendance</h2>
          <p>
            {percent === undefined
              ? "No attendance recorded"
              : percent +
                "% physical attendance · Late counts as attended" +
                (withLeave
                  ? " · " +
                    withLeave.approvedLeaveDays +
                    " approved leave day" +
                    (withLeave.approvedLeaveDays === 1 ? "" : "s") +
                    " (not counted as presence)"
                  : "")}
          </p>
        </div>
        {manager && (
          <label>
            Section
            <select
              value={section}
              onChange={(event) => {
                setSection(event.target.value);
                setNotice("");
                setError("");
              }}
            >
              {!teacher && <option value="">All sections</option>}
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.grade} · {item.name} ·{" "}
                  {school.years.find((year) => year.id === item.year)?.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {teacher && (
          <label>
            Date
            <input
              type="date"
              value={date}
              max={localCalendarDate()}
              onChange={(event) => {
                setDate(event.target.value);
                setNotice("");
                setError("");
              }}
            />
          </label>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {teacher && roster.length > 0 && (
        <form
          className="academic-detail academic-workspace"
          key={section + date}
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const marks = Object.fromEntries(
                new FormData(event.currentTarget),
              ) as Record<string, AttendanceStatus>;
              recordAttendance(actor, section, date, marks);
              setError("");
              setNotice(
                Object.values(marks).includes("Absent")
                  ? "Attendance saved. Linked parents have an in-app absence alert."
                  : "Attendance saved.",
              );
            } catch (failure) {
              setNotice("");
              setError((failure as Error).message);
            }
          }}
        >
          {roster.map((item) => {
            const approved = approvedLeaveOn(leave, "student", item.id, date);
            const pending = pendingLeaveOn(leave, "student", item.id, date);
            return (
              <label key={item.id}>
                <span className="attendance-name">
                  {item.name}
                  {approved ? (
                    <span className="pill pill-info">
                      Approved leave · {approved.type}
                    </span>
                  ) : (
                    pending && (
                      <span className="pill pill-warning">Leave pending</span>
                    )
                  )}
                </span>
                <select
                  name={item.id}
                  defaultValue={saved?.marks[item.id] ?? "Present"}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <button className="button button-outline" type="submit">
            Save attendance
          </button>
        </form>
      )}
      {visible.length > 0 && (
        <div className="academic-table">
          <table>
            <caption className="sr-only">
              Attendance history. Absent counts are the recorded marks; Approved
              Leave shows how many of them are covered by approved leave.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Section</th>
                {statuses.map((item) => (
                  <th scope="col" key={item}>
                    {item}
                  </th>
                ))}
                <th scope="col">
                  Approved Leave
                  <span className="sr-only">
                    {" "}
                    (absent marks covered by approved leave)
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const group = school.sections.find(
                  (entry) => entry.id === item.section,
                );
                return (
                  <tr key={item.section + item.date}>
                    <td>
                      {teacher ? (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setDate(item.date)}
                        >
                          {item.date}
                        </button>
                      ) : (
                        item.date
                      )}
                    </td>
                    <td>
                      {group?.grade} · {group?.name}
                    </td>
                    {statuses.map((status) => (
                      <td key={status}>
                        {
                          Object.values(item.marks).filter(
                            (mark) => mark === status,
                          ).length
                        }
                      </td>
                    ))}
                    <td>{excused(item)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

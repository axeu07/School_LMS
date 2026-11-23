"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import type {
  AcademicSchool,
  AttendanceStatus,
} from "@/services/academic-model";
import { updateAcademicState } from "@/services/academic-store";
import {
  activeAllocations,
  localCalendarDate,
  type AssignmentActor,
} from "@/services/assignment-model";
import {
  attendanceFor,
  attendancePercentage,
  attendanceRoster,
  saveAttendance,
} from "@/services/attendance-model";

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
  return (
    <Card id="attendance-workspace" className="dash-card academic-workspace">
      <div className="academic-toolbar">
        <div>
          <h2>Attendance</h2>
          <p>
            {percent === undefined
              ? "No attendance recorded"
              : percent + "% attendance · Late counts as attended"}
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
              updateAcademicState((state) =>
                saveAttendance(state, actor, section, date, marks),
              );
              setError("");
              setNotice("Attendance saved.");
            } catch (failure) {
              setNotice("");
              setError((failure as Error).message);
            }
          }}
        >
          {roster.map((item) => (
            <label key={item.id}>
              {item.name}
              <select
                name={item.id}
                defaultValue={saved?.marks[item.id] ?? "Present"}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          ))}
          <button className="button button-outline" type="submit">
            Save attendance
          </button>
        </form>
      )}
      {visible.length > 0 && (
        <div className="academic-table">
          <table>
            <caption className="sr-only">Attendance history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Section</th>
                {statuses.map((item) => (
                  <th scope="col" key={item}>
                    {item}
                  </th>
                ))}
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

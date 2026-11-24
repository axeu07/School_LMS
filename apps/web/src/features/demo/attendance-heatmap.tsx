"use client";

import type { AcademicSchool } from "@/services/academic-model";
import { localCalendarDate } from "@/services/assignment-model";
import {
  currentYear,
  dayOfWeek,
  dayStatusLabels,
  holidayDates,
  shiftDate,
  studentAttendanceDays,
  summarizeDays,
  teacherAttendanceDays,
  type AttendanceDay,
  type DayStatus,
} from "@/services/attendance-calendar";
import { useCommunicationState } from "@/services/communication-store";
import { leaveSchool } from "@/services/leave-model";
import { useLeaveState } from "@/services/leave-store";
import type { SchoolId } from "@/types/demo";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const legend: DayStatus[] = ["present", "half", "absent", "holiday", "none"];

/** Range, holidays and today for the current academic year. */
export function useAttendanceRange(
  school: AcademicSchool,
  schoolId: SchoolId,
  section?: string,
) {
  const events = useCommunicationState().schools[schoolId]?.events ?? [];
  const today = localCalendarDate();
  const year = currentYear(school, today);
  return {
    today,
    start: year?.start ?? shiftDate(today, -364),
    end: year?.end ?? today,
    holidays: holidayDates(events, section),
  };
}

const readable = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** GitHub-style contribution grid: one square per day, one column per week. */
export function AttendanceHeatmap({
  days,
  label,
  footnote,
}: {
  days: AttendanceDay[];
  label: string;
  footnote?: string;
}) {
  if (!days.length) return null;
  const lead = dayOfWeek(days[0].date);
  const cells: (AttendanceDay | undefined)[] = [
    ...Array<undefined>(lead).fill(undefined),
    ...days,
  ];
  const weeks: (AttendanceDay | undefined)[][] = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  const summary = summarizeDays(days);
  return (
    <figure className="attendance-heatmap" aria-label={label}>
      <div className="heatmap-summary">
        <span>
          <strong>{summary.percent ?? "—"}%</strong> attendance
        </span>
        <span>
          <i className="heat-dot heat-present" /> {summary.present} present
        </span>
        <span>
          <i className="heat-dot heat-half" /> {summary.half} half day
        </span>
        <span>
          <i className="heat-dot heat-absent" /> {summary.absent} absent
        </span>
      </div>
      <div className="heatmap-scroll">
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, var(--heat-cell))`,
          }}
        >
          <span />
          {weeks.map((week, index) => (
            <span key={"m" + index} className="heatmap-month">
              {monthLabel(week, index)}
            </span>
          ))}
          {weekdays.map((name, row) => (
            <Row key={name} name={name} row={row} weeks={weeks} />
          ))}
        </div>
      </div>
      <figcaption className="heatmap-legend">
        {legend.map((status) => (
          <span key={status}>
            <i className={"heat-dot heat-" + status} />
            {dayStatusLabels[status]}
          </span>
        ))}
        {footnote && <em>{footnote}</em>}
      </figcaption>
    </figure>
  );
}

/** Label the week holding a month's 1st, and the first week if it starts early. */
function monthLabel(week: (AttendanceDay | undefined)[], index: number) {
  const first = week.find((day) => day?.date.endsWith("-01"));
  const start = week.find(Boolean);
  const day =
    first ??
    (index === 0 && start && Number(start.date.slice(8, 10)) <= 21
      ? start
      : undefined);
  return day ? months[Number(day.date.slice(5, 7)) - 1] : "";
}

function Row({
  name,
  row,
  weeks,
}: {
  name: string;
  row: number;
  weeks: (AttendanceDay | undefined)[][];
}) {
  return (
    <>
      <span className="heatmap-weekday">{row % 2 ? name : ""}</span>
      {weeks.map((week, index) => {
        const day = week[row];
        if (!day) return <span key={index} />;
        const title =
          readable(day.date) +
          " · " +
          dayStatusLabels[day.status] +
          (day.note ? " · " + day.note : "");
        return (
          <span
            key={index}
            className={"heat-cell heat-" + day.status}
            title={title}
            aria-label={title}
            role="img"
          />
        );
      })}
    </>
  );
}

/** A student's year of attendance, merged with their approved leave. */
export function StudentAttendanceCalendar({
  school,
  schoolId,
  student,
  section,
}: {
  school: AcademicSchool;
  schoolId: SchoolId;
  student: string;
  section?: string;
}) {
  const leave = leaveSchool(useLeaveState(), schoolId);
  const range = useAttendanceRange(school, schoolId, section);
  const name = school.students.find((item) => item.id === student)?.name;
  const days = studentAttendanceDays(
    school,
    leave,
    student,
    range.holidays,
    range.start,
    range.end,
    range.today,
  );
  return (
    <AttendanceHeatmap
      days={days}
      label={"Attendance calendar for " + (name ?? "student")}
      footnote="Late counts as present. Hover a square for details."
    />
  );
}

/** A teacher's year of attendance, derived from approved leave. */
export function TeacherAttendanceCalendar({
  school,
  schoolId,
  teacher,
}: {
  school: AcademicSchool;
  schoolId: SchoolId;
  teacher: string;
}) {
  const leave = leaveSchool(useLeaveState(), schoolId);
  const range = useAttendanceRange(school, schoolId);
  const name = school.teachers.find((item) => item.id === teacher)?.name;
  const days = teacherAttendanceDays(
    leave,
    teacher,
    range.holidays,
    range.start,
    range.end,
    range.today,
  );
  return (
    <AttendanceHeatmap
      days={days}
      label={"Attendance calendar for " + (name ?? "teacher")}
      footnote="School days count as present unless approved leave covers them."
    />
  );
}

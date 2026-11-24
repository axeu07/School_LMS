import type { AcademicSchool } from "./academic-model";
import type { SchoolEvent } from "./calendar-model";
import { coversDate, type LeaveRequest, type LeaveSchool } from "./leave-model";

/**
 * Day-by-day attendance for the GitHub-style calendar.
 *
 * present  — Present or Late (late still counts as attended)
 * absent   — Absent, or a full day of approved leave
 * half     — a half day of approved leave
 * holiday  — a published school holiday or a Sunday: left blank
 * none     — a school day with nothing recorded
 * upcoming — a day after today
 */
export type DayStatus =
  "present" | "absent" | "half" | "holiday" | "none" | "upcoming";

export type AttendanceDay = { date: string; status: DayStatus; note: string };

export const dayStatusLabels: Record<DayStatus, string> = {
  present: "Present",
  absent: "Absent",
  half: "Half day",
  holiday: "School holiday",
  none: "No record",
  upcoming: "Upcoming",
};

const parse = (date: string) => new Date(date + "T00:00:00Z");
const format = (date: Date) => date.toISOString().slice(0, 10);

export function shiftDate(date: string, days: number) {
  const next = parse(date);
  next.setUTCDate(next.getUTCDate() + days);
  return format(next);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string) {
  return parse(date).getUTCDay();
}

export function datesFrom(start: string, end: string) {
  const dates: string[] = [];
  for (let day = start; day <= end; day = shiftDate(day, 1)) dates.push(day);
  return dates;
}

/** The academic year that contains `today`, else the most recent one. */
export function currentYear(school: AcademicSchool, today: string) {
  const years = [...school.years].sort((a, b) =>
    b.start.localeCompare(a.start),
  );
  return (
    years.find((year) => year.start <= today && today <= year.end) ??
    years.find((year) => year.start <= today) ??
    years[0]
  );
}

/** Published school holidays, optionally limited to one section. */
export function holidayDates(events: SchoolEvent[], section?: string) {
  const dates = new Set<string>();
  for (const event of events) {
    if (event.category !== "holiday" || event.status !== "Published") continue;
    if (section && event.sections.length && !event.sections.includes(section))
      continue;
    datesFrom(event.startDate, event.endDate || event.startDate).forEach(
      (date) => dates.add(date),
    );
  }
  return dates;
}

const isHoliday = (date: string, holidays: Set<string>) =>
  dayOfWeek(date) === 0 || holidays.has(date);

const approvedOn = (requests: LeaveRequest[], date: string) =>
  requests.find((item) => coversDate(item, date));

const leaveNote = (request: LeaveRequest) =>
  request.type +
  " leave" +
  (request.duration === "Full day"
    ? ""
    : " · " + request.duration.toLowerCase());

/** A student's attendance marks merged with their approved leave. */
export function studentAttendanceDays(
  school: AcademicSchool,
  leave: LeaveSchool,
  student: string,
  holidays: Set<string>,
  start: string,
  end: string,
  today: string,
): AttendanceDay[] {
  const marks = new Map<string, string>();
  for (const record of school.attendance) {
    const mark = record.marks[student];
    if (mark && start <= record.date && record.date <= end)
      marks.set(record.date, mark);
  }
  const approved = leave.requests.filter(
    (item) =>
      item.kind === "student" &&
      item.subject === student &&
      item.status === "Approved",
  );
  return datesFrom(start, end).map((date): AttendanceDay => {
    const mark = marks.get(date);
    const request = approvedOn(approved, date);
    if (!mark) {
      if (isHoliday(date, holidays))
        return { date, status: "holiday", note: "" };
      if (date > today) return { date, status: "upcoming", note: "" };
      if (request)
        return {
          date,
          status: request.duration === "Full day" ? "absent" : "half",
          note: leaveNote(request),
        };
      return { date, status: "none", note: "" };
    }
    if (mark === "Absent")
      return {
        date,
        status: request && request.duration !== "Full day" ? "half" : "absent",
        note: request ? leaveNote(request) : "",
      };
    if (request && request.duration !== "Full day")
      return { date, status: "half", note: leaveNote(request) };
    return { date, status: "present", note: mark === "Late" ? "Late" : "" };
  });
}

/**
 * A teacher's attendance. Teachers have no daily register, so every school
 * day up to today counts as present unless approved leave covers it.
 */
export function teacherAttendanceDays(
  leave: LeaveSchool,
  teacher: string,
  holidays: Set<string>,
  start: string,
  end: string,
  today: string,
): AttendanceDay[] {
  const approved = leave.requests.filter(
    (item) =>
      item.kind === "teacher" &&
      item.subject === teacher &&
      item.status === "Approved",
  );
  return datesFrom(start, end).map((date): AttendanceDay => {
    if (isHoliday(date, holidays)) return { date, status: "holiday", note: "" };
    if (date > today) return { date, status: "upcoming", note: "" };
    const request = approvedOn(approved, date);
    if (!request) return { date, status: "present", note: "" };
    return {
      date,
      status: request.duration === "Full day" ? "absent" : "half",
      note: leaveNote(request),
    };
  });
}

export function summarizeDays(days: AttendanceDay[]) {
  const count = (status: DayStatus) =>
    days.filter((day) => day.status === status).length;
  const present = count("present");
  const absent = count("absent");
  const half = count("half");
  const recorded = present + absent + half;
  return {
    present,
    absent,
    half,
    holidays: count("holiday"),
    percent: recorded
      ? Math.round((100 * (present + half * 0.5)) / recorded)
      : undefined,
  };
}

/**
 * Pure helpers that turn the shared demo records into dashboard figures.
 * Nothing here writes to a store, and nothing invents a number: when the
 * records hold no data for a figure, the helper returns `undefined`.
 */
import type { AcademicSchool, Entry } from "@/services/academic-model";
import { attendancePercentage } from "@/services/attendance-model";
import type { LearningSchool } from "@/services/learning-model";
import { sectionLabel, subjectName } from "@/services/insights";

const monthNames = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : undefined;
}

/** "HH:mm" for a Date, in local time. */
export function clockTime(date: Date) {
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

/** Morning / afternoon / evening greeting for the local hour. */
export function greetingFor(date: Date) {
  const hour = date.getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

/** "2026-11" keys for the `count` months ending with `today`'s month. */
export function recentMonths(today: string, count: number) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

export function monthLabel(key: string) {
  return monthNames[Number(key.slice(5, 7)) - 1];
}

/** Days until a "YYYY-MM-DD" date (0 = today, negative = past). */
export function daysUntil(date: string, today: string) {
  return Math.round(
    (Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86_400_000,
  );
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago". */
export function relativeDay(date: string, today: string) {
  const days = daysUntil(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? "In " + days + " days" : -days + " days ago";
}

/* ---------- Timetable ---------- */

export type TodaySession = {
  id: string;
  allocation: string;
  subject: string;
  section: string;
  sectionLabel: string;
  room: string;
  start: string;
  end: string;
  /** Where the session sits relative to the current time. */
  state: "done" | "now" | "next" | "later";
};

/** The actor's sessions on today's weekday, in time order. */
export function sessionsToday(
  school: AcademicSchool,
  allocations: Entry<"allocations">[],
  now: Date,
): TodaySession[] {
  const day = weekdays[now.getDay()];
  const time = clockTime(now);
  const rows = school.sessions
    .filter((session) => session.day === day)
    .flatMap((session) => {
      const allocation = allocations.find(
        (item) => item.id === session.allocation,
      );
      if (!allocation) return [];
      return [
        {
          id: session.id,
          allocation: allocation.id,
          subject: subjectName(school, allocation.subject),
          section: allocation.section,
          sectionLabel: sectionLabel(school, allocation.section),
          room: session.room,
          start: session.start,
          end: session.end,
          state: "later" as TodaySession["state"],
        },
      ];
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  let nextMarked = false;
  for (const row of rows) {
    if (row.end <= time) row.state = "done";
    else if (row.start <= time) row.state = "now";
    else if (!nextMarked) {
      row.state = "next";
      nextMarked = true;
    }
  }
  // While a class is running, the following one is simply "later".
  if (rows.some((row) => row.state === "now"))
    for (const row of rows) if (row.state === "next") row.state = "later";
  return rows;
}

/** The running session, or the next one still to start today. */
export function focusSession(rows: TodaySession[]) {
  return (
    rows.find((row) => row.state === "now") ??
    rows.find((row) => row.state === "next")
  );
}

/* ---------- Scores ---------- */

export type ScorePoint = { label: string; value: number; note: string };

/**
 * Monthly average score (as a percentage) from graded assignments and
 * entered exam marks. Months without any score are left out.
 */
export function scoreTrend(
  school: AcademicSchool,
  learning: LearningSchool,
  months: string[],
  options: {
    /** Limit to these students; all students when omitted. */
    students?: Set<string>;
    /** Limit to these teaching allocations; all when omitted. */
    allocations?: Set<string>;
  } = {},
): ScorePoint[] {
  const { students, allocations } = options;
  const buckets = new Map<string, number[]>();
  const add = (month: string, value: number) => {
    if (!months.includes(month)) return;
    buckets.set(month, [...(buckets.get(month) ?? []), value]);
  };
  for (const submission of school.submissions) {
    if (submission.status !== "Graded" || submission.marks === undefined)
      continue;
    if (students && !students.has(submission.student)) continue;
    const assignment = school.assignments.find(
      (item) => item.id === submission.assignment,
    );
    if (!assignment || !assignment.maximum) continue;
    if (allocations && !allocations.has(assignment.allocation)) continue;
    add(
      assignment.due.slice(0, 7),
      (100 * submission.marks) / assignment.maximum,
    );
  }
  const subjects = allocations
    ? new Set(
        school.allocations
          .filter((item) => allocations.has(item.id))
          .map((item) => item.subject),
      )
    : undefined;
  for (const mark of learning.marks) {
    if (mark.marks === null) continue;
    if (students && !students.has(mark.student)) continue;
    if (subjects && !subjects.has(mark.subject)) continue;
    const exam = learning.exams.find((item) => item.id === mark.exam);
    if (!exam || !exam.maximum) continue;
    add(exam.date.slice(0, 7), (100 * mark.marks) / exam.maximum);
  }
  return months.flatMap((month) => {
    const values = buckets.get(month);
    if (!values?.length) return [];
    return [
      {
        label: monthLabel(month),
        value: average(values)!,
        note: values.length + (values.length === 1 ? " score" : " scores"),
      },
    ];
  });
}

/** Average score per subject for one student (assignments + exams). */
export function subjectScores(
  school: AcademicSchool,
  learning: LearningSchool,
  student: string,
  allocations: Entry<"allocations">[],
) {
  return [...new Set(allocations.map((item) => item.subject))].flatMap(
    (subject) => {
      const ids = new Set(
        allocations
          .filter((item) => item.subject === subject)
          .map((item) => item.id),
      );
      const values = [
        ...school.submissions.flatMap((item) => {
          if (
            item.student !== student ||
            item.status !== "Graded" ||
            item.marks === undefined
          )
            return [];
          const assignment = school.assignments.find(
            (entry) => entry.id === item.assignment,
          );
          return assignment && ids.has(assignment.allocation)
            ? [(100 * item.marks) / assignment.maximum]
            : [];
        }),
        ...learning.marks.flatMap((item) => {
          if (
            item.student !== student ||
            item.subject !== subject ||
            item.marks === null
          )
            return [];
          const exam = learning.exams.find((entry) => entry.id === item.exam);
          return exam ? [(100 * item.marks) / exam.maximum] : [];
        }),
      ];
      const value = average(values);
      return value === undefined
        ? []
        : [{ subject, label: subjectName(school, subject), value }];
    },
  );
}

/** Average exam percentage for a set of students (null marks = absent). */
export function examAverage(learning: LearningSchool, students: Set<string>) {
  return average(
    learning.marks.flatMap((item) => {
      if (item.marks === null || !students.has(item.student)) return [];
      const exam = learning.exams.find((entry) => entry.id === item.exam);
      return exam ? [(100 * item.marks) / exam.maximum] : [];
    }),
  );
}

/* ---------- Attendance ---------- */

export type AttendanceBreakdown = {
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number | undefined;
};

/** Present / late / absent counts for a set of attendance records. */
export function attendanceBreakdown(
  records: AcademicSchool["attendance"],
  student?: string,
): AttendanceBreakdown {
  const marks = records.flatMap((item) =>
    student
      ? item.marks[student]
        ? [item.marks[student]]
        : []
      : Object.values(item.marks),
  );
  return {
    present: marks.filter((mark) => mark === "Present").length,
    late: marks.filter((mark) => mark === "Late").length,
    absent: marks.filter((mark) => mark === "Absent").length,
    total: marks.length,
    rate: attendancePercentage(
      records.map((item) =>
        student
          ? {
              ...item,
              marks: item.marks[student]
                ? { [student]: item.marks[student] }
                : {},
            }
          : item,
      ),
    ),
  };
}

/**
 * The demo series for a chart, used only when live records are too thin to
 * draw a meaningful trend. Callers label the panel "Demo data".
 */
export function demoSeries(chart: {
  labels: string[];
  values: number[];
}): ScorePoint[] {
  return chart.values.map((value, index) => ({
    label: chart.labels[index] ?? "",
    value,
    note: "",
  }));
}

/** Live points when there are enough to draw a trend, otherwise demo ones. */
export function liveOrDemo(
  live: ScorePoint[],
  chart: { labels: string[]; values: number[] },
  minimum = 3,
) {
  return live.length >= minimum || !chart.values.length
    ? { points: live, demo: false }
    : { points: demoSeries(chart), demo: true };
}

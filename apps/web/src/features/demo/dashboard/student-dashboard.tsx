"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  MessageCircleQuestion,
  NotebookPen,
  Sparkles,
  Timer,
} from "lucide-react";
import { visibleAnnouncements } from "@/services/academic-model";
import { activeAllocations, assignmentsFor } from "@/services/assignment-model";
import { calendarEntries } from "@/services/calendar-model";
import { studentSummary, subjectName } from "@/services/insights";
import {
  attemptComplete,
  learnerFor,
  testStatus,
  testsFor,
} from "@/services/learning-model";
import { reportCard } from "@/services/results-model";
import { formatDate } from "../format";
import { ColumnChart, Donut, LineChart, ProgressList } from "./charts";
import {
  DashboardIntro,
  DashRow,
  DateToken,
  KpiGrid,
  Panel,
  QuickActions,
  RowList,
  Segmented,
  Timeline,
  type Row,
} from "./kit";
import {
  attendanceBreakdown,
  daysUntil,
  liveOrDemo,
  focusSession,
  greetingFor,
  recentMonths,
  relativeDay,
  scoreTrend,
  sessionsToday,
} from "./metrics";
import type { DashboardSources } from "./use-dashboard";

export function StudentDashboard({ sources }: { sources: DashboardSources }) {
  const {
    records,
    learning,
    learningState,
    comm,
    leave,
    actor,
    now,
    today,
    href,
    stage,
  } = sources;
  const [period, setPeriod] = useState<"3" | "6">("6");
  const student = learnerFor(records, actor) ?? actor.person;
  const allocations = activeAllocations(records, actor);
  const sessions = sessionsToday(records, allocations, now);
  const focus = focusSession(sessions);
  const summary = studentSummary(records, student);

  const assignments = assignmentsFor(records, actor);
  const handedIn = (id: string) =>
    records.submissions.some(
      (item) =>
        item.assignment === id &&
        item.student === student &&
        (item.status === "Submitted" || item.status === "Graded"),
    );
  const homework = assignments
    .filter((item) => item.due >= today && !handedIn(item.id))
    .sort((a, b) => a.due.localeCompare(b.due));
  const subjectOf = (allocation: string) =>
    subjectName(
      records,
      allocations.find((item) => item.id === allocation)?.subject ?? "",
    );

  const tests = testsFor(learningState, records, actor).filter((test) => {
    const status = testStatus(test, now);
    const attempt = learning.attempts.find(
      (item) => item.test === test.id && item.student === student,
    );
    return (
      (status === "Upcoming" || status === "Open") &&
      !attemptComplete(test, attempt, now)
    );
  });
  const section = records.sections.find(
    (item) => item.id === summary.enrollment?.section,
  );
  const exams = learning.exams.filter(
    (item) => item.year === section?.year && item.date >= today,
  );
  const upcoming = [
    ...tests.map((test) => ({
      key: "test-" + test.id,
      title: test.title,
      date: testStatus(test, now) === "Open" ? today : test.opens.slice(0, 10),
      detail:
        subjectOf(test.allocation) +
        (testStatus(test, now) === "Open" ? " · open now" : " · online test"),
    })),
    ...exams.map((exam) => ({
      key: "exam-" + exam.id,
      title: exam.name,
      date: exam.date,
      detail: "Exam · all subjects",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const nearest = upcoming[0];

  // Continue learning: how much of each subject's homework is done.
  const subjects = [...new Set(allocations.map((item) => item.subject))].map(
    (subject) => {
      const ids = new Set(
        allocations
          .filter((item) => item.subject === subject)
          .map((item) => item.id),
      );
      const own = assignments.filter((item) => ids.has(item.allocation));
      const done = own.filter((item) => handedIn(item.id)).length;
      return {
        label: subjectName(records, subject),
        value: own.length ? Math.round((100 * done) / own.length) : undefined,
        detail: own.length
          ? done + " of " + own.length + " assignments done"
          : "No assignments yet",
      };
    },
  );

  const months = recentMonths(today, Number(period));
  const progress = liveOrDemo(
    scoreTrend(records, learning, recentMonths(today, 6), {
      students: new Set([student]),
    }),
    sources.data.chart,
  );
  const trend = progress.points.slice(-months.length);
  // Course progress per subject (demo series until lessons track completion).
  const courses = sources.data.courses;
  const attendance = attendanceBreakdown(records.attendance, student);

  const results: Row[] = [
    ...learning.exams
      .filter((exam) => exam.published)
      .flatMap((exam) => {
        const card = reportCard(learning, records, student, exam.id);
        return card.percent === undefined
          ? []
          : [
              {
                key: "exam-" + exam.id,
                title: exam.name,
                detail: "Report card · " + formatDate(exam.date),
                meta: card.percent + "% · " + card.grade,
                tone: "accent" as const,
                href: href("progress"),
              },
            ];
      }),
    ...summary.graded
      .slice()
      .reverse()
      .map((item) => ({
        key: item.assignment.id,
        title: item.assignment.title,
        detail: item.subject + (item.feedback ? " · " + item.feedback : ""),
        meta: item.marks + "/" + item.assignment.maximum,
        tone: item.score < 50 ? ("warn" as const) : undefined,
        href: href("progress"),
      })),
  ];

  const events = calendarEntries(comm, learningState, records, actor, leave)
    .filter(
      (item) =>
        item.source === "event" &&
        item.status === "Published" &&
        item.endDate >= today,
    )
    .slice(0, 2);
  const news: Row[] = [
    ...events.map((item) => ({
      key: item.key,
      title: item.title,
      detail: item.description || "School event",
      meta:
        item.startDate < today ? "Ongoing" : relativeDay(item.startDate, today),
      lead: <DateToken date={item.startDate} />,
      href: href("calendar"),
    })),
    ...visibleAnnouncements(records, "student", student)
      .slice(-3)
      .reverse()
      .map((item) => ({
        key: item.id,
        title: item.name,
        detail: item.message,
        href: href("announcements"),
      })),
  ];

  const playful = stage !== "senior";
  const context = focus
    ? (focus.state === "now" ? "You're in " : "Next class: ") +
      focus.subject +
      " at " +
      focus.start +
      " in " +
      focus.room +
      "."
    : sessions.length
      ? "Classes are done for today" + (playful ? " — nice work!" : ".")
      : "No classes today.";

  return (
    <>
      <DashboardIntro
        greeting={
          playful ? (
            <>
              Hi {sources.firstName}!{" "}
              <span className="hero-wave" aria-hidden="true">
                👋
              </span>
            </>
          ) : (
            greetingFor(now) + ", " + sources.firstName
          )
        }
        date={now}
        context={
          <>
            {context}{" "}
            {homework.length
              ? homework.length +
                " homework " +
                (homework.length === 1 ? "task" : "tasks") +
                " to finish."
              : "No homework pending."}
          </>
        }
        aside={
          <QuickActions
            actions={[
              ...sources.action("assignments", "Submit homework", NotebookPen),
              ...sources.action("quizzes", "Take a test", Timer),
              ...sources.action("courses", "My courses", BookOpen),
              ...sources.action(
                "doubt-board",
                "Ask a doubt",
                MessageCircleQuestion,
              ),
            ]}
          />
        }
      />
      <KpiGrid
        items={[
          {
            label: "Classes today",
            value: String(sessions.length),
            hint: focus
              ? (focus.state === "now" ? "Now: " : "Next: ") +
                focus.subject +
                " · " +
                focus.start
              : sessions.length
                ? "All done for today"
                : "No classes today",
            icon: GraduationCap,
            href: href("timetable"),
          },
          {
            label: "Pending homework",
            value: String(homework.length),
            hint: homework[0]
              ? homework[0].title + " · " + relativeDay(homework[0].due, today)
              : "You're all caught up",
            icon: ClipboardList,
            href: href("assignments"),
            tone:
              homework[0] && daysUntil(homework[0].due, today) <= 1
                ? "attention"
                : undefined,
          },
          {
            label: "Upcoming exams",
            value: String(upcoming.length),
            hint: nearest
              ? nearest.title + " · " + relativeDay(nearest.date, today)
              : "Nothing scheduled",
            icon: CalendarCheck2,
            href: href("quizzes"),
            tone:
              nearest && daysUntil(nearest.date, today) <= 3
                ? "attention"
                : undefined,
          },
          {
            label: "Attendance",
            value:
              summary.attendance === undefined ? "—" : summary.attendance + "%",
            hint:
              summary.attendance === undefined
                ? "Not recorded yet"
                : summary.attendance >= 75
                  ? "On track this year"
                  : "Below the 75% target",
            icon: Sparkles,
            href: href("attendance"),
            ring: summary.attendance,
            tone:
              summary.attendance !== undefined && summary.attendance < 75
                ? "attention"
                : undefined,
          },
        ]}
      />
      <DashRow layout="wide-left" label="Today">
        <Panel
          title="Today's classes"
          href={href("timetable")}
          hrefLabel="Timetable"
        >
          <Timeline
            sessions={sessions}
            showSection={false}
            empty={
              playful
                ? "No classes today — enjoy your day!"
                : "No classes today."
            }
          />
        </Panel>
        <Panel title="Homework & deadlines" href={href("assignments")}>
          <RowList
            rows={[
              ...upcoming.slice(0, 1).map((item) => ({
                key: item.key,
                title: item.title,
                detail: item.detail,
                meta: relativeDay(item.date, today),
                tone: "accent" as const,
                lead: <DateToken date={item.date} />,
                href: href("quizzes"),
              })),
              ...homework.map((item) => ({
                key: item.id,
                title: item.title,
                detail: subjectOf(item.allocation),
                meta: relativeDay(item.due, today),
                tone:
                  daysUntil(item.due, today) <= 1
                    ? ("warn" as const)
                    : undefined,
                lead: <DateToken date={item.due} />,
                href: href("assignments"),
              })),
            ]}
            empty={
              playful ? "No homework due. Great job! 🎉" : "No homework due."
            }
          />
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Learning">
        <Panel
          title="Continue learning"
          subtitle={
            courses.length
              ? "Course progress by subject"
              : "Homework completed in each subject"
          }
          href={href("courses")}
          hrefLabel="My courses"
          demo={courses.length > 0}
        >
          {courses.length ? (
            <ColumnChart
              label="Course progress by subject"
              items={courses.map((item) => ({
                label: item.title,
                value: item.progress,
              }))}
            />
          ) : subjects.length ? (
            <ProgressList items={subjects} />
          ) : (
            <RowList rows={[]} empty="You're not enrolled in a class yet." />
          )}
        </Panel>
        <Panel
          title="My progress"
          subtitle="Average score each month"
          href={href("progress")}
          demo={progress.demo}
          action={
            <Segmented
              label="Chart period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "3", label: "3M" },
                { value: "6", label: "6M" },
              ]}
            />
          }
        >
          {trend.length ? (
            <LineChart points={trend} label="Average score by month" />
          ) : (
            <RowList
              rows={[]}
              empty="Scores appear here once work is graded."
            />
          )}
        </Panel>
        <Panel
          title="Attendance"
          subtitle="This academic year"
          href={href("attendance")}
        >
          {attendance.total ? (
            <Donut
              label="Attendance breakdown"
              center={(attendance.rate ?? 0) + "%"}
              caption={attendance.total + " days"}
              segments={[
                { label: "Present", value: attendance.present, tone: "c1" },
                { label: "Late", value: attendance.late, tone: "warn" },
                { label: "Absent", value: attendance.absent, tone: "danger" },
              ]}
            />
          ) : (
            <RowList rows={[]} empty="No attendance recorded yet." />
          )}
        </Panel>
      </DashRow>
      <DashRow layout="halves" label="Updates">
        <Panel title="Recent results" href={href("progress")}>
          <RowList rows={results} limit={4} empty="No graded work yet." />
        </Panel>
        <Panel title="School updates" href={href("announcements")}>
          <RowList rows={news} limit={4} empty="No announcements right now." />
        </Panel>
      </DashRow>
    </>
  );
}

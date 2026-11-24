"use client";

import {
  CalendarClock,
  ClipboardCheck,
  FilePlus2,
  FileUp,
  NotebookPen,
  PenLine,
  Presentation,
} from "lucide-react";
import { activeAllocations, assignmentsFor } from "@/services/assignment-model";
import { attendanceRoster } from "@/services/attendance-model";
import { sectionLabel, studentSummary, subjectName } from "@/services/insights";
import { testStatus, testsFor } from "@/services/learning-model";
import { pendingApprovals, personName } from "@/services/leave-model";
import { examsFor } from "@/services/results-model";
import { visibleAnnouncements } from "@/services/academic-model";
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
  Timeline,
  type Row,
} from "./kit";
import {
  attendanceBreakdown,
  focusSession,
  greetingFor,
  liveOrDemo,
  recentMonths,
  scoreTrend,
  weekdays,
  relativeDay,
  sessionsToday,
} from "./metrics";
import type { DashboardSources } from "./use-dashboard";

export function TeacherDashboard({ sources }: { sources: DashboardSources }) {
  const { records, learning, learningState, leave, actor, now, today, href } =
    sources;
  const allocations = activeAllocations(records, actor);
  const sessions = sessionsToday(records, allocations, now);
  const focus = focusSession(sessions);

  // Attendance is pending for each section taught today without a register.
  const sectionsToday = [...new Set(sessions.map((item) => item.section))];
  const attendancePending = sectionsToday.filter(
    (section) =>
      !records.attendance.some(
        (item) => item.section === section && item.date === today,
      ),
  );

  const assignments = assignmentsFor(records, actor);
  const assignmentIds = new Set(assignments.map((item) => item.id));
  const toReview = records.submissions.filter(
    (item) => item.status === "Submitted" && assignmentIds.has(item.assignment),
  );
  const leaveToReview = pendingApprovals(leave, records, actor);

  const tests = testsFor(learningState, records, actor).filter((test) => {
    const status = testStatus(test, now);
    return status === "Upcoming" || status === "Open";
  });
  const exams = examsFor(learning, records, actor).filter(
    (item) => item.date >= today,
  );
  const assessments = [
    ...tests.map((test) => ({
      key: "test-" + test.id,
      title: test.title,
      date: testStatus(test, now) === "Open" ? today : test.opens.slice(0, 10),
      detail:
        testStatus(test, now) === "Open"
          ? "Online test · open now"
          : "Online test · opens " + test.opens.slice(11, 16),
    })),
    ...exams.map((exam) => ({
      key: "exam-" + exam.id,
      title: exam.name,
      date: exam.date,
      detail: "Exam · marks entry after the paper",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Submission progress for the most recent published assignments.
  const submissionProgress = assignments
    .filter((item) => item.published)
    .sort((a, b) => b.due.localeCompare(a.due))
    .slice(0, 4)
    .map((assignment) => {
      const allocation = allocations.find(
        (item) => item.id === assignment.allocation,
      );
      const roster = allocation
        ? attendanceRoster(records, allocation.section)
        : [];
      const handedIn = records.submissions.filter(
        (item) =>
          item.assignment === assignment.id &&
          (item.status === "Submitted" || item.status === "Graded"),
      ).length;
      return {
        label: assignment.title,
        value: roster.length
          ? Math.round((100 * handedIn) / roster.length)
          : undefined,
        detail:
          handedIn +
          " of " +
          roster.length +
          " submitted · " +
          (allocation ? sectionLabel(records, allocation.section) : "") +
          " · due " +
          formatDate(assignment.due),
      };
    });

  // Syllabus coverage: topics in each subject that have study material.
  const syllabus = [...new Set(allocations.map((item) => item.subject))].map(
    (subject) => {
      const chapters = new Set(
        learning.chapters
          .filter((item) => item.subject === subject)
          .map((item) => item.id),
      );
      const topics = learning.topics.filter((item) =>
        chapters.has(item.chapter),
      );
      const ready = topics.filter((topic) =>
        learning.materials.some((item) => item.topic === topic.id),
      ).length;
      return {
        label: subjectName(records, subject),
        value: topics.length
          ? Math.round((100 * ready) / topics.length)
          : undefined,
        detail: topics.length
          ? ready + " of " + topics.length + " topics have study material"
          : "No chapters planned yet",
      };
    },
  );

  // Students whose attendance or scores need a closer look.
  const myStudents = [
    ...new Set(allocations.map((item) => item.section)),
  ].flatMap((section) =>
    attendanceRoster(records, section).map((student) => ({
      student,
      section,
    })),
  );
  const attention: Row[] = myStudents.flatMap(({ student, section }) => {
    const summary = studentSummary(records, student.id);
    const reasons = [
      summary.attendance !== undefined && summary.attendance < 75
        ? "Attendance " + summary.attendance + "%"
        : "",
      summary.average !== undefined && summary.average < 50
        ? "Average " + summary.average + "%"
        : "",
    ].filter(Boolean);
    if (!reasons.length) return [];
    return [
      {
        key: student.id,
        title: student.name,
        detail: sectionLabel(records, section) + " · " + reasons.join(" · "),
        tone: "warn" as const,
        href: href("performance"),
      },
    ];
  });

  const reviewRows: Row[] = [
    ...leaveToReview.map((item) => ({
      key: "leave-" + item.id,
      title: personName(records, item.subject) + " · leave request",
      detail: item.type + " · " + formatDate(item.start),
      meta: "Decide",
      tone: "accent" as const,
      href: href("leave-requests"),
    })),
    ...toReview.map((item) => {
      const assignment = assignments.find(
        (entry) => entry.id === item.assignment,
      );
      return {
        key: item.assignment + item.student,
        title: personName(records, item.student),
        detail: assignment?.title ?? "Assignment",
        meta: "Grade",
        href: href("assignments"),
      };
    }),
  ];

  // Charts: class performance, weekly load and attendance in my sections.
  const performance = liveOrDemo(
    scoreTrend(records, learning, recentMonths(today, 6), {
      allocations: new Set(allocations.map((item) => item.id)),
    }),
    sources.data.chart,
  );
  const allocationIds = new Set(allocations.map((item) => item.id));
  const weeklyLoad = weekdays.slice(1, 6).map((day) => ({
    label: day.slice(0, 3),
    value: records.sessions.filter(
      (session) => session.day === day && allocationIds.has(session.allocation),
    ).length,
  }));
  const mySections = new Set(allocations.map((item) => item.section));
  const classAttendance = attendanceBreakdown(
    records.attendance.filter((item) => mySections.has(item.section)),
  );

  const announcements = visibleAnnouncements(records, "teacher", actor.person)
    .slice(-5)
    .reverse();

  const context = sessions.length
    ? focus
      ? (focus.state === "now" ? "Now teaching " : "Next up: ") +
        focus.subject +
        " with " +
        focus.sectionLabel +
        " at " +
        focus.start +
        " in " +
        focus.room +
        "."
      : "All " + sessions.length + " classes are done for today."
    : "No classes on your timetable today.";
  const todo = [
    attendancePending.length
      ? attendancePending.length +
        " register" +
        (attendancePending.length === 1 ? "" : "s") +
        " to mark"
      : "",
    toReview.length ? toReview.length + " to grade" : "",
  ].filter(Boolean);

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          <>
            {context}
            {todo.length > 0 && <> Still to do: {todo.join(" and ")}.</>}
          </>
        }
        aside={
          <QuickActions
            actions={[
              ...sources.action(
                "attendance",
                "Mark attendance",
                ClipboardCheck,
              ),
              ...sources.action("assignments", "Create assignment", FilePlus2),
              ...sources.action("courses", "Upload material", FileUp),
              ...sources.action("assessments", "Enter marks", PenLine),
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
                : "Free day",
            icon: Presentation,
            href: href("timetable"),
          },
          {
            label: "Attendance pending",
            value: String(attendancePending.length),
            hint: attendancePending.length
              ? attendancePending
                  .map((section) => sectionLabel(records, section))
                  .join(", ")
              : "All registers marked",
            icon: ClipboardCheck,
            href: href("attendance"),
            tone: attendancePending.length ? "attention" : "good",
          },
          {
            label: "To evaluate",
            value: String(toReview.length),
            hint: toReview.length
              ? "Submitted and waiting for a grade"
              : "Nothing waiting",
            icon: NotebookPen,
            href: href("assignments"),
          },
          {
            label: "Upcoming assessments",
            value: String(assessments.length),
            hint: assessments[0]
              ? assessments[0].title +
                " · " +
                relativeDay(assessments[0].date, today)
              : "None scheduled",
            icon: CalendarClock,
            href: href("assessments"),
          },
        ]}
      />
      <DashRow layout="thirds" label="Today">
        <Panel
          title="Today's timetable"
          subtitle={now.toLocaleDateString("en-IN", { weekday: "long" })}
          href={href("timetable")}
          hrefLabel="Full week"
        >
          <Timeline
            sessions={sessions}
            empty="No classes today. A good day to plan lessons."
            hrefFor={(session) =>
              session.state === "now" || session.state === "next"
                ? href("attendance")
                : undefined
            }
          />
        </Panel>
        <Panel
          title="Assignment submissions"
          subtitle="Latest published work"
          href={href("assignments")}
        >
          {submissionProgress.length ? (
            <ProgressList items={submissionProgress} />
          ) : (
            <RowList rows={[]} empty="No published assignments yet." />
          )}
        </Panel>
        <Panel
          title="Syllabus progress"
          subtitle="Topics with study material"
          href={href("courses")}
        >
          {syllabus.length ? (
            <ProgressList items={syllabus} />
          ) : (
            <RowList rows={[]} empty="No subjects assigned this year." />
          )}
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Class insights">
        <Panel
          title="Class performance"
          subtitle="Average score each month"
          href={href("performance")}
          demo={performance.demo}
        >
          {performance.points.length ? (
            <LineChart
              points={performance.points}
              label="Average score across your classes"
            />
          ) : (
            <RowList rows={[]} empty="Scores appear once work is graded." />
          )}
        </Panel>
        <Panel
          title="Weekly teaching load"
          subtitle="Classes on each weekday"
          href={href("timetable")}
        >
          {weeklyLoad.some((item) => item.value) ? (
            <ColumnChart
              label="Classes per weekday"
              unit=""
              items={weeklyLoad}
            />
          ) : (
            <RowList rows={[]} empty="No weekly sessions scheduled." />
          )}
        </Panel>
        <Panel
          title="Class attendance"
          subtitle="Your sections, this year"
          href={href("attendance")}
        >
          {classAttendance.total ? (
            <Donut
              label="Attendance in your sections"
              center={(classAttendance.rate ?? 0) + "%"}
              caption={classAttendance.total + " marks"}
              segments={[
                {
                  label: "Present",
                  value: classAttendance.present,
                  tone: "c1",
                },
                { label: "Late", value: classAttendance.late, tone: "warn" },
                {
                  label: "Absent",
                  value: classAttendance.absent,
                  tone: "danger",
                },
              ]}
            />
          ) : (
            <RowList rows={[]} empty="No registers marked yet." />
          )}
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Needs attention">
        <Panel
          title="Students to support"
          subtitle="Attendance under 75% or average under 50%"
          href={href("performance")}
        >
          <RowList rows={attention} empty="Every student is on track." />
        </Panel>
        <Panel
          title="To review"
          subtitle="Submissions and leave requests"
          href={href("assignments")}
        >
          <RowList rows={reviewRows} empty="You're all caught up." />
        </Panel>
        <Panel title="Upcoming & announcements" href={href("announcements")}>
          <RowList
            rows={[
              ...assessments.slice(0, 2).map((item) => ({
                key: item.key,
                title: item.title,
                detail: item.detail,
                meta: relativeDay(item.date, today),
                lead: <DateToken date={item.date} />,
                href: href("assessments"),
              })),
              ...announcements.slice(0, 3).map((item) => ({
                key: item.id,
                title: item.name,
                detail: item.message,
                href: href("announcements"),
              })),
            ]}
            empty="Nothing new from the school."
          />
        </Panel>
      </DashRow>
    </>
  );
}

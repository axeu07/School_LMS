"use client";

import { useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  ChartLine,
  CreditCard,
  FileText,
  IndianRupee,
  MessageSquareText,
  UserRoundCheck,
} from "lucide-react";
import { visibleAnnouncements } from "@/services/academic-model";
import { activeAllocations, assignmentsFor } from "@/services/assignment-model";
import { bookingsFor, calendarEntries } from "@/services/calendar-model";
import { feeTotals, invoicesFor } from "@/services/fee-model";
import { formatRupees } from "@/services/fee-store";
import { studentSummary, subjectName } from "@/services/insights";
import { testStatus, testsFor } from "@/services/learning-model";
import { absenceAlertsFor, approvedLeaveOn } from "@/services/leave-model";
import { formatDate } from "../format";
import { ColumnChart, Donut, LineChart } from "./charts";
import {
  DashboardIntro,
  DashAlert,
  DashEmpty,
  DashRow,
  DateToken,
  KpiGrid,
  Panel,
  QuickActions,
  RowList,
  Segmented,
  type Row,
} from "./kit";
import {
  attendanceBreakdown,
  average,
  daysUntil,
  greetingFor,
  monthLabel,
  recentMonths,
  relativeDay,
  liveOrDemo,
  scoreTrend,
  subjectScores,
} from "./metrics";
import type { DashboardSources } from "./use-dashboard";

export function ParentDashboard({ sources }: { sources: DashboardSources }) {
  const {
    records,
    learning,
    learningState,
    comm,
    leave,
    fees,
    actor,
    now,
    today,
    href,
    data,
  } = sources;
  const [period, setPeriod] = useState<"3" | "6">("6");
  const [attendanceScope, setAttendanceScope] = useState<"month" | "year">(
    "month",
  );
  const child = data.child;
  const actions = (
    <QuickActions
      actions={[
        ...sources.action("fees", "Pay fees", CreditCard),
        ...sources.action("performance", "Report card", FileText),
        ...sources.action("messages", "Contact teacher", MessageSquareText),
        ...sources.action("calendar", "School calendar", CalendarDays),
      ]}
    />
  );
  if (!child)
    return (
      <>
        <DashboardIntro
          greeting={greetingFor(now) + ", " + sources.firstName}
          date={now}
          context="No children are linked to your account at this school yet."
          aside={actions}
        />
        <DashEmpty>
          Ask the school office to link your child, then their progress will
          appear here.
        </DashEmpty>
      </>
    );

  const firstName = child.name.split(" ")[0];
  const allocations = activeAllocations(records, actor);
  const summary = studentSummary(records, child.id);

  // Performance
  const months = recentMonths(today, Number(period));
  const performance = liveOrDemo(
    scoreTrend(records, learning, recentMonths(today, 6), {
      students: new Set([child.id]),
    }),
    data.chart,
  );
  const trend = performance.points.slice(-months.length);
  const bySubject = subjectScores(records, learning, child.id, allocations);
  const overall = average(bySubject.map((item) => item.value));

  // Attendance
  const childRecords = records.attendance.filter(
    (item) =>
      item.marks[child.id] &&
      (attendanceScope === "year" ||
        item.date.slice(0, 7) === today.slice(0, 7)),
  );
  const breakdown = attendanceBreakdown(childRecords, child.id);

  // Fees
  const invoices = invoicesFor(fees, records, actor);
  const totals = feeTotals(fees, invoices, today);
  const nextDue = totals.summaries
    .filter((item) => item.balance > 0)
    .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due))[0];

  // Exams and tests
  const section = records.sections.find(
    (item) => item.id === summary.enrollment?.section,
  );
  const upcoming = [
    ...learning.exams
      .filter((item) => item.year === section?.year && item.date >= today)
      .map((item) => ({
        key: item.id,
        title: item.name,
        date: item.date,
        detail: "Exam",
      })),
    ...testsFor(learningState, records, actor)
      .filter((test) => {
        const status = testStatus(test, now);
        return status === "Upcoming" || status === "Open";
      })
      .map((test) => ({
        key: test.id,
        title: test.title,
        date:
          testStatus(test, now) === "Open" ? today : test.opens.slice(0, 10),
        detail: "Online test",
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Secondary
  const feedback: Row[] = summary.graded
    .slice()
    .reverse()
    .map((item) => ({
      key: item.assignment.id,
      title: item.subject + " · " + item.marks + "/" + item.assignment.maximum,
      detail: item.feedback || item.assignment.title,
      meta: item.score + "%",
      tone: item.score < 50 ? ("warn" as const) : undefined,
      href: href("performance"),
    }));
  const assignments = assignmentsFor(records, actor);
  const homework: Row[] = assignments
    .filter((item) => item.due >= today)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((item) => {
      const submission = records.submissions.find(
        (entry) => entry.assignment === item.id && entry.student === child.id,
      );
      const done =
        submission?.status === "Submitted" || submission?.status === "Graded";
      return {
        key: item.id,
        title: item.title,
        detail:
          subjectName(
            records,
            allocations.find((entry) => entry.id === item.allocation)
              ?.subject ?? "",
          ) +
          " · due " +
          formatDate(item.due),
        meta: done ? "Submitted" : relativeDay(item.due, today),
        tone: done
          ? ("good" as const)
          : daysUntil(item.due, today) <= 1
            ? ("warn" as const)
            : undefined,
        href: href("homework"),
      };
    });
  const statusOf = (id: string) =>
    records.submissions.find(
      (entry) => entry.assignment === id && entry.student === child.id,
    )?.status;
  const homeworkStatus = {
    total: assignments.length,
    graded: assignments.filter((item) => statusOf(item.id) === "Graded").length,
    submitted: assignments.filter((item) => statusOf(item.id) === "Submitted")
      .length,
    pending: assignments.filter(
      (item) =>
        statusOf(item.id) !== "Graded" && statusOf(item.id) !== "Submitted",
    ).length,
    done: 0,
  };
  homeworkStatus.done = homeworkStatus.graded + homeworkStatus.submitted;
  const ptmSlots = comm.schools[actor.school]?.ptmSlots ?? [];
  const meetings: Row[] = bookingsFor(comm, actor).flatMap((booking) => {
    const slot = ptmSlots.find((item) => item.id === booking.slotId);
    if (booking.status !== "Confirmed" || !slot || slot.date < today) return [];
    return [
      {
        key: booking.id,
        title:
          "Parent–teacher meeting · " +
          (records.teachers.find((item) => item.id === booking.teacherId)
            ?.name ?? "Teacher"),
        detail: slot.start + "–" + slot.end,
        meta: relativeDay(slot.date, today),
        tone: "accent" as const,
        lead: <DateToken date={slot.date} />,
        href: href("calendar") + "?tab=ptm",
      },
    ];
  });
  const events: Row[] = calendarEntries(
    comm,
    learningState,
    records,
    actor,
    leave,
  )
    .filter(
      (item) =>
        item.source === "event" &&
        item.category !== "ptm" &&
        item.status === "Published" &&
        item.endDate >= today,
    )
    .map((item) => ({
      key: item.key,
      title: item.title,
      detail: item.description || "School event",
      meta:
        item.startDate < today ? "Ongoing" : relativeDay(item.startDate, today),
      lead: <DateToken date={item.startDate} />,
      href: href("calendar"),
    }));
  const notices: Row[] = visibleAnnouncements(
    records,
    "parent",
    actor.person,
    child.id,
  )
    .slice(-2)
    .reverse()
    .map((item) => ({
      key: item.id,
      title: item.name,
      detail: item.message,
      href: href("announcements"),
    }));

  // Unexplained absences are the one alert worth a banner.
  const absences = absenceAlertsFor(leave, records, actor, child.id).filter(
    (item) =>
      item.state === "Active" &&
      !!item.date &&
      !approvedLeaveOn(leave, "student", child.id, item.date),
  );

  const context = [
    summary.attendance !== undefined
      ? firstName + "'s attendance is " + summary.attendance + "%"
      : "",
    upcoming[0]
      ? "next up is " +
        upcoming[0].title +
        " (" +
        relativeDay(upcoming[0].date, today).toLowerCase() +
        ")"
      : "",
  ].filter(Boolean);

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          context.length
            ? context.join(", and ") + "."
            : "Here's how " + firstName + " is doing."
        }
        aside={
          <>
            <ChildCard
              name={child.name}
              detail={summary.section ?? "No current class"}
              others={data.children.filter((item) => item.id !== child.id)}
              onSwitch={sources.setChild}
            />
            {actions}
          </>
        }
      />
      {absences[0] && (
        <DashAlert href={href("leave-requests")} action="Explain absence">
          {firstName} was marked absent on {formatDate(absences[0].date!)}
          {absences.length > 1
            ? " and " +
              (absences.length - 1) +
              " other day" +
              (absences.length > 2 ? "s" : "")
            : ""}{" "}
          without a leave request.
        </DashAlert>
      )}
      <KpiGrid
        items={[
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
            icon: UserRoundCheck,
            ring: summary.attendance,
            href: href("attendance"),
            tone:
              summary.attendance !== undefined && summary.attendance < 75
                ? "attention"
                : undefined,
          },
          {
            label: "Academic performance",
            value: overall === undefined ? "—" : overall + "%",
            hint:
              overall === undefined
                ? "No graded work yet"
                : "Average across " +
                  bySubject.length +
                  (bySubject.length === 1 ? " subject" : " subjects"),
            icon: ChartLine,
            trend: trend.map((item) => item.value),
            href: href("performance"),
          },
          {
            label: "Pending fees",
            value: formatRupees(totals.outstanding),
            hint: nextDue
              ? (nextDue.status === "Overdue"
                  ? "Overdue since "
                  : "Next due ") + formatDate(nextDue.invoice.due)
              : "All fees paid",
            icon: IndianRupee,
            href: href("fees"),
            tone:
              totals.overdue > 0
                ? "attention"
                : totals.outstanding
                  ? undefined
                  : "good",
          },
          {
            label: "Upcoming exams",
            value: String(upcoming.length),
            hint: upcoming[0]
              ? upcoming[0].title + " · " + relativeDay(upcoming[0].date, today)
              : "Nothing scheduled",
            icon: CalendarCheck2,
            href: href("assessments"),
          },
        ]}
      />
      <DashRow layout="thirds" label="Progress">
        <Panel
          title="Performance trend"
          demo={performance.demo}
          subtitle="Average score each month"
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
            <LineChart
              points={trend}
              label={firstName + "'s average score by month"}
            />
          ) : (
            <DashEmpty>Scores appear here once work is graded.</DashEmpty>
          )}
        </Panel>
        <Panel
          title="By subject"
          subtitle="Average score"
          href={href("performance")}
        >
          {bySubject.length ? (
            <ColumnChart
              label="Average score by subject"
              items={bySubject.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
              threshold={50}
            />
          ) : (
            <DashEmpty>No subject scores yet.</DashEmpty>
          )}
        </Panel>
        <Panel
          title="Attendance"
          subtitle={
            attendanceScope === "month"
              ? monthLabel(today) + " " + today.slice(0, 4)
              : "This academic year"
          }
          action={
            <Segmented
              label="Attendance period"
              value={attendanceScope}
              onChange={setAttendanceScope}
              options={[
                { value: "month", label: "Month" },
                { value: "year", label: "Year" },
              ]}
            />
          }
        >
          {breakdown.total ? (
            <Donut
              label="Attendance breakdown"
              center={(breakdown.rate ?? 0) + "%"}
              caption={breakdown.total + " days"}
              segments={[
                { label: "Present", value: breakdown.present, tone: "c1" },
                { label: "Late", value: breakdown.late, tone: "warn" },
                { label: "Absent", value: breakdown.absent, tone: "danger" },
              ]}
            />
          ) : (
            <DashEmpty>No attendance recorded for this period.</DashEmpty>
          )}
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Updates">
        <Panel title="Teacher feedback" href={href("performance")}>
          <RowList rows={feedback} limit={4} empty="No feedback yet." />
        </Panel>
        <Panel title="Homework" href={href("homework")}>
          {homeworkStatus.total ? (
            <>
              <Donut
                label="Homework status"
                size={108}
                center={homeworkStatus.done + "/" + homeworkStatus.total}
                caption="handed in"
                segments={[
                  { label: "Graded", value: homeworkStatus.graded, tone: "c1" },
                  {
                    label: "Submitted",
                    value: homeworkStatus.submitted,
                    tone: "c2",
                  },
                  {
                    label: "Pending",
                    value: homeworkStatus.pending,
                    tone: "muted",
                  },
                ]}
              />
              <div className="db-gap" />
              <RowList rows={homework} limit={2} empty="No homework due." />
            </>
          ) : (
            <RowList rows={homework} limit={4} empty="No homework due." />
          )}
        </Panel>
        <Panel title="Coming up" href={href("calendar")}>
          <RowList
            rows={[...meetings, ...events, ...notices]}
            limit={4}
            empty="Nothing scheduled."
          />
        </Panel>
      </DashRow>
    </>
  );
}

function ChildCard({
  name,
  detail,
  others,
  onSwitch,
}: {
  name: string;
  detail: string;
  others: { id: string; name: string }[];
  onSwitch: (id: string) => void;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="db-child">
      <span className="db-avatar" aria-hidden="true">
        {initials}
      </span>
      <span className="db-child-copy">
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
      {others.map((item) => (
        <button
          key={item.id}
          type="button"
          className="db-child-switch"
          onClick={() => onSwitch(item.id)}
        >
          Switch to {item.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChartNoAxesColumn,
  IndianRupee,
  Megaphone,
  UserPlus,
  UserRoundCheck,
  Users,
  UsersRound,
  UserCog,
} from "lucide-react";
import { calendarEntries } from "@/services/calendar-model";
import { feeTotals } from "@/services/fee-model";
import { formatRupees } from "@/services/fee-store";
import { sectionLabel, sectionSummary } from "@/services/insights";
import { leaveAnalytics, pendingApprovals } from "@/services/leave-model";
import { markingProgress } from "@/services/results-model";
import { formatDate } from "../format";
import { ColumnChart, Donut, LineChart } from "./charts";
import {
  DashboardIntro,
  DashEmpty,
  DashRow,
  DateToken,
  KpiGrid,
  Panel,
  QuickActions,
  RowList,
  type Row,
} from "./kit";
import {
  attendanceBreakdown,
  daysUntil,
  examAverage,
  greetingFor,
  liveOrDemo,
  monthLabel,
  recentMonths,
  relativeDay,
  scoreTrend,
} from "./metrics";
import type { DashboardSources } from "./use-dashboard";

const compactRupees = (value: number) =>
  value >= 100_000
    ? "₹" + Math.round(value / 10_000) / 10 + "L"
    : value >= 1000
      ? "₹" + Math.round(value / 100) / 10 + "K"
      : "₹" + value;

export function SchoolAdminDashboard({
  sources,
}: {
  sources: DashboardSources;
}) {
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
  } = sources;
  const years = records.years.filter((item) => item.status !== "Archived");
  const activeYear = records.years.find((item) => item.status === "Active");
  const [yearChoice, setYear] = useState(activeYear?.id ?? years[0]?.id ?? "");
  const year =
    records.years.find((item) => item.id === yearChoice) ?? activeYear;
  const isActiveYear = year?.id === activeYear?.id;

  const sections = records.sections.filter(
    (item) => item.year === year?.id && item.status !== "Archived",
  );
  const sectionIds = new Set(sections.map((item) => item.id));
  const enrolments = records.enrollments.filter(
    (item) => item.status === "Enrolled" && sectionIds.has(item.section),
  );
  const capacity = sections.reduce(
    (sum, item) => sum + Number(item.capacity || 0),
    0,
  );
  const teachers = records.teachers.filter((item) => item.status === "Active");
  const staffLeave = leaveAnalytics(leave, records, today).teachers.filter(
    (item) => item.status === "On leave today",
  ).length;

  // Attendance: today's registers, or the latest school day on record.
  const yearAttendance = records.attendance.filter(
    (item) => sectionIds.has(item.section) && item.date <= today,
  );
  const lastDay = yearAttendance.reduce(
    (latest, item) => (item.date > latest ? item.date : latest),
    "",
  );
  const dayBreakdown = attendanceBreakdown(
    yearAttendance.filter((item) => item.date === lastDay),
  );

  // Fees billed against this session's fee structure.
  const feeIds = new Set(
    fees.structure
      .filter((item) => item.year === year?.id)
      .map((item) => item.id),
  );
  const totals = feeTotals(
    fees,
    fees.invoices.filter((item) => feeIds.has(item.fee)),
    today,
  );
  const invoiceIds = new Set(totals.summaries.map((item) => item.invoice.id));
  const payments = fees.payments
    .filter((item) => invoiceIds.has(item.invoice))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const collectedToday = payments
    .filter((item) => item.paidOn === today)
    .reduce((sum, item) => sum + item.amount, 0);

  // Class-by-class view: enrolment, attendance and academic standing.
  const classes = sections.map((section) => {
    const summary = sectionSummary(records, section.id);
    const roster = new Set(summary.roster.map((item) => item.id));
    const exam = examAverage(learning, roster);
    const average =
      summary.average !== undefined && exam !== undefined
        ? Math.round((summary.average + exam) / 2)
        : (summary.average ?? exam);
    return {
      id: section.id,
      label: sectionLabel(records, section.id),
      students: summary.roster.length,
      capacity: summary.capacity,
      attendance: summary.attendance,
      average,
    };
  });
  const average = (() => {
    const values = classes.flatMap((item) =>
      item.average === undefined ? [] : [item.average],
    );
    return values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        )
      : undefined;
  })();

  // Approvals and alerts: only what genuinely needs action.
  const leaveApprovals = pendingApprovals(leave, records, actor);
  const proposed = (comm.schools[actor.school]?.events ?? []).filter(
    (item) => item.status === "Proposed" && item.endDate >= today,
  );
  const overdue = totals.summaries.filter((item) => item.status === "Overdue");
  const marking = learning.exams
    .filter(
      (exam) =>
        exam.year === year?.id &&
        !exam.published &&
        daysUntil(exam.date, today) <= 7,
    )
    .flatMap((exam) => {
      const progress = markingProgress(learning, records, exam.id);
      return progress.total && progress.done < progress.total
        ? [{ exam, progress }]
        : [];
    });
  const lowAttendance = classes.filter(
    (item) => item.attendance !== undefined && item.attendance < 85,
  );
  const attention: Row[] = [
    ...(leaveApprovals.length
      ? [
          {
            key: "leave",
            title:
              leaveApprovals.length +
              " leave request" +
              (leaveApprovals.length === 1 ? "" : "s") +
              " awaiting approval",
            detail: "Escalated student leave and staff leave",
            meta: "Review",
            tone: "accent" as const,
            href: href("leave-management"),
          },
        ]
      : []),
    ...proposed.map((item) => ({
      key: "event-" + item.id,
      title: item.title,
      detail: "Event proposed · " + formatDate(item.startDate),
      meta: "Approve",
      tone: "accent" as const,
      href: href("calendar"),
    })),
    ...(overdue.length
      ? [
          {
            key: "overdue",
            title:
              overdue.length +
              " overdue fee invoice" +
              (overdue.length === 1 ? "" : "s"),
            detail: formatRupees(totals.overdue) + " past the due date",
            meta: "Remind",
            tone: "danger" as const,
            href: href("fees"),
          },
        ]
      : []),
    ...marking.map(({ exam, progress }) => ({
      key: "marks-" + exam.id,
      title: exam.name + " · marks entry",
      detail: progress.done + " of " + progress.total + " mark sheets complete",
      meta: relativeDay(exam.date, today),
      tone: "warn" as const,
      href: href("results"),
    })),
    ...lowAttendance.map((item) => ({
      key: "att-" + item.id,
      title: item.label + " attendance at " + item.attendance + "%",
      detail: "Below the 85% school target",
      tone: "warn" as const,
      href: href("attendance"),
    })),
  ];

  const admissions: Row[] = enrolments
    .slice(-5)
    .reverse()
    .map((item) => ({
      key: item.id,
      title:
        records.students.find((entry) => entry.id === item.student)?.name ??
        "Student",
      detail: sectionLabel(records, item.section),
      href: href("students"),
    }));

  const events: Row[] = calendarEntries(
    comm,
    learningState,
    records,
    actor,
    leave,
  )
    .filter(
      (item) =>
        item.status === "Published" &&
        item.endDate >= today &&
        (item.source === "event" || item.source === "exam"),
    )
    .map((item) => ({
      key: item.key,
      title: item.title,
      detail: item.description || item.category,
      meta:
        item.startDate < today ? "Ongoing" : relativeDay(item.startDate, today),
      lead: <DateToken date={item.startDate} />,
      href: href("calendar"),
    }));

  // Charts: academic trend, monthly collections and class attendance.
  const months = recentMonths(today, 6);
  const performance = liveOrDemo(
    scoreTrend(records, learning, months, {
      students: new Set(enrolments.map((item) => item.student)),
    }),
    sources.data.chart,
  );
  const collections = months.map((month) => ({
    label: monthLabel(month),
    value: payments
      .filter((item) => item.paidOn.slice(0, 7) === month)
      .reduce((sum, item) => sum + item.amount, 0),
    note: "collected",
  }));
  const classAttendance = classes.flatMap((item) =>
    item.attendance === undefined
      ? []
      : [{ label: item.label, value: item.attendance }],
  );

  const pendingCount = leaveApprovals.length + proposed.length;

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          <>
            {enrolments.length} students across {sections.length} classes
            {lastDay
              ? ", " +
                (dayBreakdown.rate ?? 0) +
                "% attendance " +
                (lastDay === today ? "today" : "on " + formatDate(lastDay))
              : ""}
            .{" "}
            {attention.length
              ? attention.length +
                (attention.length === 1 ? " item needs" : " items need") +
                " your attention."
              : "Nothing needs your attention."}
          </>
        }
        aside={
          <>
            {years.length > 1 && (
              <label className="db-select">
                <span>Session</span>
                <select
                  value={year?.id}
                  onChange={(event) => setYear(event.target.value)}
                >
                  {years.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.status === "Active" ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <QuickActions
              actions={[
                ...sources.action("students", "Add student", UserPlus),
                ...sources.action("teachers", "Add staff", UserCog),
                ...sources.action("announcements", "Publish notice", Megaphone),
                ...sources.action("performance", "Reports", ChartNoAxesColumn),
              ]}
            />
          </>
        }
      />
      <KpiGrid
        items={[
          {
            label: "Active students",
            value: String(enrolments.length),
            hint: capacity
              ? Math.max(0, capacity - enrolments.length) +
                " seats open in " +
                sections.length +
                " classes"
              : sections.length + " classes",
            icon: Users,
            href: href("students"),
          },
          {
            label: "Teaching staff",
            value: String(teachers.length),
            hint:
              isActiveYear && staffLeave
                ? staffLeave + " on leave today"
                : "Active faculty",
            icon: UsersRound,
            href: href("teachers"),
          },
          {
            label: lastDay === today ? "Today's attendance" : "Attendance",
            value:
              dayBreakdown.rate === undefined ? "—" : dayBreakdown.rate + "%",
            hint: lastDay
              ? lastDay === today
                ? dayBreakdown.absent + " absent today"
                : "Last recorded " + formatDate(lastDay)
              : "No registers yet",
            icon: UserRoundCheck,
            ring: dayBreakdown.rate,
            href: href("attendance"),
          },
          {
            label: "Fee collection",
            value: totals.rate === undefined ? "—" : totals.rate + "%",
            hint: totals.billed
              ? formatRupees(totals.collected) +
                " of " +
                formatRupees(totals.billed)
              : "No invoices this session",
            icon: IndianRupee,
            ring: totals.rate,
            href: href("fees"),
          },
        ]}
      />
      <DashRow layout="wide-left" label="School health">
        <Panel
          title="Classes at a glance"
          subtitle={
            "Enrolment, attendance and average score" +
            (average !== undefined ? " · school average " + average + "%" : "")
          }
          href={href("performance")}
          hrefLabel="Analytics"
        >
          {classes.length ? (
            <ClassTable rows={classes} href={href("classes")} />
          ) : (
            <DashEmpty>No classes in this session.</DashEmpty>
          )}
        </Panel>
        <Panel title="Fee collection" subtitle={year?.name} href={href("fees")}>
          {totals.billed ? (
            <>
              <Donut
                label="Fee collection"
                center={(totals.rate ?? 0) + "%"}
                caption="collected"
                segments={[
                  {
                    label: "Collected",
                    value: totals.collected,
                    display: formatRupees(totals.collected),
                    tone: "c1",
                  },
                  {
                    label: "Due",
                    value: totals.outstanding - totals.overdue,
                    display: formatRupees(totals.outstanding - totals.overdue),
                    tone: "muted",
                  },
                  {
                    label: "Overdue",
                    value: totals.overdue,
                    display: formatRupees(totals.overdue),
                    tone: "danger",
                  },
                ]}
              />
              <p className="db-footnote">
                {collectedToday
                  ? formatRupees(collectedToday) + " collected today"
                  : payments[0]
                    ? "Last payment " +
                      formatRupees(payments[0].amount) +
                      " · " +
                      formatDate(payments[0].paidOn)
                    : "No payments recorded yet"}
              </p>
            </>
          ) : (
            <DashEmpty>No fee invoices for this session yet.</DashEmpty>
          )}
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Trends">
        <Panel
          title="Academic performance"
          subtitle="School average score each month"
          href={href("performance")}
          demo={performance.demo}
        >
          {performance.points.length ? (
            <LineChart
              points={performance.points}
              label="School average score by month"
            />
          ) : (
            <DashEmpty>Scores appear once work is graded.</DashEmpty>
          )}
        </Panel>
        <Panel
          title="Monthly collection"
          subtitle="Fee payments received"
          href={href("fees")}
        >
          {collections.some((item) => item.value) ? (
            <ColumnChart
              label="Fees collected by month"
              unit=""
              format={compactRupees}
              items={collections}
            />
          ) : (
            <DashEmpty>No payments in the last six months.</DashEmpty>
          )}
        </Panel>
        <Panel
          title="Attendance by class"
          subtitle="This session · target 85%"
          href={href("attendance")}
        >
          {classAttendance.length ? (
            <ColumnChart
              label="Attendance by class"
              items={classAttendance}
              threshold={85}
            />
          ) : (
            <DashEmpty>No registers marked yet.</DashEmpty>
          )}
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Activity">
        <Panel
          title="Needs attention"
          subtitle={
            pendingCount ? pendingCount + " pending approvals" : undefined
          }
        >
          <RowList
            rows={attention}
            empty="All clear. Nothing is waiting on you."
          />
        </Panel>
        <Panel title="Recent admissions" href={href("students")}>
          <RowList rows={admissions} empty="No enrolments in this session." />
        </Panel>
        <Panel title="Upcoming events" href={href("calendar")}>
          <RowList rows={events} limit={4} empty="Nothing on the calendar." />
        </Panel>
      </DashRow>
    </>
  );
}

function ClassTable({
  rows,
  href,
}: {
  rows: {
    id: string;
    label: string;
    students: number;
    capacity: number;
    attendance: number | undefined;
    average: number | undefined;
  }[];
  href: string;
}) {
  const shown = rows.slice(0, 6);
  return (
    <>
      <table className="db-table">
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Enrolment</th>
            <th scope="col">Attendance</th>
            <th scope="col">Avg score</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>
                <span className="db-cell-bar">
                  <span className="db-bar" aria-hidden="true">
                    <span
                      style={{
                        width:
                          (row.capacity
                            ? Math.min(100, (100 * row.students) / row.capacity)
                            : 0) + "%",
                      }}
                    />
                  </span>
                  <span>
                    {row.students}
                    {row.capacity ? <small>/{row.capacity}</small> : null}
                  </span>
                </span>
              </td>
              <td
                data-low={
                  row.attendance !== undefined && row.attendance < 85
                    ? true
                    : undefined
                }
              >
                {row.attendance === undefined ? "—" : row.attendance + "%"}
              </td>
              <td
                data-low={
                  row.average !== undefined && row.average < 50
                    ? true
                    : undefined
                }
              >
                {row.average === undefined ? "—" : row.average + "%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <Link className="db-link db-more" href={href}>
          {rows.length - shown.length} more classes
        </Link>
      )}
    </>
  );
}

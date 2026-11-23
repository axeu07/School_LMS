"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { doubtsFor } from "@/services/doubt-model";
import { useDoubtState } from "@/services/doubt-store";
import { sectionLabel, subjectName } from "@/services/insights";
import { learnerFor, testStatus, testsFor } from "@/services/learning-model";
import { useLearningState, useNow } from "@/services/learning-store";
import { examsFor } from "@/services/results-model";
import { localCalendarDate } from "@/services/assignment-model";
import { feeTotals, invoicesFor } from "@/services/fee-model";
import { formatRupees, useFeeState } from "@/services/fee-store";
import type { DemoPanel, DemoRole, DemoRow } from "@/types/demo";
import { formatDate, formatDateTime } from "./format";
import { useDemo } from "./demo-context";
import {
  DataTable,
  EmptyState,
  StatCards,
  TrendChart,
} from "./dashboard-widgets";
import { findNavItem, roleHref } from "./navigation";
import { PageHeader } from "./page-header";
import { LeaveDashboardWidget } from "./leave/leave-widgets";
import {
  bookingsFor,
  calendarEntries,
  entryLabels,
} from "@/services/calendar-model";
import { useCommunicationState } from "@/services/communication-store";
import {
  communicationStats,
  conversationsFor,
} from "@/services/messaging-model";
import { useLeaveSchool } from "@/services/leave-store";

/** Dashboard panel id → the page that holds its full module. */
const panelLinks: Record<DemoRole, Record<string, string>> = {
  "super-admin": {
    schools: "schools",
    subscriptions: "subscriptions",
    activity: "analytics",
  },
  "school-admin": {
    announcements: "announcements",
    marketing: "marketing",
  },
  teacher: {
    schedule: "timetable",
    classes: "classes",
    assignments: "assignments",
    doubts: "doubt-board",
    assessments: "assessments",
    announcements: "announcements",
  },
  student: {
    schedule: "timetable",
    homework: "assignments",
    quizzes: "quizzes",
    announcements: "announcements",
    "assignment-results": "progress",
  },
  parent: {
    children: "children",
    exams: "assessments",
    announcements: "announcements",
    "assignment-results": "performance",
  },
};

const quickActions: Record<DemoRole, string[]> = {
  "super-admin": ["schools", "analytics", "subscriptions", "branding"],
  "school-admin": ["announcements", "calendar", "messages", "fees"],
  teacher: ["attendance", "calendar", "messages", "assessments"],
  student: ["assignments", "calendar", "quizzes", "progress"],
  parent: ["calendar", "messages", "homework", "fees"],
};

const testPanels: Record<string, string> = {
  assessments: "Online tests",
  quizzes: "Online tests",
  exams: "Tests and exams",
};

export function RoleOverview() {
  const { role, profile, data, records, actor, scopeKey } = useDemo();
  const doubtState = useDoubtState();
  const learningState = useLearningState();
  const learning = learningState.schools[actor.school];
  const fees = useFeeState().schools[actor.school];
  const comm = useCommunicationState();
  const leave = useLeaveSchool(actor.school);
  const now = useNow(60_000);
  const student = learnerFor(records, actor);
  const testRows: DemoRow[] = now
    ? [
        ...testsFor(learningState, records, actor).flatMap((test) => {
          const status = testStatus(test, now);
          if (status === "Closed") return [];
          const subject = subjectName(
            records,
            records.allocations.find((item) => item.id === test.allocation)
              ?.subject ?? "",
          );
          return [
            {
              title: test.title,
              detail:
                subject +
                " · " +
                (status === "Open"
                  ? "closes " + formatDateTime(test.closes)
                  : "opens " + formatDateTime(test.opens)),
              meta: status,
            },
          ];
        }),
        ...(role === "parent" && student
          ? examsFor(learning, records, actor, student)
              .filter((exam) => !exam.published)
              .map((exam) => ({
                title: exam.name,
                detail: "Exam · " + formatDate(exam.date),
                meta: "Exam",
              }))
          : []),
      ]
    : [];
  const stats = data.stats.map((stat) =>
    stat.label === "Upcoming quizzes" || stat.label === "Upcoming assessments"
      ? {
          ...stat,
          label: "Open and upcoming tests",
          value: now ? String(testRows.length) : "—",
          note: "Online tests for your classes",
        }
      : stat,
  );
  const panels: DemoPanel[] = data.panels
    .filter((panel) => panel.id !== "school-context")
    .map((panel) =>
      testPanels[panel.id]
        ? { ...panel, title: testPanels[panel.id], rows: testRows }
        : panel.id === "doubts"
          ? {
              ...panel,
              title: "Top unanswered doubts",
              rows: doubtsFor(doubtState, records, actor)
                .filter((item) => item.status === "Open")
                .map((item) => ({
                  title: item.text,
                  detail:
                    subjectName(records, item.subject) +
                    " · " +
                    sectionLabel(records, item.section),
                  meta:
                    item.voteCount +
                    (item.voteCount === 1 ? " upvote" : " upvotes"),
                })),
            }
          : panel,
    );
  if ((role === "school-admin" || role === "parent") && now) {
    const today = localCalendarDate(now);
    const invoices = invoicesFor(fees, records, actor);
    const dues = feeTotals(fees, invoices, today)
      .summaries.filter((item) => item.balance > 0)
      .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due));
    panels.push({
      id: "fee-dues",
      title: role === "parent" ? "Fees due" : "Fee dues",
      description:
        formatRupees(dues.reduce((sum, item) => sum + item.balance, 0)) +
        " outstanding",
      rows: dues.map(({ invoice, balance, status }) => ({
        title:
          role === "parent"
            ? (fees.structure.find((item) => item.id === invoice.fee)?.name ??
              invoice.number)
            : (records.students.find((item) => item.id === invoice.student)
                ?.name ?? invoice.number),
        detail: invoice.number + " · due " + formatDate(invoice.due),
        meta: formatRupees(balance) + " · " + status,
      })),
    });
  }
  if (role !== "super-admin" && now && (role !== "parent" || data.child)) {
    const today = localCalendarDate(now);
    const entries = calendarEntries(comm, learningState, records, actor, leave);
    const upcoming = entries.filter(
      (item) =>
        item.endDate >= today &&
        (item.status === "Published" || item.status === "Proposed"),
    );
    panels.push({
      id: "calendar",
      title: "Upcoming events",
      description: "From the school calendar",
      rows: upcoming.map((item) => ({
        title: item.title,
        detail:
          entryLabels[item.category] +
          (item.allDay ? "" : " · " + item.startTime) +
          (item.status === "Proposed" ? " · awaiting approval" : ""),
        meta: formatDate(item.startDate),
      })),
    });
    if (role === "parent" || role === "teacher") {
      const school = comm.schools[actor.school];
      const meetings = bookingsFor(comm, actor).flatMap((booking) => {
        const slot = school?.ptmSlots.find(
          (item) => item.id === booking.slotId,
        );
        if (booking.status !== "Confirmed" || !slot || slot.date < today)
          return [];
        return [
          {
            title:
              role === "parent"
                ? (records.teachers.find(
                    (item) => item.id === booking.teacherId,
                  )?.name ?? "Teacher")
                : (records.students.find(
                    (item) => item.id === booking.studentId,
                  )?.name ?? "Student"),
            detail: slot.start + "–" + slot.end,
            meta: formatDate(slot.date),
          },
        ];
      });
      panels.push({
        id: "ptm",
        title: "PTM appointments",
        description: meetings.length + " upcoming",
        rows: meetings,
      });
      const conversations = conversationsFor(comm, records, actor);
      const unread = conversations.reduce((sum, item) => sum + item.unread, 0);
      panels.push({
        id: "messages",
        title: "Messages",
        description:
          unread + (unread === 1 ? " unread message" : " unread messages"),
        rows: conversations
          .filter((item) => item.unread)
          .map((item) => ({
            title: item.title,
            detail:
              role === "parent"
                ? (records.teachers.find((entry) => entry.id === item.teacherId)
                    ?.name ?? "Teacher")
                : (records.guardians.find((entry) => entry.id === item.parentId)
                    ?.name ?? "Parent"),
            meta: item.unread + " unread",
          })),
      });
    }
    if (role === "school-admin") {
      const stats = communicationStats(comm, records, actor);
      panels.push({
        id: "messages",
        title: "Communication",
        description: "Teacher–parent messaging, counts only",
        rows: [
          {
            title: "Open conversations",
            detail: stats.total + " in total",
            meta: String(stats.open),
          },
          {
            title: "Awaiting a teacher reply",
            detail: "Last message from a parent",
            meta: String(stats.awaitingReply),
          },
          {
            title: "Unread messages",
            detail: "Across all conversations",
            meta: String(stats.unreadMessages),
          },
        ],
      });
    }
  }
  const link = (id: string) =>
    id === "calendar"
      ? roleHref(role, "calendar")
      : id === "ptm"
        ? roleHref(role, "calendar") + "?tab=ptm"
        : id === "messages"
          ? roleHref(role, "messages")
          : id === "fee-dues"
            ? roleHref(role, "fees")
            : panelLinks[role][id]
              ? roleHref(role, panelLinks[role][id])
              : undefined;
  const [first, ...rest] = panels;

  return (
    <>
      <PageHeader
        title={profile.label + " dashboard"}
        description={profile.focus}
      />
      {role === "parent" && !data.child && (
        <EmptyState>
          No children are linked to this parent in the selected school.
        </EmptyState>
      )}
      <StatCards stats={stats} />
      <LeaveDashboardWidget />
      <div className="dashboard-grid feature-grid">
        <TrendChart key={scopeKey} chart={data.chart} sample />
        {first && <DataTable panel={first} href={link(first.id)} limit={5} />}
      </div>
      <section className="quick-actions" aria-labelledby="quick-title">
        <h2 id="quick-title">Quick actions</h2>
        <div className="action-grid">
          {quickActions[role].map((slug) => {
            const entry = findNavItem(role, slug);
            if (!entry) return null;
            const Icon = entry.icon;
            return (
              <Link
                key={slug}
                href={roleHref(role, slug)}
                className="action-card"
              >
                <span className="stat-icon tint-0">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{entry.description}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
      <div className="dashboard-grid">
        {rest.map((panel) => (
          <DataTable
            key={panel.id}
            panel={panel}
            href={link(panel.id)}
            limit={4}
          />
        ))}
      </div>
      {data.courses.length > 0 && (
        <section className="course-section" aria-labelledby="course-title">
          <div className="section-heading-row">
            <h2 id="course-title">Course progress</h2>
            <span className="pill pill-preview">Sample data</span>
          </div>
          <div className="course-grid">
            {data.courses.map(({ title, progress }) => (
              <Card key={title} className="dash-card">
                <div className="course-heading">
                  <h3>{title}</h3>
                  <strong>{progress}%</strong>
                </div>
                <progress
                  aria-label={title + " progress"}
                  value={progress}
                  max={100}
                />
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

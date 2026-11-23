"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarOff,
  CalendarPlus,
  ClipboardCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { localCalendarDate } from "@/services/assignment-model";
import { subjectName } from "@/services/insights";
import { formatDate } from "../format";
import {
  absenceAlertsFor,
  affectedSessions,
  sectionTitle,
  approvedLeaveOn,
  formatRange,
  leaveAnalytics,
  leaveRequestsFor,
  leaveSchool,
  pendingApprovals,
  pendingStatuses,
  personName,
} from "@/services/leave-model";
import { useLeaveState } from "@/services/leave-store";
import type { DemoRole } from "@/types/demo";
import { useDemo } from "../demo-context";
import { roleHref } from "../navigation";
import { LeaveStatusBadge } from "./leave-ui";

/** The leave page for each role. */
export const leaveSlug: Partial<Record<DemoRole, string>> = {
  student: "leave-requests",
  parent: "leave-requests",
  teacher: "leave-requests",
  "school-admin": "leave-management",
};

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className={"leave-figure" + (tone ? " tone-" + tone : "")}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/** Dashboard summary card linking to the role's leave page. */
export function LeaveDashboardWidget() {
  const { role, records, actor, data } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const slug = leaveSlug[role];
  if (!slug) return null;
  const href = roleHref(role, slug);
  const today = localCalendarDate();

  let title = "Leave requests";
  let description = "";
  let figures: [string, number | string, string?][] = [];
  let latest: React.ReactNode = null;
  const actions: React.ReactNode[] = [];

  if (role === "student" || role === "parent") {
    const student = role === "parent" ? data.child?.id : actor.person;
    if (!student) return null;
    const requests = leaveRequestsFor(leave, records, {
      ...actor,
      child: student,
    });
    const alerts =
      role === "parent"
        ? absenceAlertsFor(leave, records, actor, student).filter(
            (item) =>
              item.state === "Active" &&
              !approvedLeaveOn(leave, "student", student, item.date!),
          )
        : [];
    title = role === "parent" ? "Child leave & absences" : "My leave";
    description =
      role === "parent"
        ? personName(records, student) + "'s leave requests and absence alerts."
        : "Your leave requests and their status.";
    figures = [
      [
        "Pending",
        requests.filter((item) => pendingStatuses.includes(item.status)).length,
        "warning",
      ],
      [
        "Approved",
        requests.filter((item) => item.status === "Approved").length,
        "success",
      ],
      [
        "Rejected",
        requests.filter((item) => item.status === "Rejected").length,
        "danger",
      ],
    ];
    if (role === "parent")
      figures.push([
        "Absence alerts",
        alerts.length,
        alerts.length ? "danger" : undefined,
      ]);
    const alert = alerts[0];
    const request = requests[0];
    latest = alert ? (
      <p className="leave-widget-alert">
        <BellRing size={16} aria-hidden="true" />
        {alert.message}
      </p>
    ) : request ? (
      <p className="leave-widget-latest">
        Latest: {request.type} · {formatRange(request)}{" "}
        <LeaveStatusBadge status={request.status} />
      </p>
    ) : null;
    actions.push(
      <Link
        key="apply"
        className="button button-primary button-sm"
        href={href + "?apply=1"}
      >
        <CalendarPlus size={15} aria-hidden="true" />
        Apply for Leave
      </Link>,
    );
    if (role === "parent")
      actions.push(
        <Link
          key="attendance"
          className="button button-outline button-sm"
          href={roleHref(role, "attendance")}
        >
          <ClipboardCheck size={15} aria-hidden="true" />
          View attendance
        </Link>,
      );
  } else if (role === "teacher") {
    const pending = pendingApprovals(leave, records, actor);
    const mine = leaveRequestsFor(leave, records, actor);
    const next = mine
      .filter((item) => item.status === "Approved" && item.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    title = "Leave requests";
    description = "Student leave awaiting you, and your own leave.";
    figures = [
      [
        "Awaiting your review",
        pending.length,
        pending.length ? "warning" : undefined,
      ],
      [
        "My pending leave",
        mine.filter((item) => item.status === "Pending Admin").length,
      ],
      [
        "My approved leave",
        mine.filter((item) => item.status === "Approved").length,
        "success",
      ],
    ];
    latest = pending[0] ? (
      <p className="leave-widget-latest">
        Next to review: {personName(records, pending[0].subject)} ·{" "}
        {pending[0].type} · {formatRange(pending[0])}
      </p>
    ) : next ? (
      <p className="leave-widget-latest">
        Your next approved leave: {formatRange(next)}
      </p>
    ) : null;
  } else {
    const analytics = leaveAnalytics(leave, records, today);
    title = "Leave management";
    description = "Escalations, teacher leave and today's availability.";
    figures = [
      [
        "Escalated student leave",
        analytics.escalated,
        analytics.escalated ? "warning" : undefined,
      ],
      [
        "Pending teacher leave",
        analytics.pendingTeacher,
        analytics.pendingTeacher ? "warning" : undefined,
      ],
      ["Approved this month", analytics.approvedThisMonth, "success"],
      [
        "Teachers on leave today",
        analytics.teachers.filter((item) => item.status === "On leave today")
          .length,
      ],
    ];
  }

  return (
    <Card className="dash-card leave-widget">
      <div className="widget-header">
        <div>
          <h2>
            <CalendarOff size={18} aria-hidden="true" />
            {title}
          </h2>
          <p>{description}</p>
        </div>
        <Link className="view-all" href={href}>
          Open
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="leave-figures">
        {figures.map(([label, value, tone]) => (
          <Figure key={label} label={label} value={value} tone={tone} />
        ))}
      </div>
      {latest}
      {actions.length > 0 && <div className="card-actions">{actions}</div>}
    </Card>
  );
}

/** Teacher timetable: upcoming leave with the sessions it affects. */
export function TimetableLeaveNotice() {
  const { role, records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  if (role !== "teacher") return null;
  const today = localCalendarDate();
  const upcoming = leaveRequestsFor(leave, records, actor)
    .filter(
      (item) =>
        item.end >= today &&
        (item.status === "Approved" || item.status === "Pending Admin"),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!upcoming.length) return null;
  return (
    <Card className="dash-card leave-widget page-section" role="note">
      <div className="widget-header">
        <div>
          <h2>
            <CalendarOff size={18} aria-hidden="true" />
            Leave affecting your timetable
          </h2>
          <p>
            Sessions inside approved or pending leave, with the cover planned by
            the School Admin.
          </p>
        </div>
        <Link className="view-all" href={roleHref(role, "leave-requests")}>
          My leave
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <ul className="leave-sessions compact">
        {upcoming.flatMap((item) => {
          const slots = affectedSessions(
            records,
            item.subject,
            item.start,
            item.end,
            item.duration,
          );
          if (!slots.length)
            return [
              <li key={item.id}>
                <strong>
                  {item.type} · {formatRange(item)}
                </strong>
                <span>No scheduled sessions affected.</span>
                <LeaveStatusBadge status={item.status} />
              </li>,
            ];
          return slots.map((slot) => (
            <li key={item.id + slot.key}>
              <strong>
                {slot.day} {formatDate(slot.date)} · {slot.session.start}–
                {slot.session.end}
              </strong>
              <span>
                {subjectName(records, slot.subject)} ·{" "}
                {sectionTitle(records, slot.section)} · {item.type}
              </span>
              <span>
                <LeaveStatusBadge status={item.status} />{" "}
                <span
                  className={
                    "pill " +
                    (item.plan[slot.key] ? "pill-success" : "pill-warning")
                  }
                >
                  {item.plan[slot.key]
                    ? "Cover: " + personName(records, item.plan[slot.key])
                    : "Cover not planned"}
                </span>
              </span>
            </li>
          ));
        })}
      </ul>
    </Card>
  );
}

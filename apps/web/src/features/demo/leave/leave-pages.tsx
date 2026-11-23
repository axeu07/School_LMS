"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BellRing,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  CheckCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Forward,
  List,
  Pencil,
  Send,
  Undo2,
} from "lucide-react";
import { localCalendarDate } from "@/services/assignment-model";
import { formatPercent } from "@/services/insights";
import {
  absenceAlertsFor,
  approvedLeaveOn,
  canCancel,
  canReview,
  cancelLeave,
  decideLeave,
  formatLeaveLength,
  formatRange,
  leaveAnalytics,
  leaveLength,
  leaveRequestsFor,
  leaveSchool,
  localStamp,
  markNotificationsRead,
  pendingApprovals,
  pendingLeaveOn,
  personName,
  planSubstitute,
  sectionTitle,
  studentAttendanceWithLeave,
  submitLeaveDraft,
  teacherInbox,
  type LeaveDecision,
  type LeaveNotification,
  type LeaveRequest,
} from "@/services/leave-model";
import { updateLeaveState, useLeaveState } from "@/services/leave-store";
import { subjectName } from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState, StatCards, TrendChart } from "../dashboard-widgets";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { formatDate, formatDateTime } from "../format";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";
import {
  Drawer,
  LeaveCalendar,
  LeaveDetails,
  LeaveFormDialog,
  LeaveStatusBadge,
  LeaveTable,
  sessionsFor,
  submitterLabel,
  useLeaveFilters,
  useToast,
  type LeavePrefill,
} from "./leave-ui";

/* ------------------------------------------------------------------ */
/* Shared hooks                                                       */
/* ------------------------------------------------------------------ */

function useDecisionDialog(onDone: (message: string) => void) {
  const { records, actor } = useDemo();
  const [config, setConfig] = useState<FormConfig>();
  const open = (request: LeaveRequest, decision: LeaveDecision) =>
    setConfig({
      title:
        decision === "approve"
          ? "Approve leave"
          : decision === "reject"
            ? "Reject leave"
            : "Forward to School Admin",
      description:
        personName(records, request.subject) +
        " · " +
        request.type +
        " · " +
        formatRange(request) +
        " (" +
        formatLeaveLength(leaveLength(request)) +
        ")",
      submitLabel:
        decision === "approve"
          ? "Approve"
          : decision === "reject"
            ? "Reject request"
            : "Forward request",
      fields: [
        {
          name: "note",
          label:
            decision === "reject"
              ? "Reason for rejection"
              : decision === "forward"
                ? "Remarks for the School Admin (optional)"
                : "Remarks (optional)",
          type: "textarea",
          required: decision === "reject",
        },
      ],
      onSubmit: (fields) => {
        updateLeaveState((state) =>
          decideLeave(
            state,
            records,
            actor,
            request.id,
            decision,
            String(fields.get("note") ?? ""),
            localStamp(),
          ),
        );
        onDone(
          decision === "approve"
            ? "Leave approved. The applicant has been notified."
            : decision === "reject"
              ? "Leave rejected. The applicant has been notified."
              : "Request forwarded to the School Admin.",
        );
      },
    });
  const node = (
    <FormDialog config={config} onClose={() => setConfig(undefined)} />
  );
  return [node, open] as const;
}

function ReviewActions({
  request,
  onDecide,
}: {
  request: LeaveRequest;
  onDecide: (request: LeaveRequest, decision: LeaveDecision) => void;
}) {
  const { records, actor } = useDemo();
  if (!canReview(records, actor, request)) return null;
  return (
    <>
      <button
        type="button"
        className="button button-outline"
        onClick={() => onDecide(request, "reject")}
      >
        <CircleX size={16} aria-hidden="true" />
        Reject
      </button>
      {actor.role === "teacher" && (
        <button
          type="button"
          className="button button-outline"
          onClick={() => onDecide(request, "forward")}
        >
          <Forward size={16} aria-hidden="true" />
          Forward to Admin
        </button>
      )}
      <button
        type="button"
        className="button button-primary"
        onClick={() => onDecide(request, "approve")}
      >
        <CircleCheck size={16} aria-hidden="true" />
        Approve
      </button>
    </>
  );
}

function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { id: T; label: string; count?: number; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <div className="segmented-tabs leave-tabs" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className="tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Kpis({ items }: { items: [string, ReactNode, string?][] }) {
  return (
    <div className="kpi-strip leave-kpis">
      {items.map(([label, value, note]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {note && <small className="cell-note">{note}</small>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Student and parent                                                 */
/* ------------------------------------------------------------------ */

export function LearnerLeavePage() {
  return (
    <Suspense fallback={null}>
      <LearnerLeave />
    </Suspense>
  );
}

function LearnerLeave() {
  const { role, records, actor, data } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const student = role === "parent" ? data.child?.id : actor.person;
  const [toast, showToast] = useToast();
  const [form, setForm] = useState<
    { draft?: LeaveRequest; prefill?: LeavePrefill } | undefined
  >(() => {
    if (!params.get("apply")) return undefined;
    const date = params.get("date") ?? undefined;
    return { prefill: { start: date, end: date } };
  });
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"list" | "calendar">("list");
  const childActor = { ...actor, child: student };
  const requests = student ? leaveRequestsFor(leave, records, childActor) : [];
  const [filtered, filters] = useLeaveFilters(requests, records);
  if (!student)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  const summary = studentAttendanceWithLeave(records, leave, student);
  const alerts =
    role === "parent" ? absenceAlertsFor(leave, records, actor, student) : [];
  const request = requests.find((item) => item.id === selected);
  const name = personName(records, student);
  const count = (status: LeaveRequest["status"]) =>
    requests.filter((item) => item.status === status).length;

  function closeForm() {
    setForm(undefined);
    if (params.get("apply")) router.replace(pathname);
  }

  function act(change: () => void, message: string) {
    try {
      change();
      showToast(message);
      return true;
    } catch (failure) {
      showToast((failure as Error).message, "error");
      return false;
    }
  }

  return (
    <>
      {toast}
      <Kpis
        items={[
          [
            "Pending",
            count("Pending Teacher") + count("Pending Admin"),
            "Awaiting teacher or admin",
          ],
          ["Approved", count("Approved"), "Requests this year"],
          ["Rejected", count("Rejected"), "Requests this year"],
          [
            "Approved leave",
            formatLeaveLength(summary.approvedLeaveDays),
            "Total approved days",
          ],
        ]}
      />
      {role === "parent" && (
        <AbsenceAlerts
          alerts={alerts}
          student={student}
          onApply={(date) =>
            setForm({ prefill: { subject: student, start: date, end: date } })
          }
        />
      )}
      <SectionCard
        title={
          role === "parent" ? name + "'s leave requests" : "My leave requests"
        }
        description="Track every request from submission to decision. Pending requests can be cancelled."
        className="page-section"
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() => setForm({})}
          >
            <CalendarPlus size={16} aria-hidden="true" />
            Apply for leave
          </button>
        }
      >
        <div className="leave-toolbar">
          <Tabs
            label="View"
            value={view}
            onChange={setView}
            tabs={[
              {
                id: "list",
                label: "List",
                icon: <List size={15} aria-hidden="true" />,
              },
              {
                id: "calendar",
                label: "Calendar",
                icon: <CalendarRange size={15} aria-hidden="true" />,
              },
            ]}
          />
        </div>
        {view === "list" ? (
          <>
            {filters}
            <LeaveTable
              requests={filtered}
              onOpen={(item) => setSelected(item.id)}
              submitter
              actionLabel={(item) =>
                item.status === "Draft" ? "Open draft" : "View"
              }
              empty={
                requests.length
                  ? "No requests match these filters."
                  : "No leave requests yet. Use Apply for leave to create one."
              }
            />
          </>
        ) : (
          <LeaveCalendar
            requests={requests}
            onOpen={(item) => setSelected(item.id)}
            label={(item) => item.type}
          />
        )}
      </SectionCard>
      <SectionCard
        title="Attendance and leave"
        description="Physical attendance counts Present and Late only. Absences covered by approved leave are shown as Approved Leave, but they are not counted as presence."
        className="page-section"
        actions={
          <Link className="view-all" href={roleHref(role, "attendance")}>
            View attendance record
          </Link>
        }
      >
        <AttendanceLeaveSummary student={student} />
      </SectionCard>
      <Drawer
        open={!!request}
        title={request ? request.type : ""}
        subtitle={
          request && (
            <>
              <LeaveStatusBadge status={request.status} />{" "}
              {formatRange(request)}
            </>
          )
        }
        onClose={() => setSelected(undefined)}
        footer={
          request && (
            <>
              {request.status === "Draft" && canCancel(actor, request) && (
                <>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setSelected(undefined);
                      setForm({ draft: request });
                    }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Edit draft
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      if (
                        act(
                          () =>
                            updateLeaveState((state) =>
                              submitLeaveDraft(
                                state,
                                records,
                                { ...actor, child: request.subject },
                                request.id,
                                localStamp(),
                              ),
                            ),
                          "Draft submitted to the class teacher.",
                        )
                      )
                        setSelected(undefined);
                    }}
                  >
                    <Send size={15} aria-hidden="true" />
                    Submit
                  </button>
                </>
              )}
              {canCancel(actor, request) && (
                <button
                  type="button"
                  className="button button-outline button-danger"
                  onClick={() => {
                    if (
                      !confirmAction(
                        request.status === "Draft"
                          ? "Discard this draft?"
                          : "Cancel this pending leave request?",
                      )
                    )
                      return;
                    if (
                      act(
                        () =>
                          updateLeaveState((state) =>
                            cancelLeave(
                              state,
                              records,
                              actor,
                              request.id,
                              "",
                              localStamp(),
                            ),
                          ),
                        request.status === "Draft"
                          ? "Draft discarded."
                          : "Leave request cancelled.",
                      )
                    )
                      setSelected(undefined);
                  }}
                >
                  <Undo2 size={15} aria-hidden="true" />
                  {request.status === "Draft"
                    ? "Discard draft"
                    : "Cancel request"}
                </button>
              )}
            </>
          )
        }
      >
        {request && <LeaveDetails request={request} leave={leave} />}
      </Drawer>
      <LeaveFormDialog
        open={!!form}
        draft={form?.draft}
        prefill={form?.prefill}
        onClose={closeForm}
        onDone={(message) => showToast(message)}
      />
    </>
  );
}

function AttendanceLeaveSummary({ student }: { student: string }) {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const summary = studentAttendanceWithLeave(records, leave, student);
  return (
    <>
      <Kpis
        items={[
          [
            "Physical attendance",
            formatPercent(summary.physical),
            summary.rows.length + " recorded days",
          ],
          ["Present / Late", summary.present + " / " + summary.late],
          ["Unexcused absences", summary.absent],
          [
            "Approved Leave",
            summary.excused,
            "Absences covered by approved leave",
          ],
        ]}
      />
      {summary.rows.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Class</th>
                <th scope="col">Recorded mark</th>
                <th scope="col">Shown as</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.slice(0, 8).map((row) => (
                <tr key={row.section + row.date}>
                  <th scope="row">{formatDate(row.date)}</th>
                  <td>{sectionTitle(records, row.section)}</td>
                  <td>{row.mark}</td>
                  <td>
                    <span
                      className={
                        "pill " +
                        (row.effective === "Present"
                          ? "pill-success"
                          : row.effective === "Late"
                            ? "pill-warning"
                            : row.effective === "Absent"
                              ? "pill-danger"
                              : "pill-info")
                      }
                    >
                      {row.effective}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No attendance has been recorded yet.</EmptyState>
      )}
    </>
  );
}

function AbsenceAlerts({
  alerts,
  student,
  onApply,
}: {
  alerts: LeaveNotification[];
  student: string;
  onApply: (date: string) => void;
}) {
  const { records, actor, role } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const unread = alerts.filter((item) => !item.read);
  return (
    <SectionCard
      title="Absence alerts"
      description="Generated when a teacher marks your child absent. Alerts update automatically if attendance is corrected."
      className="page-section"
      actions={
        unread.length > 0 && (
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              updateLeaveState((state) =>
                markNotificationsRead(
                  state,
                  records,
                  actor,
                  unread.map((item) => item.id),
                ),
              )
            }
          >
            <CheckCheck size={16} aria-hidden="true" />
            Mark all read
          </button>
        )
      }
    >
      {alerts.length ? (
        <ul className="alert-list">
          {alerts.map((alert) => {
            const date = alert.date!;
            const approved = approvedLeaveOn(leave, "student", student, date);
            const pending = pendingLeaveOn(leave, "student", student, date);
            const active = alert.state === "Active";
            return (
              <li
                key={alert.id}
                className={
                  (active ? "is-active" : "is-resolved") +
                  (alert.read ? "" : " is-unread")
                }
              >
                <BellRing size={18} aria-hidden="true" />
                <div>
                  <p>{alert.message}</p>
                  <span className="alert-meta">
                    <span
                      className={
                        "pill " + (active ? "pill-danger" : "pill-success")
                      }
                    >
                      {active ? "Absent" : "Corrected"}
                    </span>
                    {active && approved && (
                      <span className="pill pill-info">
                        Covered by approved leave
                      </span>
                    )}
                    {active && !approved && pending && (
                      <span className="pill pill-warning">
                        Leave {pending.status.toLowerCase()}
                      </span>
                    )}
                    <span>
                      {sectionTitle(records, alert.section)} ·{" "}
                      {formatDate(date)} · alerted{" "}
                      {formatDateTime(alert.created)}
                    </span>
                  </span>
                </div>
                <div className="alert-actions">
                  <Link
                    className="button button-outline button-sm"
                    href={roleHref(role, "attendance")}
                  >
                    <ClipboardCheck size={14} aria-hidden="true" />
                    View attendance
                  </Link>
                  {active && !approved && !pending && (
                    <button
                      type="button"
                      className="button button-primary button-sm"
                      onClick={() => onApply(date)}
                    >
                      <CalendarPlus size={14} aria-hidden="true" />
                      Submit leave request
                    </button>
                  )}
                  {!alert.read && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        updateLeaveState((state) =>
                          markNotificationsRead(state, records, actor, [
                            alert.id,
                          ]),
                        )
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>No absence alerts for this child.</EmptyState>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher                                                            */
/* ------------------------------------------------------------------ */

export function TeacherLeavePage() {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const pending = pendingApprovals(leave, records, actor);
  const [tab, setTab] = useState<"approvals" | "mine">("approvals");
  const [toast, showToast] = useToast();
  return (
    <>
      {toast}
      <Tabs
        label="Leave sections"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "approvals",
            label: "Student Leave Approvals",
            count: pending.length,
          },
          { id: "mine", label: "My Leave Requests" },
        ]}
      />
      {tab === "approvals" ? (
        <TeacherApprovals onToast={showToast} />
      ) : (
        <TeacherOwnLeave onToast={showToast} />
      )}
    </>
  );
}

function TeacherApprovals({
  onToast,
}: {
  onToast: (message: string, tone?: "success" | "error") => void;
}) {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const inbox = teacherInbox(leave, records, actor);
  const pending = pendingApprovals(leave, records, actor);
  const [filtered, filters] = useLeaveFilters(
    inbox,
    records,
    pending.length ? "Pending Teacher" : "",
  );
  const [selected, setSelected] = useState<string>();
  const [decision, decide] = useDecisionDialog((message) => {
    setSelected(undefined);
    onToast(message);
  });
  const request = inbox.find((item) => item.id === selected);
  const by = (action: string) =>
    inbox.filter((item) =>
      item.history.some(
        (event) => event.actor === actor.person && event.action === action,
      ),
    ).length;
  return (
    <>
      <Kpis
        items={[
          ["Awaiting you", pending.length, "Pending teacher review"],
          ["Approved by you", by("Approved")],
          ["Forwarded to Admin", by("Forwarded")],
          ["Rejected by you", by("Rejected")],
        ]}
      />
      <SectionCard
        title="Student leave approvals"
        description="Requests from students and parents in your assigned classes. Approve, reject with a reason, or forward to the School Admin."
        className="page-section"
      >
        {filters}
        <LeaveTable
          requests={filtered}
          onOpen={(item) => setSelected(item.id)}
          person
          section
          submitter
          actionLabel={(item) =>
            canReview(records, actor, item) ? "Review" : "View"
          }
          empty={
            inbox.length
              ? "No requests match these filters."
              : "No leave requests from your classes yet."
          }
        />
      </SectionCard>
      <Drawer
        open={!!request}
        title={request ? personName(records, request.subject) : ""}
        subtitle={
          request && (
            <>
              <LeaveStatusBadge status={request.status} />{" "}
              {sectionTitle(records, request.section)} · {request.type} ·
              submitted by {submitterLabel[request.submittedRole].toLowerCase()}
            </>
          )
        }
        onClose={() => setSelected(undefined)}
        footer={
          request && <ReviewActions request={request} onDecide={decide} />
        }
      >
        {request && <LeaveDetails request={request} leave={leave} />}
      </Drawer>
      {decision}
    </>
  );
}

function TeacherOwnLeave({
  onToast,
}: {
  onToast: (message: string, tone?: "success" | "error") => void;
}) {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const requests = leaveRequestsFor(leave, records, actor);
  const [filtered, filters] = useLeaveFilters(requests, records);
  const [form, setForm] = useState<{ draft?: LeaveRequest }>();
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"list" | "calendar">("list");
  const today = localCalendarDate();
  const request = requests.find((item) => item.id === selected);
  const upcoming = requests
    .filter(
      (item) =>
        item.end >= today &&
        ["Approved", "Pending Admin"].includes(item.status),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const approvedDays = requests
    .filter((item) => item.status === "Approved")
    .reduce((sum, item) => sum + leaveLength(item), 0);
  const affected = upcoming.flatMap((item) => sessionsFor(records, item));
  return (
    <>
      <Kpis
        items={[
          [
            "Pending with Admin",
            requests.filter((item) => item.status === "Pending Admin").length,
          ],
          [
            "Approved",
            requests.filter((item) => item.status === "Approved").length,
          ],
          [
            "Approved leave",
            formatLeaveLength(approvedDays),
            "This academic year",
          ],
          [
            "Upcoming sessions affected",
            affected.length,
            "Approved or pending leave",
          ],
        ]}
      />
      <SectionCard
        title="Upcoming leave and cover"
        description="Sessions on your timetable that fall within approved or pending leave, with the cover planned by the School Admin."
        className="page-section"
      >
        {upcoming.length ? (
          <ul className="leave-upcoming">
            {upcoming.map((item) => {
              const sessions = sessionsFor(records, item);
              return (
                <li key={item.id}>
                  <div className="leave-upcoming-head">
                    <strong>
                      {item.type} · {formatRange(item)}
                    </strong>
                    <LeaveStatusBadge status={item.status} />
                  </div>
                  {sessions.length ? (
                    <ul className="leave-sessions compact">
                      {sessions.map((slot) => (
                        <li key={slot.key}>
                          <strong>
                            {subjectName(records, slot.subject)} ·{" "}
                            {sectionTitle(records, slot.section)}
                          </strong>
                          <span>
                            {slot.day} {formatDate(slot.date)} ·{" "}
                            {slot.session.start}–{slot.session.end}
                          </span>
                          <span
                            className={
                              "pill " +
                              (item.plan[slot.key]
                                ? "pill-success"
                                : "pill-warning")
                            }
                          >
                            {item.plan[slot.key]
                              ? "Cover: " +
                                personName(records, item.plan[slot.key])
                              : "Cover not planned"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-copy">
                      No scheduled sessions affected.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No upcoming approved or pending leave.</EmptyState>
        )}
      </SectionCard>
      <SectionCard
        title="My leave requests"
        description="Teacher leave goes directly to the School Admin. You cannot approve your own leave."
        className="page-section"
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() => setForm({})}
          >
            <CalendarPlus size={16} aria-hidden="true" />
            Apply for leave
          </button>
        }
      >
        <div className="leave-toolbar">
          <Tabs
            label="View"
            value={view}
            onChange={setView}
            tabs={[
              {
                id: "list",
                label: "List",
                icon: <List size={15} aria-hidden="true" />,
              },
              {
                id: "calendar",
                label: "Leave calendar",
                icon: <CalendarRange size={15} aria-hidden="true" />,
              },
            ]}
          />
        </div>
        {view === "list" ? (
          <>
            {filters}
            <LeaveTable
              requests={filtered}
              onOpen={(item) => setSelected(item.id)}
              actionLabel={(item) =>
                item.status === "Draft" ? "Open draft" : "View"
              }
              empty={
                requests.length
                  ? "No requests match these filters."
                  : "You have not applied for leave yet."
              }
            />
          </>
        ) : (
          <LeaveCalendar
            requests={requests}
            onOpen={(item) => setSelected(item.id)}
            label={(item) => item.type}
          />
        )}
      </SectionCard>
      <Drawer
        open={!!request}
        title={request ? request.type : ""}
        subtitle={
          request && (
            <>
              <LeaveStatusBadge status={request.status} />{" "}
              {formatRange(request)}
            </>
          )
        }
        onClose={() => setSelected(undefined)}
        footer={
          request &&
          canCancel(actor, request) && (
            <>
              {request.status === "Draft" && (
                <>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setSelected(undefined);
                      setForm({ draft: request });
                    }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Edit draft
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      try {
                        updateLeaveState((state) =>
                          submitLeaveDraft(
                            state,
                            records,
                            actor,
                            request.id,
                            localStamp(),
                          ),
                        );
                        setSelected(undefined);
                        onToast("Draft submitted to the School Admin.");
                      } catch (failure) {
                        onToast((failure as Error).message, "error");
                      }
                    }}
                  >
                    <Send size={15} aria-hidden="true" />
                    Submit
                  </button>
                </>
              )}
              <button
                type="button"
                className="button button-outline button-danger"
                onClick={() => {
                  if (
                    !confirmAction(
                      request.status === "Draft"
                        ? "Discard this draft?"
                        : "Cancel this pending leave request?",
                    )
                  )
                    return;
                  try {
                    updateLeaveState((state) =>
                      cancelLeave(
                        state,
                        records,
                        actor,
                        request.id,
                        "",
                        localStamp(),
                      ),
                    );
                    setSelected(undefined);
                    onToast(
                      request.status === "Draft"
                        ? "Draft discarded."
                        : "Leave request cancelled.",
                    );
                  } catch (failure) {
                    onToast((failure as Error).message, "error");
                  }
                }}
              >
                <Undo2 size={15} aria-hidden="true" />
                {request.status === "Draft"
                  ? "Discard draft"
                  : "Cancel request"}
              </button>
            </>
          )
        }
      >
        {request && <LeaveDetails request={request} leave={leave} />}
      </Drawer>
      <LeaveFormDialog
        open={!!form}
        draft={form?.draft}
        onClose={() => setForm(undefined)}
        onDone={(message) => onToast(message)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* School Admin                                                       */
/* ------------------------------------------------------------------ */

type AdminTab = "escalated" | "teacher" | "calendar" | "analytics";

export function AdminLeavePage() {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const [tab, setTab] = useState<AdminTab>("escalated");
  const [calendarFilter, setCalendarFilter] = useState({
    who: "all",
    month: "",
  });
  const [toast, showToast] = useToast();
  const analytics = leaveAnalytics(leave, records, localCalendarDate());
  return (
    <>
      {toast}
      <Tabs
        label="Leave management sections"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "escalated",
            label: "Escalated Student Leave",
            count: analytics.escalated,
          },
          {
            id: "teacher",
            label: "Teacher Leave Approvals",
            count: analytics.pendingTeacher,
          },
          { id: "calendar", label: "Leave Calendar" },
          { id: "analytics", label: "Leave Analytics" },
        ]}
      />
      {tab === "escalated" && <AdminQueue kind="student" onToast={showToast} />}
      {tab === "teacher" && (
        <AdminQueue
          kind="teacher"
          onToast={showToast}
          onCalendar={(request) => {
            setCalendarFilter({
              who: request.subject,
              month: request.start.slice(0, 7),
            });
            setTab("calendar");
          }}
        />
      )}
      {tab === "calendar" && (
        <AdminCalendar filter={calendarFilter} onFilter={setCalendarFilter} />
      )}
      {tab === "analytics" && <AdminAnalytics />}
    </>
  );
}

function AdminQueue({
  kind,
  onToast,
  onCalendar,
}: {
  kind: "student" | "teacher";
  onToast: (message: string, tone?: "success" | "error") => void;
  onCalendar?: (request: LeaveRequest) => void;
}) {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const all = leaveRequestsFor(leave, records, actor).filter(
    (item) =>
      item.kind === kind &&
      (kind === "teacher" ||
        item.history.some((event) => event.action === "Forwarded")),
  );
  const pending = all.filter((item) => item.status === "Pending Admin");
  const [filtered, filters] = useLeaveFilters(
    all,
    records,
    pending.length ? "Pending Admin" : "",
  );
  const [selected, setSelected] = useState<string>();
  const [decision, decide] = useDecisionDialog((message) => {
    setSelected(undefined);
    onToast(message);
  });
  const request = all.find((item) => item.id === selected);
  return (
    <>
      <Kpis
        items={[
          ["Awaiting decision", pending.length],
          ["Approved", all.filter((item) => item.status === "Approved").length],
          ["Rejected", all.filter((item) => item.status === "Rejected").length],
          [
            kind === "teacher"
              ? "Approved teacher days"
              : "Approved student days",
            formatLeaveLength(
              all
                .filter((item) => item.status === "Approved")
                .reduce((sum, item) => sum + leaveLength(item), 0),
            ),
          ],
        ]}
      />
      <SectionCard
        title={
          kind === "teacher"
            ? "Teacher leave approvals"
            : "Escalated student leave"
        }
        description={
          kind === "teacher"
            ? "Every teacher leave application for this school. Review affected sessions and plan substitute cover."
            : "Student and parent requests forwarded by class teachers for a final decision."
        }
        className="page-section"
      >
        {filters}
        <LeaveTable
          requests={filtered}
          onOpen={(item) => setSelected(item.id)}
          person
          section={kind === "student"}
          submitter={kind === "student"}
          actionLabel={(item) =>
            canReview(records, actor, item) ? "Review" : "View"
          }
          empty={
            all.length
              ? "No requests match these filters."
              : kind === "teacher"
                ? "No teacher leave applications yet."
                : "No student leave has been escalated yet."
          }
        />
      </SectionCard>
      <Drawer
        open={!!request}
        title={request ? personName(records, request.subject) : ""}
        subtitle={
          request && (
            <>
              <LeaveStatusBadge status={request.status} />{" "}
              {request.kind === "student"
                ? sectionTitle(records, request.section) + " · "
                : ""}
              {request.type} · {formatRange(request)}
            </>
          )
        }
        onClose={() => setSelected(undefined)}
        footer={
          request && (
            <>
              {onCalendar && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onCalendar(request)}
                >
                  <CalendarCheck size={16} aria-hidden="true" />
                  View leave calendar
                </button>
              )}
              <ReviewActions request={request} onDecide={decide} />
            </>
          )
        }
      >
        {request && (
          <LeaveDetails
            request={request}
            leave={leave}
            planner
            onPlan={(key, teacher) => {
              try {
                updateLeaveState((state) =>
                  planSubstitute(
                    state,
                    records,
                    actor,
                    request.id,
                    key,
                    teacher,
                    localStamp(),
                  ),
                );
                onToast(
                  teacher ? "Substitute cover planned." : "Cover removed.",
                );
              } catch (failure) {
                onToast((failure as Error).message, "error");
              }
            }}
          />
        )}
      </Drawer>
      {decision}
    </>
  );
}

function AdminCalendar({
  filter,
  onFilter,
}: {
  filter: { who: string; month: string };
  onFilter: (filter: { who: string; month: string }) => void;
}) {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const [selected, setSelected] = useState<string>();
  const all = leaveRequestsFor(leave, records, actor);
  const shown = all.filter((item) =>
    filter.who === "all"
      ? true
      : filter.who === "students"
        ? item.kind === "student"
        : filter.who === "teachers"
          ? item.kind === "teacher"
          : item.subject === filter.who,
  );
  const request = all.find((item) => item.id === selected);
  return (
    <SectionCard
      title="Leave calendar"
      description="Approved and pending leave across the school. Select an entry for details."
      className="page-section"
      actions={
        <label className="leave-inline-label">
          Show
          <select
            value={filter.who}
            onChange={(event) =>
              onFilter({ ...filter, who: event.target.value })
            }
          >
            <option value="all">All leave</option>
            <option value="students">Student leave</option>
            <option value="teachers">Teacher leave</option>
            <optgroup label="Teacher">
              {records.teachers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      }
    >
      <LeaveCalendar
        key={filter.who + filter.month}
        requests={shown}
        initialMonth={filter.month || undefined}
        onOpen={(item) => setSelected(item.id)}
        label={(item) =>
          personName(records, item.subject).split(" ")[0] +
          (item.kind === "teacher" ? " (staff)" : "")
        }
      />
      <Drawer
        open={!!request}
        title={request ? personName(records, request.subject) : ""}
        subtitle={
          request && (
            <>
              <LeaveStatusBadge status={request.status} /> {request.type} ·{" "}
              {formatRange(request)}
            </>
          )
        }
        onClose={() => setSelected(undefined)}
      >
        {request && <LeaveDetails request={request} leave={leave} />}
      </Drawer>
    </SectionCard>
  );
}

function AdminAnalytics() {
  const { records, actor } = useDemo();
  const leave = leaveSchool(useLeaveState(), actor.school);
  const analytics = leaveAnalytics(leave, records, localCalendarDate());
  return (
    <>
      <StatCards
        stats={[
          {
            label: "Pending student leave",
            value: String(analytics.pendingStudent),
            note: "With teachers or escalated",
            icon: "students",
          },
          {
            label: "Pending teacher leave",
            value: String(analytics.pendingTeacher),
            note: "Awaiting your decision",
            icon: "teachers",
          },
          {
            label: "Approved this month",
            value: String(analytics.approvedThisMonth),
            note: "Leave touching this month",
            icon: "calendar",
          },
          {
            label: "Rejected requests",
            value: String(analytics.rejected),
            note: "All submitted requests",
            icon: "tasks",
          },
        ]}
      />
      <div className="dashboard-grid feature-grid page-section">
        <TrendChart
          chart={{
            title: "Leave trends",
            description:
              "Submitted leave requests by start month, from demo records.",
            labels: analytics.trend.labels,
            values: analytics.trend.values,
            unit: "",
          }}
        />
        <SectionCard
          title="Teacher availability"
          description="Today's status from approved teacher leave."
        >
          <ul className="leave-history-list">
            {analytics.teachers.map((row) => (
              <li key={row.teacher.id}>
                <span>
                  <strong>{row.teacher.name}</strong>
                  {row.current
                    ? "Back after " + formatDate(row.current.end)
                    : row.upcoming
                      ? "Next leave " + formatRange(row.upcoming)
                      : "No upcoming leave"}
                  {row.pending ? " · " + row.pending + " pending" : ""} ·{" "}
                  {formatLeaveLength(row.days)} approved
                </span>
                <span
                  className={
                    "pill " +
                    (row.status === "Available"
                      ? "pill-success"
                      : row.status === "On leave today"
                        ? "pill-danger"
                        : row.status === "Leave upcoming"
                          ? "pill-warning"
                          : "pill-muted")
                  }
                >
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      <SectionCard
        title="Class-wise student leave"
        description="Submitted student requests by section in the active academic year."
        className="page-section"
      >
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Requests</th>
                <th scope="col">Approved</th>
                <th scope="col">Pending</th>
                <th scope="col">Rejected</th>
                <th scope="col">Approved days</th>
              </tr>
            </thead>
            <tbody>
              {analytics.classes.map((row) => (
                <tr key={row.section}>
                  <th scope="row">{row.label}</th>
                  <td>{row.requests}</td>
                  <td>{row.approved}</td>
                  <td>{row.pending}</td>
                  <td>{row.rejected}</td>
                  <td>{formatLeaveLength(row.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

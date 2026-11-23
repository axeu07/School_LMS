"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  FileText,
  Forward,
  Paperclip,
  Search,
  Send,
  UserRoundCog,
  X,
} from "lucide-react";
import type { AcademicSchool } from "@/services/academic-model";
import { localCalendarDate } from "@/services/assignment-model";
import {
  affectedSessions,
  coversDate,
  createLeaveRequest,
  editLeaveDraft,
  formatLeaveLength,
  formatRange,
  leaveDurations,
  leaveLength,
  leaveStatuses,
  leaveTypes,
  leavesOverlap,
  activeStatuses,
  localStamp,
  personName,
  sectionTitle,
  submitLeaveDraft,
  substituteOptions,
  type LeaveAttachment,
  type LeaveDuration,
  type LeaveEvent,
  type LeaveRequest,
  type LeaveSchool,
  type LeaveStatus,
} from "@/services/leave-model";
import { updateLeaveState, useLeaveSchool } from "@/services/leave-store";
import { currentEnrollment, linkedStudents } from "@/services/academic-model";
import { subjectName } from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState } from "../dashboard-widgets";
import { formatDate, formatDateTime } from "../format";

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */

const statusTone: Record<LeaveStatus, string> = {
  Draft: "pill-muted",
  "Pending Teacher": "pill-warning",
  "Pending Admin": "pill-info",
  Approved: "pill-success",
  Rejected: "pill-danger",
  Cancelled: "pill-muted",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={"pill " + statusTone[status]}>{status}</span>;
}

export const submitterLabel = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
} as const;

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
    id: number;
  }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      clearTimeout(timer.current);
      setToast({ message, tone, id: Date.now() });
      timer.current = setTimeout(() => setToast(undefined), 4500);
    },
    [],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className="leave-toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={"leave-toast tone-" + toast.tone} key={toast.id}>
          {toast.tone === "success" ? (
            <CircleCheck size={18} aria-hidden="true" />
          ) : (
            <CircleX size={18} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss"
            onClick={() => setToast(undefined)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
  return [node, show] as const;
}

/** A modal dialog that slides in from the right. */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="leave-drawer"
      aria-labelledby="leave-drawer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="leave-drawer-panel">
          <div className="leave-drawer-head">
            <div>
              <h2 id="leave-drawer-title">{title}</h2>
              {subtitle && <div className="leave-drawer-sub">{subtitle}</div>}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close details"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="leave-drawer-body">{children}</div>
          {footer && <div className="leave-drawer-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Filters and table                                                  */
/* ------------------------------------------------------------------ */

export function useLeaveFilters(
  requests: LeaveRequest[],
  records: AcademicSchool,
  initialStatus: LeaveStatus | "" = "",
) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeaveStatus | "">(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const term = query.trim().toLowerCase();
  const filtered = requests.filter(
    (item) =>
      (!status || item.status === status) &&
      (!from || item.end >= from) &&
      (!to || item.start <= to) &&
      (!term ||
        [
          personName(records, item.subject),
          item.type,
          item.reason,
          sectionTitle(records, item.section),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );
  const active = !!(term || status || from || to);
  const node = (
    <div className="filter-bar leave-filters">
      <label className="leave-search">
        <span className="sr-only">Search leave requests</span>
        <span className="inline-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name, type or reason"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
      </label>
      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as LeaveStatus)}
        >
          <option value="">All statuses</option>
          {leaveStatuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        From
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      {active && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setQuery("");
            setStatus("");
            setFrom("");
            setTo("");
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
  return [filtered, node] as const;
}

export function LeaveTable({
  requests,
  onOpen,
  person = false,
  section = false,
  submitter = false,
  actionLabel = "View",
  empty,
}: {
  requests: LeaveRequest[];
  onOpen: (request: LeaveRequest) => void;
  person?: boolean;
  section?: boolean;
  submitter?: boolean;
  actionLabel?: string | ((request: LeaveRequest) => string);
  empty: string;
}) {
  const { records } = useDemo();
  if (!requests.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="pro-table leave-table">
        <thead>
          <tr>
            {person && <th scope="col">Name</th>}
            {section && <th scope="col">Class</th>}
            <th scope="col">Leave</th>
            <th scope="col">Dates</th>
            {submitter && <th scope="col">Submitted by</th>}
            <th scope="col">Reason</th>
            <th scope="col">Submitted</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((item) => (
            <tr key={item.id}>
              {person && (
                <th scope="row">{personName(records, item.subject)}</th>
              )}
              {section && <td>{sectionTitle(records, item.section)}</td>}
              <td>
                {item.type}
                {item.attachment && (
                  <Paperclip
                    size={13}
                    className="muted-icon"
                    aria-label="Has a demo attachment"
                  />
                )}
              </td>
              <td className="nowrap">
                {formatRange(item)}
                <small className="cell-note">
                  {formatLeaveLength(leaveLength(item))}
                  {item.duration !== "Full day" ? " · " + item.duration : ""}
                </small>
              </td>
              {submitter && (
                <td>
                  <span className="pill pill-muted">
                    {submitterLabel[item.submittedRole]}
                  </span>
                </td>
              )}
              <td className="leave-reason">{item.reason}</td>
              <td className="nowrap">{formatDate(item.created)}</td>
              <td>
                <LeaveStatusBadge status={item.status} />
              </td>
              <td>
                <button
                  type="button"
                  className="button button-outline button-sm"
                  onClick={() => onOpen(item)}
                >
                  {typeof actionLabel === "function"
                    ? actionLabel(item)
                    : actionLabel}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Details, timeline and history                                      */
/* ------------------------------------------------------------------ */

const eventIcon: Record<LeaveEvent["action"], ReactNode> = {
  "Saved draft": <FileText size={14} aria-hidden="true" />,
  "Edited draft": <FileText size={14} aria-hidden="true" />,
  Submitted: <Send size={14} aria-hidden="true" />,
  Forwarded: <Forward size={14} aria-hidden="true" />,
  Approved: <CircleCheck size={14} aria-hidden="true" />,
  Rejected: <CircleX size={14} aria-hidden="true" />,
  Cancelled: <X size={14} aria-hidden="true" />,
  "Substitute planned": <UserRoundCog size={14} aria-hidden="true" />,
};

export function LeaveTimeline({ request }: { request: LeaveRequest }) {
  const { records } = useDemo();
  return (
    <ol className="leave-timeline" aria-label="Activity timeline">
      {[...request.history].reverse().map((event, index) => (
        <li
          key={event.at + event.action + index}
          data-action={event.action.toLowerCase().replace(/\s+/g, "-")}
        >
          <span className="leave-timeline-dot">{eventIcon[event.action]}</span>
          <div>
            <strong>{event.action}</strong>
            <span>
              {personName(records, event.actor, event.role)} ·{" "}
              {formatDateTime(event.at)}
            </span>
            {event.note && <p>“{event.note}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LeaveDetails({
  request,
  leave,
  planner = false,
  onPlan,
}: {
  request: LeaveRequest;
  leave: LeaveSchool;
  /** Admin: allow choosing substitute teachers. */
  planner?: boolean;
  onPlan?: (key: string, teacher: string) => void;
}) {
  const { records } = useDemo();
  const forwarded = [...request.history]
    .reverse()
    .find((event) => event.action === "Forwarded");
  const sessions =
    request.kind === "teacher"
      ? affectedSessions(
          records,
          request.subject,
          request.start,
          request.end,
          request.duration,
        )
      : [];
  const live =
    request.status === "Pending Admin" || request.status === "Approved";
  return (
    <>
      <dl className="leave-facts">
        <div>
          <dt>{request.kind === "student" ? "Student" : "Teacher"}</dt>
          <dd>{personName(records, request.subject)}</dd>
        </div>
        {request.kind === "student" && (
          <div>
            <dt>Class</dt>
            <dd>{sectionTitle(records, request.section)}</dd>
          </div>
        )}
        <div>
          <dt>Leave type</dt>
          <dd>{request.type}</dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd>
            {formatRange(request)} · {formatLeaveLength(leaveLength(request))}
            {request.duration !== "Full day" && " (" + request.duration + ")"}
          </dd>
        </div>
        <div>
          <dt>Submitted by</dt>
          <dd>
            {personName(records, request.submittedBy)} (
            {submitterLabel[request.submittedRole]})
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDateTime(request.created)}</dd>
        </div>
        <div>
          <dt>Reviewer</dt>
          <dd>{personName(records, request.reviewer)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <LeaveStatusBadge status={request.status} />
          </dd>
        </div>
      </dl>
      <section className="leave-block">
        <h3>Reason</h3>
        <p>{request.reason}</p>
        {request.contact && (
          <p className="muted-copy">Contact note: {request.contact}</p>
        )}
        {request.attachment && (
          <p className="leave-attachment">
            <Paperclip size={14} aria-hidden="true" />
            {request.attachment.name}
            <span>
              {request.attachment.kind} · {request.attachment.size} · demo
              metadata only
            </span>
          </p>
        )}
      </section>
      {forwarded?.note && (
        <section className="leave-block leave-remark">
          <h3>Teacher remarks</h3>
          <p>{forwarded.note}</p>
          <span className="muted-copy">
            {personName(records, forwarded.actor)} ·{" "}
            {formatDateTime(forwarded.at)}
          </span>
        </section>
      )}
      {request.remarks &&
        (request.status === "Approved" || request.status === "Rejected") && (
          <section className="leave-block leave-remark">
            <h3>Decision remarks</h3>
            <p>{request.remarks}</p>
          </section>
        )}
      {request.kind === "teacher" && (
        <section className="leave-block">
          <h3>Affected teaching sessions</h3>
          {request.substitute && (
            <p className="muted-copy">
              Suggested cover: {personName(records, request.substitute)}
            </p>
          )}
          {sessions.length ? (
            <ul className="leave-sessions">
              {sessions.map((slot) => {
                const options = substituteOptions(
                  records,
                  leave,
                  request.subject,
                  slot,
                );
                const chosen = request.plan[slot.key] ?? "";
                return (
                  <li key={slot.key}>
                    <div>
                      <strong>
                        {subjectName(records, slot.subject)} ·{" "}
                        {sectionTitle(records, slot.section)}
                      </strong>
                      <span>
                        {slot.day} {formatDate(slot.date)} ·{" "}
                        {slot.session.start}–{slot.session.end} ·{" "}
                        {slot.session.room}
                      </span>
                    </div>
                    {planner && live && onPlan ? (
                      <label>
                        <span className="sr-only">Substitute teacher</span>
                        <select
                          value={chosen}
                          onChange={(event) =>
                            onPlan(slot.key, event.target.value)
                          }
                        >
                          <option value="">No cover planned</option>
                          {options.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </option>
                          ))}
                          {chosen &&
                            !options.some((item) => item.id === chosen) && (
                              <option value={chosen}>
                                {personName(records, chosen)} (unavailable)
                              </option>
                            )}
                        </select>
                      </label>
                    ) : (
                      <span
                        className={
                          "pill " + (chosen ? "pill-success" : "pill-warning")
                        }
                      >
                        {chosen
                          ? "Cover: " + personName(records, chosen)
                          : "Cover not planned"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              No scheduled sessions fall within this leave.
            </EmptyState>
          )}
        </section>
      )}
      <section className="leave-block">
        <h3>Activity timeline</h3>
        <LeaveTimeline request={request} />
      </section>
      <PreviousLeave request={request} leave={leave} />
    </>
  );
}

function PreviousLeave({
  request,
  leave,
}: {
  request: LeaveRequest;
  leave: LeaveSchool;
}) {
  const { records } = useDemo();
  const previous = leave.requests
    .filter(
      (item) =>
        item.id !== request.id &&
        item.kind === request.kind &&
        item.subject === request.subject &&
        item.status !== "Draft",
    )
    .sort((a, b) => b.start.localeCompare(a.start));
  const days = previous
    .filter((item) => item.status === "Approved")
    .reduce((sum, item) => sum + leaveLength(item), 0);
  return (
    <section className="leave-block">
      <h3>
        Previous leave · {personName(records, request.subject).split(" ")[0]}
      </h3>
      <p className="muted-copy">
        {previous.length} other request{previous.length === 1 ? "" : "s"} ·{" "}
        {formatLeaveLength(days)} approved this year
      </p>
      {previous.length > 0 && (
        <ul className="leave-history-list">
          {previous.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.type}</strong>
                {formatRange(item)} · {formatLeaveLength(leaveLength(item))}
              </span>
              <LeaveStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                           */
/* ------------------------------------------------------------------ */

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabels =
  "January February March April May June July August September October November December".split(
    " ",
  );

function shiftMonth(month: string, delta: number) {
  const date = new Date(
    Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + delta, 1),
  );
  return date.toISOString().slice(0, 7);
}

export function LeaveCalendar({
  requests,
  onOpen,
  label,
  initialMonth,
}: {
  requests: LeaveRequest[];
  onOpen: (request: LeaveRequest) => void;
  label: (request: LeaveRequest) => string;
  initialMonth?: string;
}) {
  const today = localCalendarDate();
  const [month, setMonth] = useState(initialMonth ?? today.slice(0, 7));
  const shown = requests.filter((item) =>
    ["Approved", "Pending Teacher", "Pending Admin"].includes(item.status),
  );
  const first = month + "-01";
  const offset =
    (new Date(
      Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1),
    ).getUTCDay() +
      6) %
    7;
  const daysInMonth = new Date(
    Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0),
  ).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((offset + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day >= 1 && day <= daysInMonth
        ? first.slice(0, 8) + String(day).padStart(2, "0")
        : "";
    },
  );
  const inMonth = shown.filter(
    (item) => item.start.slice(0, 7) <= month && item.end.slice(0, 7) >= month,
  );
  return (
    <div className="leave-calendar">
      <div className="leave-calendar-head">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h3>
          <CalendarDays size={16} aria-hidden="true" />
          {monthLabels[+month.slice(5, 7) - 1]} {month.slice(0, 4)}
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {month !== today.slice(0, 7) && (
          <button
            type="button"
            className="text-button"
            onClick={() => setMonth(today.slice(0, 7))}
          >
            Today
          </button>
        )}
        <span className="leave-legend">
          <span className="legend-approved">Approved</span>
          <span className="legend-pending">Pending</span>
        </span>
      </div>
      <div
        className="leave-calendar-grid"
        role="grid"
        aria-label="Leave calendar"
      >
        <div role="row" className="leave-calendar-row">
          {weekdayLabels.map((day) => (
            <span role="columnheader" key={day} className="leave-calendar-wd">
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <div role="row" className="leave-calendar-row" key={week}>
            {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
              const items = date
                ? inMonth.filter((item) => coversDate(item, date))
                : [];
              return (
                <div
                  role="gridcell"
                  key={week + "-" + index}
                  className={
                    "leave-calendar-cell" +
                    (date ? "" : " is-empty") +
                    (date === today ? " is-today" : "")
                  }
                  aria-label={
                    date
                      ? formatDate(date) + ", " + items.length + " on leave"
                      : undefined
                  }
                >
                  {date && (
                    <span className="leave-calendar-day">{+date.slice(8)}</span>
                  )}
                  {items.slice(0, 3).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        "leave-chip " +
                        (item.status === "Approved"
                          ? "is-approved"
                          : "is-pending")
                      }
                      title={
                        label(item) + " · " + item.type + " · " + item.status
                      }
                      onClick={() => onOpen(item)}
                    >
                      {label(item)}
                    </button>
                  ))}
                  {items.length > 3 && (
                    <span className="leave-more">+{items.length - 3} more</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {!inMonth.length && (
        <p className="muted-copy">No approved or pending leave this month.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leave application form                                             */
/* ------------------------------------------------------------------ */

export const demoAttachments: LeaveAttachment[] = [
  { name: "doctor-note-demo.pdf", kind: "PDF", size: "112 KB" },
  { name: "appointment-slip-demo.pdf", kind: "PDF", size: "84 KB" },
  { name: "travel-ticket-demo.jpg", kind: "JPG", size: "236 KB" },
  { name: "family-letter-demo.png", kind: "PNG", size: "190 KB" },
];

export type LeavePrefill = {
  subject?: string;
  start?: string;
  end?: string;
  type?: string;
  reason?: string;
};

export function LeaveFormDialog({
  open,
  draft,
  prefill,
  onClose,
  onDone,
}: {
  open: boolean;
  draft?: LeaveRequest;
  prefill?: LeavePrefill;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [version, setVersion] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setVersion(version + 1);
  }
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="search-dialog academic-dialog form-dialog leave-form-dialog"
      aria-labelledby="leave-form-title"
      onClose={onClose}
    >
      {open && (
        <LeaveForm
          key={version}
          draft={draft}
          prefill={prefill}
          onClose={onClose}
          onDone={onDone}
        />
      )}
    </dialog>
  );
}

function LeaveForm({
  draft,
  prefill,
  onClose,
  onDone,
}: {
  draft?: LeaveRequest;
  prefill?: LeavePrefill;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { records, actor, role, data, setChild } = useDemo();
  const leave = useLeaveSchool(actor.school);
  const today = localCalendarDate();
  const year = records.years.find((item) => item.status === "Active");
  const children =
    role === "parent" ? linkedStudents(records, actor.person) : [];
  const [subject, setSubject] = useState(
    draft?.subject ??
      prefill?.subject ??
      (role === "parent" ? (data.child?.id ?? "") : actor.person),
  );
  const [type, setType] = useState<string>(draft?.type ?? prefill?.type ?? "");
  const [start, setStart] = useState(draft?.start ?? prefill?.start ?? today);
  const [end, setEnd] = useState(
    draft?.end ?? prefill?.end ?? prefill?.start ?? today,
  );
  const [duration, setDuration] = useState<LeaveDuration>(
    draft?.duration ?? "Full day",
  );
  const [reason, setReason] = useState(draft?.reason ?? prefill?.reason ?? "");
  const [contact, setContact] = useState(draft?.contact ?? "");
  const [attachment, setAttachment] = useState(draft?.attachment?.name ?? "");
  const [substitute, setSubstitute] = useState(draft?.substitute ?? "");
  const [error, setError] = useState("");
  const teacher = role === "teacher";
  const section = !teacher
    ? currentEnrollment(records, subject)?.section
    : undefined;
  const singleDay = start === end;
  const effectiveDuration: LeaveDuration = singleDay ? duration : "Full day";
  const valid = start && end && end >= start;
  const sessions =
    teacher && valid
      ? affectedSessions(records, actor.person, start, end, effectiveDuration)
      : [];
  const kind = teacher ? "teacher" : "student";
  const clash = valid
    ? leave.requests.find(
        (item) =>
          item.id !== draft?.id &&
          item.kind === kind &&
          item.subject === subject &&
          activeStatuses.includes(item.status) &&
          leavesOverlap(item, { start, end, duration: effectiveDuration }),
      )
    : undefined;
  const colleagues = records.teachers.filter(
    (item) => item.id !== actor.person && item.status === "Active",
  );
  const days = valid
    ? leaveLength({ start, end, duration: effectiveDuration })
    : 0;

  function save(asDraft: boolean) {
    setError("");
    const input = {
      subject,
      type,
      start,
      end,
      duration: effectiveDuration,
      reason,
      contact,
      attachment: demoAttachments.find((item) => item.name === attachment),
      substitute,
    };
    const now = localStamp();
    const subjectActor =
      role === "parent" ? { ...actor, child: subject } : actor;
    try {
      updateLeaveState((state) => {
        if (draft) {
          const edited = editLeaveDraft(
            state,
            records,
            subjectActor,
            draft.id,
            input,
            now,
          );
          return asDraft
            ? edited
            : submitLeaveDraft(edited, records, subjectActor, draft.id, now);
        }
        return createLeaveRequest(state, records, subjectActor, input, {
          id: crypto.randomUUID(),
          now,
          draft: asDraft,
        });
      });
      if (role === "parent" && subject !== data.child?.id) setChild(subject);
      onDone(
        asDraft
          ? "Draft saved. Submit it when you are ready."
          : teacher
            ? "Leave request sent to the School Admin."
            : "Leave request sent to the class teacher.",
      );
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      <div className="dialog-heading">
        <h2 id="leave-form-title">
          {draft
            ? "Edit leave draft"
            : teacher
              ? "Apply for leave"
              : "New leave request"}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="muted-copy">
        {teacher
          ? "Your request goes directly to the School Admin. Affected sessions are calculated from your timetable."
          : "Your request goes to the class teacher, who may approve it, reject it or forward it to the School Admin."}
      </p>
      <div className="leave-form-grid">
        {role === "parent" ? (
          <label>
            Child
            <select
              value={subject}
              required
              disabled={!!draft}
              onChange={(event) => setSubject(event.target.value)}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {teacher ? "Applicant" : "Student"}
            <input value={personName(records, subject)} readOnly />
          </label>
        )}
        {!teacher && (
          <label>
            Class and section
            <input
              value={
                section
                  ? sectionTitle(records, section)
                  : "No current enrollment"
              }
              readOnly
            />
          </label>
        )}
        <label>
          Leave type
          <select
            value={type}
            required
            onChange={(event) => setType(event.target.value)}
          >
            <option value="" disabled>
              Select leave type
            </option>
            {leaveTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Start date
          <input
            type="date"
            required
            value={start}
            min={year?.start}
            max={year?.end}
            onChange={(event) => {
              setStart(event.target.value);
              if (!end || end < event.target.value) setEnd(event.target.value);
            }}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            required
            value={end}
            min={start || year?.start}
            max={year?.end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>
      <fieldset className="leave-duration">
        <legend>Day option</legend>
        {leaveDurations.map((item) => (
          <label key={item} className="check-row">
            <input
              type="radio"
              name="duration"
              value={item}
              checked={effectiveDuration === item}
              disabled={item !== "Full day" && !singleDay}
              onChange={() => setDuration(item)}
            />
            {item === "Full day"
              ? "Full day"
              : "Half day · " + item.toLowerCase()}
          </label>
        ))}
        <span className="field-hint">
          {singleDay
            ? "Half-day options are available for single-day leave."
            : "Multi-day leave is always full day."}{" "}
          {days > 0 && <strong>Duration: {formatLeaveLength(days)}.</strong>}
        </span>
      </fieldset>
      <label>
        Reason
        <textarea
          required
          minLength={10}
          maxLength={500}
          value={reason}
          placeholder="Briefly explain the reason for leave"
          onChange={(event) => setReason(event.target.value)}
        />
        <span className="field-hint">
          {reason.trim().length}/500 · at least 10 characters
        </span>
      </label>
      <div className="leave-form-grid">
        <label>
          Supporting document (optional)
          <select
            value={attachment}
            onChange={(event) => setAttachment(event.target.value)}
          >
            <option value="">No attachment</option>
            {demoAttachments.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} · {item.size}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Demo metadata only. No file is uploaded or stored.
          </span>
        </label>
        <label>
          Contact note (optional)
          <input
            value={contact}
            maxLength={200}
            placeholder="e.g. Reachable by phone after 10:00"
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
      </div>
      {teacher && (
        <div className="leave-teacher-extra">
          <h3>
            <Clock3 size={15} aria-hidden="true" />
            Teaching sessions affected ({sessions.length})
          </h3>
          {sessions.length ? (
            <ul className="leave-sessions compact">
              {sessions.map((slot) => (
                <li key={slot.key}>
                  <strong>
                    {subjectName(records, slot.subject)} ·{" "}
                    {sectionTitle(records, slot.section)}
                  </strong>
                  <span>
                    {slot.day} {formatDate(slot.date)} · {slot.session.start}–
                    {slot.session.end} · {slot.session.room}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">
              No scheduled sessions fall within these dates.
            </p>
          )}
          <label>
            Substitute teacher suggestion (optional)
            <select
              value={substitute}
              onChange={(event) => setSubstitute(event.target.value)}
            >
              <option value="">No suggestion</option>
              {colleagues.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {clash && (
        <p className="leave-warning" role="note">
          These dates overlap an existing {clash.status.toLowerCase()} request (
          {formatRange(clash)}). Submitting will be blocked; you can still save
          a draft.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="academic-toolbar">
        <button
          type="button"
          className="button button-outline"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button-outline"
          onClick={() => save(true)}
        >
          Save draft
        </button>
        <button type="submit" className="button button-primary">
          <Send size={15} aria-hidden="true" />
          Submit request
        </button>
      </div>
    </form>
  );
}

/** Sessions affected by a list of teacher leave requests, for summaries. */
export function sessionsFor(records: AcademicSchool, request: LeaveRequest) {
  return request.kind === "teacher"
    ? affectedSessions(
        records,
        request.subject,
        request.start,
        request.end,
        request.duration,
      )
    : [];
}

"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  MapPin,
  NotebookPen,
  Palmtree,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { localCalendarDate } from "@/services/assignment-model";
import {
  addDays,
  audiences,
  bookSlot,
  bookingsFor,
  calendarEntries,
  cancelBooking,
  cancelEvent,
  categoryLabels,
  declineEvent,
  defaultAudience,
  deleteEvent,
  entriesOn,
  entryCategories,
  entryLabels,
  eventCategories,
  eventsFor,
  monthGrid,
  publishEvent,
  ptmTeachersForStudent,
  rescheduleBooking,
  saveEvent,
  sectionName,
  shiftMonth,
  slotState,
  startOfWeek,
  teacherSectionIds,
  toggleSlotBlocked,
  updateMeeting,
  viewerStudent,
  type CalendarEntry,
  type EntryCategory,
  type EventCategory,
  type EventInput,
  type EventStatus,
  type PtmBooking,
  type SchoolEvent,
  type SlotState,
} from "@/services/calendar-model";
import type { CommunicationState } from "@/services/communication-model";
import {
  updateCommunicationState,
  useCommunicationState,
} from "@/services/communication-store";
import { localDateTime } from "@/services/learning-model";
import { useLearningState, useNow } from "@/services/learning-store";
import { useLeaveSchool } from "@/services/leave-store";
import type { AcademicSchool } from "@/services/academic-model";
import type { AssignmentActor } from "@/services/assignment-model";
import type { DemoRole } from "@/types/demo";
import { useDemo } from "../demo-context";
import { EmptyState } from "../dashboard-widgets";
import {
  confirmAction,
  FormDialog,
  type FormConfig,
  type FormField,
} from "../form-dialog";
import { formatDate, newId } from "../format";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";
import { useToast } from "../toast";

/* ---------- Helpers ---------- */

const monthNames =
  "January February March April May June July August September October November December".split(
    " ",
  );
const dayNames =
  "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" ");

function monthTitle(date: string) {
  return monthNames[Number(date.slice(5, 7)) - 1] + " " + date.slice(0, 4);
}

function longDate(date: string) {
  const weekday = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
  return dayNames[weekday] + ", " + formatDate(date);
}

function timeLabel(
  entry: Pick<
    CalendarEntry,
    "allDay" | "startDate" | "endDate" | "startTime" | "endTime"
  >,
) {
  const days =
    entry.startDate === entry.endDate
      ? ""
      : formatDate(entry.startDate) + " – " + formatDate(entry.endDate);
  if (entry.allDay) return days ? days + " · all day" : "All day";
  return days
    ? formatDate(entry.startDate) +
        " " +
        entry.startTime +
        " – " +
        formatDate(entry.endDate) +
        " " +
        entry.endTime
    : entry.startTime + "–" + entry.endTime;
}

const statusPill: Record<EventStatus, string> = {
  Draft: "pill-muted",
  Proposed: "pill-warning",
  Published: "pill-success",
  Cancelled: "pill-danger",
  Declined: "pill-muted",
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const list = (form: FormData, key: string) => form.getAll(key).map(String);
const personName = (
  records: AcademicSchool,
  table: "teachers" | "students" | "guardians",
  id: string,
) =>
  (records[table] as { id: string; name: string }[]).find(
    (item) => item.id === id,
  )?.name ?? "Unknown";

function Loading() {
  return <p className="field-hint">Loading calendar…</p>;
}

function StatusPill({ status }: { status: EventStatus }) {
  if (status === "Published") return null;
  return (
    <span className={"pill " + statusPill[status]}>
      {status === "Proposed" ? "Awaiting approval" : status}
    </span>
  );
}

function CategoryTag({ category }: { category: EntryCategory }) {
  return (
    <span className="cal-tag" data-category={category}>
      <span className="cal-dot" aria-hidden="true" />
      {entryLabels[category]}
    </span>
  );
}

/* ---------- Event form ---------- */

type FormKind = "event" | "ptm" | "suggestion";

function eventForm({
  kind,
  records,
  actor,
  existing,
  date,
  category,
  onSaved,
}: {
  kind: FormKind;
  records: AcademicSchool;
  actor: AssignmentActor;
  existing?: SchoolEvent;
  date: string;
  category?: EventCategory;
  onSaved: (message: string) => void;
}): FormConfig {
  const fixed: EventCategory =
    existing?.category ??
    (kind === "ptm"
      ? "ptm"
      : kind === "suggestion"
        ? "class-activity"
        : (category ?? "school-event"));
  const admin = actor.role === "school-admin";
  const ownSections = teacherSectionIds(records, actor);
  const sections = records.sections
    .filter(
      (item) => item.status === "Active" && (admin || ownSections.has(item.id)),
    )
    .map((item) => ({
      value: item.id,
      label: item.grade + " · " + item.name,
    }));
  const years = records.years
    .filter((item) => item.status !== "Archived")
    .map((item) => ({ value: item.id, label: item.name }));
  const fields: FormField[] = [
    { name: "title", label: "Title" },
    ...(kind === "event"
      ? [
          {
            name: "category",
            label: "Category",
            type: "select" as const,
            options: eventCategories
              .filter((item) => item !== "ptm")
              .map((item) => ({ value: item, label: categoryLabels[item] })),
          },
        ]
      : []),
    {
      name: "description",
      label: "Description",
      type: "textarea",
      required: false,
    },
    { name: "year", label: "Academic year", type: "select", options: years },
    {
      name: "startDate",
      label: kind === "ptm" ? "Meeting date" : "Start date",
      type: "date",
    },
    ...(kind !== "ptm"
      ? [
          {
            name: "endDate",
            label: "End date",
            type: "date" as const,
            required: false,
            hint: "Leave blank for a one-day event.",
          },
          {
            name: "allDay",
            label: "All-day event (holidays are always all day)",
            type: "checkbox" as const,
          },
        ]
      : []),
    {
      name: "startTime",
      label: kind === "ptm" ? "First appointment starts" : "Start time",
      type: "time",
      required: kind === "ptm",
    },
    {
      name: "endTime",
      label: kind === "ptm" ? "Session ends" : "End time",
      type: "time",
      required: kind === "ptm",
    },
    ...(kind === "ptm"
      ? [
          {
            name: "duration",
            label: "Appointment length (minutes)",
            type: "number" as const,
            min: 5,
            max: 60,
          },
          {
            name: "teachers",
            label: "Teachers taking appointments",
            type: "checklist" as const,
            options: records.teachers
              .filter((item) => item.status === "Active")
              .map((item) => ({ value: item.id, label: item.name })),
          },
        ]
      : []),
    { name: "location", label: "Location or room", required: false },
    {
      name: "meetingUrl",
      label: "Online meeting link",
      type: "url",
      required: false,
      hint: "Optional. Must start with https://",
    },
    ...(admin && kind === "event"
      ? [
          {
            name: "audience",
            label: "Audience",
            type: "checklist" as const,
            options: audiences.map((item) => ({
              value: item,
              label:
                item === "parent"
                  ? "Parents"
                  : item[0].toUpperCase() + item.slice(1) + "s",
            })),
            hint: "Teacher meetings are always for teachers only.",
          },
        ]
      : []),
    {
      name: "sections",
      label: admin ? "Classes and sections" : "Your sections",
      type: "checklist",
      options: sections,
      hint: admin
        ? "Leave all unticked for the whole school."
        : "Choose at least one of your sections.",
    },
    ...(admin && existing?.status !== "Published"
      ? [
          {
            name: "publish",
            label: "Publish now and notify the audience",
            type: "checkbox" as const,
          },
        ]
      : []),
  ];
  const activeYear =
    records.years.find((item) => item.status === "Active")?.id ?? "";
  const values: FormConfig["values"] = existing
    ? {
        title: existing.title,
        category: existing.category,
        description: existing.description,
        year: existing.year,
        startDate: existing.startDate,
        endDate:
          existing.endDate === existing.startDate ? "" : existing.endDate,
        allDay: existing.allDay,
        startTime: existing.startTime,
        endTime: existing.endTime,
        duration: String(existing.ptm?.duration ?? 15),
        teachers: existing.ptm?.teachers ?? [],
        location: existing.location,
        meetingUrl: existing.meetingUrl,
        audience: existing.audience,
        sections: existing.sections,
      }
    : {
        category: fixed,
        year: activeYear,
        startDate: date,
        allDay: fixed === "holiday" || fixed === "deadline",
        startTime: kind === "ptm" ? "15:00" : "",
        endTime: kind === "ptm" ? "17:00" : "",
        duration: "15",
        teachers: [],
        audience: defaultAudience[fixed],
        sections: [],
      };
  const titles: Record<FormKind, string> = {
    event: existing
      ? "Edit event"
      : category === "holiday"
        ? "Set a school holiday"
        : category === "exam"
          ? "Schedule an examination"
          : "Create a calendar event",
    ptm: existing ? "Edit PTM session" : "Schedule a parent–teacher meeting",
    suggestion: existing ? "Edit suggestion" : "Suggest a class activity",
  };
  return {
    title: titles[kind],
    description:
      kind === "suggestion"
        ? "Your suggestion goes to the school administrator for approval before it appears on student and parent calendars."
        : kind === "ptm"
          ? "Appointment slots are created for each teacher between the start and end time. Parents of eligible students can then book them."
          : undefined,
    submitLabel: kind === "suggestion" ? "Send for approval" : "Save",
    fields,
    values,
    onSubmit(form) {
      const chosen =
        kind === "event" ? (text(form, "category") as EventCategory) : fixed;
      const startDate = text(form, "startDate");
      const input: EventInput = {
        id: existing?.id ?? newId(actor.school + "-event"),
        title: text(form, "title"),
        description: text(form, "description"),
        category: chosen,
        year: text(form, "year"),
        startDate,
        endDate:
          kind === "ptm" ? startDate : text(form, "endDate") || startDate,
        startTime: text(form, "startTime"),
        endTime: text(form, "endTime"),
        allDay: kind === "ptm" ? false : form.get("allDay") === "on",
        location: text(form, "location"),
        meetingUrl: text(form, "meetingUrl"),
        audience: !admin
          ? defaultAudience["class-activity"]
          : kind === "ptm"
            ? ["teacher", "parent"]
            : chosen === "teacher-meeting"
              ? ["teacher"]
              : (list(form, "audience") as EventInput["audience"]),
        sections: list(form, "sections"),
        publish: form.get("publish") === "on",
        ptm:
          kind === "ptm"
            ? {
                teachers: list(form, "teachers"),
                duration: Number(text(form, "duration")),
              }
            : undefined,
      };
      updateCommunicationState((state) =>
        saveEvent(state, records, actor, input, new Date()),
      );
      onSaved(
        kind === "suggestion"
          ? "Suggestion sent to the school administrator."
          : input.publish || existing?.status === "Published"
            ? "Event saved and published."
            : "Saved as a draft. Publish it when it's ready.",
      );
    },
  };
}

function reasonForm(
  title: string,
  description: string,
  submitLabel: string,
  apply: (reason: string) => void,
): FormConfig {
  return {
    title,
    description,
    submitLabel,
    fields: [
      {
        name: "reason",
        label: "Reason (optional)",
        type: "textarea",
        required: false,
      },
    ],
    onSubmit: (form) => apply(text(form, "reason")),
  };
}

/* ---------- Entry list ---------- */

function EntryButton({
  entry,
  records,
  onOpen,
}: {
  entry: CalendarEntry;
  records: AcademicSchool;
  onOpen: (key: string) => void;
}) {
  return (
    <button
      type="button"
      className="cal-entry"
      data-category={entry.category}
      data-cancelled={entry.status === "Cancelled" || undefined}
      onClick={() => onOpen(entry.key)}
    >
      <span className="cal-entry-bar" aria-hidden="true" />
      <span className="cal-entry-body">
        <strong>{entry.title}</strong>
        <span>
          {timeLabel(entry)}
          {entry.location ? " · " + entry.location : ""}
          {entry.sections.length
            ? " · " +
              entry.sections.map((id) => sectionName(records, id)).join(", ")
            : ""}
        </span>
        <span className="cal-entry-tags">
          <CategoryTag category={entry.category} />
          <StatusPill status={entry.status} />
        </span>
      </span>
    </button>
  );
}

function EntryList({
  entries,
  records,
  onOpen,
  empty,
}: {
  entries: CalendarEntry[];
  records: AcademicSchool;
  onOpen: (key: string) => void;
  empty: string;
}) {
  if (!entries.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="cal-entry-list">
      {entries.map((entry) => (
        <li key={entry.key}>
          <EntryButton entry={entry} records={records} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Views ---------- */

type DayKeyHandler = (
  event: KeyboardEvent<HTMLButtonElement>,
  day: string,
) => void;

function MonthView({
  selected,
  today,
  entries,
  onSelect,
  onOpen,
  onKey,
}: {
  selected: string;
  today: string;
  entries: CalendarEntry[];
  onSelect: (day: string) => void;
  onOpen: (key: string) => void;
  onKey: DayKeyHandler;
}) {
  const days = monthGrid(selected);
  const month = selected.slice(0, 7);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  return (
    <div className="cal-month" role="grid" aria-label={monthTitle(selected)}>
      <div className="cal-row cal-weekdays" role="row">
        {dayNames.map((day) => (
          <span role="columnheader" key={day} aria-label={day}>
            {day.slice(0, 3)}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div className="cal-row" role="row" key={week[0]}>
          {week.map((day) => {
            const items = entriesOn(entries, day);
            const isSelected = day === selected;
            return (
              <div
                role="gridcell"
                key={day}
                className="cal-day"
                aria-selected={isSelected}
                data-outside={day.slice(0, 7) !== month || undefined}
                data-today={day === today || undefined}
              >
                <button
                  type="button"
                  className="cal-day-number"
                  data-date={day}
                  tabIndex={isSelected ? 0 : -1}
                  aria-label={
                    longDate(day) +
                    (day === today ? ", today" : "") +
                    ", " +
                    (items.length
                      ? items.length +
                        (items.length === 1 ? " event" : " events")
                      : "no events")
                  }
                  aria-pressed={isSelected}
                  onClick={() => onSelect(day)}
                  onKeyDown={(event) => onKey(event, day)}
                >
                  {Number(day.slice(8))}
                </button>
                {items.length > 0 && (
                  <span className="cal-dots" aria-hidden="true">
                    {items.slice(0, 4).map((item) => (
                      <span
                        key={item.key}
                        className="cal-dot"
                        data-category={item.category}
                      />
                    ))}
                  </span>
                )}
                <ul className="cal-chips">
                  {items.slice(0, 3).map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        className="cal-chip"
                        data-category={item.category}
                        data-cancelled={
                          item.status === "Cancelled" || undefined
                        }
                        data-pending={
                          item.status === "Draft" ||
                          item.status === "Proposed" ||
                          undefined
                        }
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onOpen(item.key)}
                        title={item.title}
                      >
                        {!item.allDay && item.startDate === day && (
                          <span className="cal-chip-time">
                            {item.startTime}
                          </span>
                        )}
                        {item.title}
                        {item.status === "Cancelled" && (
                          <span className="sr-only"> (cancelled)</span>
                        )}
                      </button>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li>
                      <button
                        type="button"
                        className="cal-more"
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onSelect(day)}
                      >
                        +{items.length - 3} more
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({
  selected,
  today,
  entries,
  records,
  onSelect,
  onOpen,
  onKey,
}: {
  selected: string;
  today: string;
  entries: CalendarEntry[];
  records: AcademicSchool;
  onSelect: (day: string) => void;
  onOpen: (key: string) => void;
  onKey: DayKeyHandler;
}) {
  const start = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <div className="cal-week">
      {days.map((day, index) => {
        const items = entriesOn(entries, day);
        return (
          <section
            key={day}
            className="cal-week-day"
            aria-label={longDate(day)}
            data-today={day === today || undefined}
            data-selected={day === selected || undefined}
          >
            <button
              type="button"
              className="cal-week-head"
              data-date={day}
              tabIndex={day === selected ? 0 : -1}
              aria-pressed={day === selected}
              onClick={() => onSelect(day)}
              onKeyDown={(event) => onKey(event, day)}
            >
              <span>{dayNames[index].slice(0, 3)}</span>
              <strong>{Number(day.slice(8))}</strong>
            </button>
            {items.length ? (
              <ul className="cal-entry-list">
                {items.map((item) => (
                  <li key={item.key}>
                    <EntryButton
                      entry={item}
                      records={records}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cal-week-empty">No events</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AgendaView({
  selected,
  entries,
  records,
  onOpen,
}: {
  selected: string;
  entries: CalendarEntry[];
  records: AcademicSchool;
  onOpen: (key: string) => void;
}) {
  const end = addDays(selected, 59);
  const days: string[] = [];
  for (let day = selected; day <= end; day = addDays(day, 1))
    if (entriesOn(entries, day).length) days.push(day);
  if (!days.length)
    return (
      <EmptyState>
        Nothing scheduled in the 60 days from {formatDate(selected)}.
      </EmptyState>
    );
  return (
    <ol className="cal-agenda">
      {days.map((day) => (
        <li key={day}>
          <h3>{longDate(day)}</h3>
          <EntryList
            entries={entriesOn(entries, day)}
            records={records}
            onOpen={onOpen}
            empty=""
          />
        </li>
      ))}
    </ol>
  );
}

/* ---------- Event drawer ---------- */

function moduleLink(role: DemoRole, entry: CalendarEntry) {
  if (entry.source === "assignment")
    return {
      href: roleHref(role, role === "parent" ? "homework" : "assignments"),
      label: "Open assignments",
    };
  if (entry.source === "leave")
    return {
      href: roleHref(
        role,
        role === "school-admin" ? "leave-management" : "leave-requests",
      ),
      label: "Open leave",
    };
  if (entry.source === "exam" || entry.source === "test")
    return {
      href: roleHref(
        role,
        role === "school-admin"
          ? "results"
          : role === "teacher"
            ? "assessments"
            : role === "student"
              ? "quizzes"
              : "assessments",
      ),
      label: "Open assessments",
    };
}

function EntryDrawer({
  entry,
  records,
  onClose,
  actions,
}: {
  entry?: CalendarEntry;
  records: AcademicSchool;
  onClose: () => void;
  actions: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { role } = useDemo();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (entry && !element.open) element.showModal();
    if (!entry && element.open) element.close();
  }, [entry]);
  const event = entry?.event;
  const link = entry && moduleLink(role, entry);
  return (
    <dialog
      ref={dialog}
      className="cal-drawer"
      aria-labelledby="cal-drawer-title"
      onClose={onClose}
      onClick={(click) => {
        if (click.target === click.currentTarget) onClose();
      }}
    >
      {entry && (
        <div className="cal-drawer-body">
          <div className="dialog-heading">
            <div>
              <CategoryTag category={entry.category} />
              <h2
                id="cal-drawer-title"
                data-cancelled={entry.status === "Cancelled" || undefined}
              >
                {entry.title}
              </h2>
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
          <StatusPill status={entry.status} />
          {event?.status === "Cancelled" && (
            <p className="cal-cancel-note" role="note">
              <Ban size={16} aria-hidden="true" />
              This event was cancelled
              {event.cancelReason ? ": " + event.cancelReason : "."}
            </p>
          )}
          {event?.status === "Declined" && event.cancelReason && (
            <p className="cal-cancel-note" role="note">
              Declined: {event.cancelReason}
            </p>
          )}
          <dl className="detail-list cal-details">
            <div>
              <dt>
                <Clock size={15} aria-hidden="true" /> When
              </dt>
              <dd>
                {entry.startDate === entry.endDate
                  ? longDate(entry.startDate)
                  : formatDate(entry.startDate) +
                    " – " +
                    formatDate(entry.endDate)}
                <br />
                {entry.allDay
                  ? "All day"
                  : entry.startTime + "–" + entry.endTime}
              </dd>
            </div>
            {(entry.location || event?.meetingUrl) && (
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" /> Where
                </dt>
                <dd>
                  {entry.location}
                  {event?.meetingUrl && (
                    <>
                      {entry.location && <br />}
                      <a
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Online meeting link
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </>
                  )}
                </dd>
              </div>
            )}
            {event && (
              <div>
                <dt>
                  <UsersRound size={15} aria-hidden="true" /> Audience
                </dt>
                <dd>
                  {event.audience
                    .map((item) =>
                      item === "parent"
                        ? "Parents"
                        : item === "teacher"
                          ? "Teachers"
                          : "Students",
                    )
                    .join(", ")}
                  {" · "}
                  {event.sections.length
                    ? event.sections
                        .map((id) => sectionName(records, id))
                        .join(", ")
                    : "Whole school"}
                </dd>
              </div>
            )}
            {event && (
              <div>
                <dt>
                  <GraduationCap size={15} aria-hidden="true" /> Organiser
                </dt>
                <dd>
                  {event.organizerRole === "teacher"
                    ? personName(records, "teachers", event.organizerId) +
                      " (teacher)"
                    : "School administration"}
                </dd>
              </div>
            )}
            {event?.ptm && (
              <div>
                <dt>
                  <CalendarCheck size={15} aria-hidden="true" /> Appointments
                </dt>
                <dd>
                  {event.ptm.duration}-minute slots with{" "}
                  {event.ptm.teachers
                    .map((id) => personName(records, "teachers", id))
                    .join(", ")}
                </dd>
              </div>
            )}
            {!event && entry.sections.length > 0 && (
              <div>
                <dt>
                  <UsersRound size={15} aria-hidden="true" /> Class
                </dt>
                <dd>
                  {entry.sections
                    .map((id) => sectionName(records, id))
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
          {entry.description && (
            <p className="cal-description">{entry.description}</p>
          )}
          {!event && (
            <p className="field-hint">
              {entry.source === "ptm"
                ? "Your PTM appointment. Manage it from the PTM appointments tab."
                : "Shown from the linked module. Edit it there — calendar changes never alter the original record."}
            </p>
          )}
          <div className="cal-drawer-actions">
            {link && (
              <Link className="button button-outline" href={link.href}>
                {link.label}
              </Link>
            )}
            {actions}
          </div>
        </div>
      )}
    </dialog>
  );
}

/* ---------- PTM ---------- */

const slotLabels: Record<SlotState, string> = {
  available: "Available",
  yours: "Your booking",
  booked: "Booked",
  blocked: "Unavailable",
  past: "Passed",
  conflict: "Clashes with another booking",
  closed: "Closed",
};

const bookingPill: Record<PtmBooking["status"], string> = {
  Confirmed: "pill-success",
  Completed: "pill-muted",
  Cancelled: "pill-danger",
};

type PtmProps = {
  comm: CommunicationState;
  now: Date;
  run: (action: () => void, success: string) => boolean;
  show: (message: string) => void;
  setForm: (config?: FormConfig) => void;
};

function slotText(
  comm: CommunicationState,
  booking: PtmBooking,
  school: string,
) {
  const slot = comm.schools[
    school as keyof CommunicationState["schools"]
  ]?.ptmSlots.find((item) => item.id === booking.slotId);
  return slot
    ? longDate(slot.date) + ", " + slot.start + "–" + slot.end
    : "Slot removed";
}

function ParentPtm({ comm, now, run }: PtmProps) {
  const { records, actor, data } = useDemo();
  const [rescheduling, setRescheduling] = useState<string>();
  const school = comm.schools[actor.school];
  const student = viewerStudent(records, actor);
  if (!student || !school)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  const today = localCalendarDate(now);
  const sessions = eventsFor(comm, records, actor).filter(
    (item) =>
      item.category === "ptm" &&
      item.status === "Published" &&
      item.startDate >= today,
  );
  const bookings = bookingsFor(comm, actor).sort((a, b) =>
    slotText(comm, a, actor.school).localeCompare(
      slotText(comm, b, actor.school),
    ),
  );
  const childName = data.child?.name ?? "your child";
  return (
    <div className="ptm-layout">
      <SectionCard
        title="My appointments"
        description={"Bookings for " + childName}
      >
        {bookings.length ? (
          <ul className="ptm-bookings">
            {bookings.map((booking) => {
              const slot = school.ptmSlots.find(
                (item) => item.id === booking.slotId,
              );
              const changeable =
                booking.status === "Confirmed" &&
                !!slot &&
                slot.date + "T" + slot.start > localDateTime(now);
              return (
                <li key={booking.id}>
                  <div>
                    <strong>
                      {personName(records, "teachers", booking.teacherId)}
                    </strong>
                    <span>{slotText(comm, booking, actor.school)}</span>
                    <span className={"pill " + bookingPill[booking.status]}>
                      {booking.status}
                    </span>
                  </div>
                  {changeable && (
                    <div className="card-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        aria-pressed={rescheduling === booking.id}
                        onClick={() =>
                          setRescheduling(
                            rescheduling === booking.id
                              ? undefined
                              : booking.id,
                          )
                        }
                      >
                        <RefreshCw size={15} aria-hidden="true" />
                        {rescheduling === booking.id
                          ? "Stop rescheduling"
                          : "Reschedule"}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          if (
                            !confirmAction(
                              "Cancel this appointment? The slot will be released for other families.",
                            )
                          )
                            return;
                          if (
                            run(
                              () =>
                                updateCommunicationState((state) =>
                                  cancelBooking(
                                    state,
                                    records,
                                    actor,
                                    booking.id,
                                    new Date(),
                                  ),
                                ),
                              "Appointment cancelled. The teacher has been notified.",
                            )
                          )
                            setRescheduling(undefined);
                        }}
                      >
                        <Ban size={15} aria-hidden="true" />
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No PTM appointments booked for {childName}.</EmptyState>
        )}
        {rescheduling && (
          <p className="form-notice" role="note">
            Choose a new available time with the same teacher below. Your
            current slot is released once the new one is confirmed.
          </p>
        )}
      </SectionCard>
      {sessions.length ? (
        sessions.map((event) => {
          const teachers = ptmTeachersForStudent(
            records,
            actor.school,
            event,
            student,
          );
          return (
            <SectionCard
              key={event.id}
              title={event.title}
              description={
                longDate(event.startDate) +
                " · " +
                event.startTime +
                "–" +
                event.endTime +
                (event.location ? " · " + event.location : "")
              }
            >
              {event.description && (
                <p className="muted-copy">{event.description}</p>
              )}
              {teachers.length ? (
                teachers.map((teacher) => {
                  const mine = bookingsFor(comm, actor).find(
                    (item) =>
                      item.eventId === event.id &&
                      item.teacherId === teacher &&
                      item.status === "Confirmed",
                  );
                  const slots = school.ptmSlots.filter(
                    (item) =>
                      item.eventId === event.id && item.teacherId === teacher,
                  );
                  return (
                    <div className="ptm-teacher" key={teacher}>
                      <h3>
                        {personName(records, "teachers", teacher)}
                        {mine && (
                          <span className="pill pill-success">
                            Booked{" "}
                            {
                              slots.find((item) => item.id === mine.slotId)
                                ?.start
                            }
                          </span>
                        )}
                      </h3>
                      <ul
                        className="slot-grid"
                        aria-label={
                          "Slots with " +
                          personName(records, "teachers", teacher)
                        }
                      >
                        {slots.map((slot) => {
                          const state = slotState(school, slot, actor, now);
                          const reschedulingThis =
                            !!mine && rescheduling === mine.id;
                          const enabled =
                            state === "available" &&
                            (!mine || reschedulingThis);
                          return (
                            <li key={slot.id}>
                              <button
                                type="button"
                                className="slot"
                                data-state={state}
                                disabled={!enabled}
                                aria-label={
                                  slot.start +
                                  " to " +
                                  slot.end +
                                  ", " +
                                  slotLabels[state] +
                                  (state === "available" &&
                                  mine &&
                                  !reschedulingThis
                                    ? ". Use Reschedule to move your appointment"
                                    : "")
                                }
                                onClick={() => {
                                  if (mine) {
                                    if (
                                      run(
                                        () =>
                                          updateCommunicationState((value) =>
                                            rescheduleBooking(
                                              value,
                                              records,
                                              actor,
                                              mine.id,
                                              slot.id,
                                              new Date(),
                                            ),
                                          ),
                                        "Rescheduled to " +
                                          slot.start +
                                          ". The teacher has been notified.",
                                      )
                                    )
                                      setRescheduling(undefined);
                                  } else
                                    run(
                                      () =>
                                        updateCommunicationState((value) =>
                                          bookSlot(
                                            value,
                                            records,
                                            actor,
                                            slot.id,
                                            new Date(),
                                            newId(actor.school + "-booking"),
                                          ),
                                        ),
                                      "Booked " +
                                        slot.start +
                                        "–" +
                                        slot.end +
                                        ". A confirmation is in your notifications.",
                                    );
                                }}
                              >
                                <strong>{slot.start}</strong>
                                <small>{slotLabels[state]}</small>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              ) : (
                <EmptyState>
                  None of {childName}&apos;s teachers take appointments in this
                  session.
                </EmptyState>
              )}
            </SectionCard>
          );
        })
      ) : (
        <EmptyState>No upcoming PTM sessions for {childName}.</EmptyState>
      )}
    </div>
  );
}

function TeacherPtm({ comm, now, run, show, setForm }: PtmProps) {
  const { records, actor } = useDemo();
  const school = comm.schools[actor.school];
  const sessions = eventsFor(comm, records, actor).filter(
    (item) =>
      item.category === "ptm" && item.ptm?.teachers.includes(actor.person),
  );
  const today = localCalendarDate(now);
  const days = [...new Set(sessions.map((item) => item.startDate))].sort();
  const [picked, setPicked] = useState<string>();
  const day = picked ?? days.find((item) => item >= today) ?? days.at(-1);
  if (!school || !day)
    return <EmptyState>You have no PTM sessions scheduled.</EmptyState>;
  const bookings = bookingsFor(comm, actor);
  const slots = school.ptmSlots
    .filter((item) => item.teacherId === actor.person && item.date === day)
    .filter((item) => sessions.some((event) => event.id === item.eventId))
    .sort((a, b) => a.start.localeCompare(b.start));
  const booked = slots.filter((slot) =>
    bookings.some(
      (item) => item.slotId === slot.id && item.status !== "Cancelled",
    ),
  ).length;
  return (
    <SectionCard
      title="My PTM schedule"
      description={
        booked + " of " + slots.length + " slots booked on " + longDate(day)
      }
      actions={
        days.length > 1 ? (
          <label className="inline-label">
            Day
            <select
              value={day}
              onChange={(event) => setPicked(event.target.value)}
            >
              {days.map((item) => (
                <option key={item} value={item}>
                  {formatDate(item)}
                </option>
              ))}
            </select>
          </label>
        ) : undefined
      }
    >
      <div className="table-wrap">
        <table className="pro-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Student</th>
              <th scope="col">Parent</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const booking = bookings.find(
                (item) =>
                  item.slotId === slot.id && item.status !== "Cancelled",
              );
              const enrollment =
                booking &&
                records.enrollments.find(
                  (item) =>
                    item.student === booking.studentId &&
                    item.status === "Enrolled",
                );
              return (
                <tr key={slot.id}>
                  <td className="mono">
                    {slot.start}–{slot.end}
                  </td>
                  <td>
                    {booking ? (
                      <>
                        <strong>
                          {personName(records, "students", booking.studentId)}
                        </strong>
                        <span className="cell-note">
                          {enrollment
                            ? sectionName(records, enrollment.section)
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span className="muted-copy">
                        {slot.blocked ? "Unavailable" : "Open"}
                      </span>
                    )}
                  </td>
                  <td>
                    {booking
                      ? personName(records, "guardians", booking.parentId)
                      : "—"}
                  </td>
                  <td>
                    {booking ? (
                      <span className={"pill " + bookingPill[booking.status]}>
                        {booking.status}
                      </span>
                    ) : (
                      "—"
                    )}
                    {booking?.notes && (
                      <span className="cell-note">
                        <NotebookPen size={12} aria-hidden="true" /> Notes saved
                      </span>
                    )}
                  </td>
                  <td>
                    {booking && (
                      <div className="card-actions">
                        {booking.status === "Confirmed" && (
                          <button
                            type="button"
                            className="button button-outline"
                            onClick={() =>
                              run(
                                () =>
                                  updateCommunicationState((state) =>
                                    updateMeeting(
                                      state,
                                      actor,
                                      booking.id,
                                      { complete: true },
                                      new Date(),
                                    ),
                                  ),
                                "Meeting marked as completed.",
                              )
                            }
                          >
                            <Check size={15} aria-hidden="true" />
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() =>
                            setForm({
                              title: "Meeting notes",
                              description:
                                "Private to you. Parents, students and administrators can't see these notes.",
                              fields: [
                                {
                                  name: "notes",
                                  label:
                                    "Notes about " +
                                    personName(
                                      records,
                                      "students",
                                      booking.studentId,
                                    ),
                                  type: "textarea",
                                  required: false,
                                  hint: "Up to 1,000 characters. Demo only — don't enter real student information.",
                                },
                              ],
                              values: { notes: booking.notes },
                              onSubmit(form) {
                                updateCommunicationState((state) =>
                                  updateMeeting(
                                    state,
                                    actor,
                                    booking.id,
                                    { notes: text(form, "notes") },
                                    new Date(),
                                  ),
                                );
                                show("Notes saved. Only you can see them.");
                              },
                            })
                          }
                        >
                          <NotebookPen size={15} aria-hidden="true" />
                          Notes
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function AdminPtm({
  comm,
  run,
  onSchedule,
  onEdit,
}: PtmProps & {
  onSchedule: () => void;
  onEdit: (event: SchoolEvent) => void;
}) {
  const { records, actor } = useDemo();
  const school = comm.schools[actor.school];
  const sessions = (school?.events ?? [])
    .filter((item) => item.category === "ptm")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <div className="ptm-layout">
      <div className="academic-toolbar">
        <p className="muted-copy">
          Schedule PTM sessions, assign teachers and control which slots parents
          can book. Meeting notes stay private to each teacher.
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={onSchedule}
        >
          <CalendarPlus size={16} aria-hidden="true" />
          Schedule PTM
        </button>
      </div>
      {sessions.length ? (
        sessions.map((event) => {
          const bookings = school!.ptmBookings.filter(
            (item) => item.eventId === event.id,
          );
          const active = bookings.filter((item) => item.status !== "Cancelled");
          const slots = school!.ptmSlots.filter(
            (item) => item.eventId === event.id,
          );
          return (
            <SectionCard
              key={event.id}
              title={event.title}
              description={
                longDate(event.startDate) +
                (event.startTime
                  ? " · " + event.startTime + "–" + event.endTime
                  : "") +
                (event.ptm
                  ? " · " + event.ptm.duration + "-minute slots"
                  : "") +
                " · " +
                active.length +
                " of " +
                slots.length +
                " booked"
              }
              actions={
                <span className="card-actions">
                  <StatusPill status={event.status} />
                  {(event.status === "Draft" ||
                    event.status === "Published") && (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => onEdit(event)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                  )}
                </span>
              }
            >
              {event.ptm?.teachers.map((teacher) => (
                <div className="ptm-teacher" key={teacher}>
                  <h3>{personName(records, "teachers", teacher)}</h3>
                  <ul
                    className="slot-grid"
                    aria-label={
                      "Slots for " + personName(records, "teachers", teacher)
                    }
                  >
                    {slots
                      .filter((item) => item.teacherId === teacher)
                      .map((slot) => {
                        const booking = active.find(
                          (item) => item.slotId === slot.id,
                        );
                        const state = booking
                          ? "booked"
                          : slot.blocked
                            ? "blocked"
                            : "available";
                        return (
                          <li key={slot.id}>
                            <button
                              type="button"
                              className="slot"
                              data-state={state}
                              disabled={
                                !!booking || event.status === "Cancelled"
                              }
                              aria-pressed={slot.blocked}
                              aria-label={
                                slot.start +
                                ", " +
                                (booking
                                  ? "booked by the parent of " +
                                    personName(
                                      records,
                                      "students",
                                      booking.studentId,
                                    )
                                  : slot.blocked
                                    ? "withdrawn. Select to reopen"
                                    : "open. Select to withdraw")
                              }
                              onClick={() =>
                                run(
                                  () =>
                                    updateCommunicationState((value) =>
                                      toggleSlotBlocked(value, actor, slot.id),
                                    ),
                                  slot.blocked
                                    ? "Slot reopened for booking."
                                    : "Slot withdrawn from booking.",
                                )
                              }
                            >
                              <strong>{slot.start}</strong>
                              <small>
                                {booking
                                  ? personName(
                                      records,
                                      "students",
                                      booking.studentId,
                                    )
                                  : slot.blocked
                                    ? "Withdrawn"
                                    : "Open"}
                              </small>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
              {bookings.length > 0 && (
                <div className="table-wrap">
                  <table className="pro-table">
                    <caption className="sr-only">
                      Bookings for {event.title}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Teacher</th>
                        <th scope="col">Student</th>
                        <th scope="col">Parent</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id}>
                          <td className="mono">
                            {slots.find((item) => item.id === booking.slotId)
                              ?.start ?? "—"}
                          </td>
                          <td>
                            {personName(records, "teachers", booking.teacherId)}
                          </td>
                          <td>
                            {personName(records, "students", booking.studentId)}
                          </td>
                          <td>
                            {personName(records, "guardians", booking.parentId)}
                          </td>
                          <td>
                            <span
                              className={"pill " + bookingPill[booking.status]}
                            >
                              {booking.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          );
        })
      ) : (
        <EmptyState>
          No PTM sessions yet. Schedule one to open bookings.
        </EmptyState>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

type Tab = "calendar" | "ptm" | "approvals";
type View = "month" | "week" | "agenda";

export function SchoolCalendarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CalendarRoute />
    </Suspense>
  );
}

function CalendarRoute() {
  const params = useSearchParams();
  return (
    <SchoolCalendar
      key={params.toString()}
      eventParam={params.get("event") ?? undefined}
      tabParam={params.get("tab") ?? undefined}
    />
  );
}

function SchoolCalendar({
  eventParam,
  tabParam,
}: {
  eventParam?: string;
  tabParam?: string;
}) {
  const { role, records, actor, school, data, setChild } = useDemo();
  const comm = useCommunicationState();
  const learning = useLearningState();
  const leave = useLeaveSchool(actor.school);
  const now = useNow(60_000);
  const toast = useToast();
  const tabs: Tab[] =
    role === "school-admin"
      ? ["calendar", "ptm", "approvals"]
      : role === "student"
        ? ["calendar"]
        : ["calendar", "ptm"];
  const linked = eventParam
    ? comm.schools[actor.school]?.events.find((item) => item.id === eventParam)
    : undefined;
  const [tab, setTab] = useState<Tab>(
    tabs.includes(tabParam as Tab) ? (tabParam as Tab) : "calendar",
  );
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<string | undefined>(linked?.startDate);
  const [hidden, setHidden] = useState<EntryCategory[]>([]);
  const [openKey, setOpenKey] = useState<string | undefined>(
    linked ? "event:" + linked.id : undefined,
  );
  const [form, setForm] = useState<FormConfig>();
  const grid = useRef<HTMLDivElement>(null);

  if (!now) return <Loading />;
  if (role === "parent" && !data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );

  const today = localCalendarDate(now);
  const selected = cursor ?? today;
  const all = calendarEntries(comm, learning, records, actor, leave);
  const entries = all.filter((item) => !hidden.includes(item.category));
  const open = all.find((item) => item.key === openKey);
  const year = records.years.find((item) => item.status === "Active");
  const comms = comm.schools[actor.school];
  const proposals = (comms?.events ?? []).filter(
    (item) => item.status === "Proposed",
  );
  const drafts = (comms?.events ?? []).filter(
    (item) => item.status === "Draft",
  );
  const mySuggestions =
    role === "teacher"
      ? (comms?.events ?? []).filter(
          (item) =>
            item.organizerRole === "teacher" &&
            item.organizerId === actor.person,
        )
      : [];
  const upcoming = all
    .filter(
      (item) =>
        item.endDate >= today &&
        item.status !== "Cancelled" &&
        item.status !== "Declined" &&
        item.status !== "Draft",
    )
    .slice(0, 6);

  const update = (
    change: (state: CommunicationState) => CommunicationState,
    success: string,
  ) => toast.run(() => updateCommunicationState(change), success);
  const openForm = (
    kind: FormKind,
    existing?: SchoolEvent,
    category?: EventCategory,
  ) =>
    setForm(
      eventForm({
        kind,
        records,
        actor,
        existing,
        date: selected >= today ? selected : today,
        category,
        onSaved: (message) => toast.show(message),
      }),
    );
  const step = (direction: number) =>
    setCursor(
      view === "week"
        ? addDays(selected, 7 * direction)
        : shiftMonth(selected, direction),
    );
  const focusDate = (day: string) =>
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>('[data-date="' + day + '"]')
        ?.focus(),
    );
  const onKey: DayKeyHandler = (event, day) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: view === "month" ? -7 : 0,
      ArrowDown: view === "month" ? 7 : 0,
    };
    let next: string | undefined;
    if (moves[event.key]) next = addDays(day, moves[event.key]);
    else if (event.key === "Home") next = startOfWeek(day);
    else if (event.key === "End") next = addDays(startOfWeek(day), 6);
    else if (event.key === "PageUp")
      next = view === "week" ? addDays(day, -7) : shiftMonth(day, -1);
    else if (event.key === "PageDown")
      next = view === "week" ? addDays(day, 7) : shiftMonth(day, 1);
    if (!next) return;
    event.preventDefault();
    setCursor(next);
    focusDate(next);
  };

  const eventActions = (entry?: CalendarEntry) => {
    const event = entry?.event;
    if (!entry) return null;
    if (
      entry.source === "ptm" ||
      (event?.category === "ptm" &&
        role === "parent" &&
        event.status === "Published")
    )
      return (
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setOpenKey(undefined);
            setTab("ptm");
          }}
        >
          <CalendarCheck size={15} aria-hidden="true" />
          {role === "parent" && entry.source !== "ptm"
            ? "Book an appointment"
            : "Open PTM appointments"}
        </button>
      );
    if (!event) return null;
    if (role === "school-admin") {
      const editable =
        event.status === "Draft" ||
        event.status === "Published" ||
        event.status === "Proposed";
      return (
        <>
          {editable && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setOpenKey(undefined);
                openForm(event.category === "ptm" ? "ptm" : "event", event);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
          )}
          {(event.status === "Draft" || event.status === "Proposed") && (
            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                update(
                  (state) =>
                    publishEvent(state, records, actor, event.id, new Date()),
                  "Published. Everyone in the audience has been notified.",
                )
              }
            >
              <Send size={15} aria-hidden="true" />
              {event.status === "Proposed" ? "Approve & publish" : "Publish"}
            </button>
          )}
          {event.status === "Proposed" && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setOpenKey(undefined);
                setForm(
                  reasonForm(
                    "Decline suggestion",
                    "The teacher will be notified.",
                    "Decline",
                    (reason) => {
                      updateCommunicationState((state) =>
                        declineEvent(
                          state,
                          actor,
                          event.id,
                          reason,
                          new Date(),
                        ),
                      );
                      toast.show("Suggestion declined.");
                    },
                  ),
                );
              }}
            >
              <X size={15} aria-hidden="true" />
              Decline
            </button>
          )}
          {(event.status === "Draft" || event.status === "Published") && (
            <button
              type="button"
              className="button button-outline danger"
              onClick={() => {
                setOpenKey(undefined);
                setForm(
                  reasonForm(
                    "Cancel " + event.title,
                    event.publishedAt
                      ? "Everyone who can see this event will be notified." +
                          (event.category === "ptm"
                            ? " Booked PTM appointments are cancelled too."
                            : "")
                      : "This draft was never published, so nobody is notified.",
                    "Cancel event",
                    (reason) => {
                      updateCommunicationState((state) =>
                        cancelEvent(
                          state,
                          records,
                          actor,
                          event.id,
                          reason,
                          new Date(),
                        ),
                      );
                      toast.show("Event cancelled.");
                    },
                  ),
                );
              }}
            >
              <Ban size={15} aria-hidden="true" />
              Cancel event
            </button>
          )}
          {(event.status === "Draft" || event.status === "Declined") &&
            !event.publishedAt && (
              <button
                type="button"
                className="button button-outline danger"
                onClick={() => {
                  if (
                    !confirmAction(
                      "Delete " + event.title + "? This can't be undone.",
                    )
                  )
                    return;
                  if (
                    update(
                      (state) => deleteEvent(state, actor, event.id),
                      "Deleted.",
                    )
                  )
                    setOpenKey(undefined);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                Delete
              </button>
            )}
        </>
      );
    }
    if (
      role === "teacher" &&
      event.organizerId === actor.person &&
      event.organizerRole === "teacher"
    ) {
      return (
        <>
          {event.status === "Proposed" && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setOpenKey(undefined);
                openForm("suggestion", event);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              Edit
            </button>
          )}
          {(event.status === "Proposed" || event.status === "Declined") && (
            <button
              type="button"
              className="button button-outline danger"
              onClick={() => {
                if (!confirmAction("Withdraw this suggestion?")) return;
                if (
                  update(
                    (state) => deleteEvent(state, actor, event.id),
                    "Suggestion withdrawn.",
                  )
                )
                  setOpenKey(undefined);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Withdraw
            </button>
          )}
        </>
      );
    }
    return null;
  };

  const title =
    view === "week"
      ? formatDate(startOfWeek(selected)) +
        " – " +
        formatDate(addDays(startOfWeek(selected), 6))
      : view === "agenda"
        ? "From " + formatDate(selected)
        : monthTitle(selected);
  const stepLabel = view === "week" ? "week" : "month";

  return (
    <div className="cal-page">
      <div className="cal-context">
        <span className="pill pill-muted">{school.name}</span>
        <span className="pill pill-muted">
          Academic year {year?.name ?? "—"}
        </span>
        {role === "parent" && data.children.length > 0 && (
          <label className="inline-label">
            Child
            <select
              value={data.child?.id}
              onChange={(event) => setChild(event.target.value)}
            >
              {data.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="field-hint">
          Local demo · changes are saved in this browser only.
        </span>
      </div>

      {tabs.length > 1 && (
        <div
          className="segmented-tabs"
          role="tablist"
          aria-label="Calendar sections"
        >
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
            >
              {item === "calendar"
                ? "Calendar"
                : item === "ptm"
                  ? "PTM appointments"
                  : "Approvals & drafts"}
              {item === "approvals" && proposals.length + drafts.length > 0 && (
                <span className="tab-count">
                  {proposals.length + drafts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === "calendar" && (
        <div className="cal-layout">
          <section className="dash-card cal-main" aria-labelledby="cal-title">
            <div className="cal-toolbar">
              <div className="cal-nav">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setCursor(today);
                    focusDate(today);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Previous " + stepLabel}
                  onClick={() => step(-1)}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={"Next " + stepLabel}
                  onClick={() => step(1)}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
                <h2 id="cal-title" aria-live="polite">
                  {title}
                </h2>
              </div>
              <div className="cal-toolbar-end">
                <div
                  className="segmented-tabs"
                  role="group"
                  aria-label="Calendar view"
                >
                  {(["month", "week", "agenda"] as View[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={view === item}
                      onClick={() => setView(item)}
                    >
                      {item[0].toUpperCase() + item.slice(1)}
                    </button>
                  ))}
                </div>
                {role === "school-admin" && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => openForm("event")}
                  >
                    <CalendarPlus size={16} aria-hidden="true" />
                    New event
                  </button>
                )}
                {role === "teacher" && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => openForm("suggestion")}
                  >
                    <Lightbulb size={16} aria-hidden="true" />
                    Suggest activity
                  </button>
                )}
              </div>
            </div>
            {role === "school-admin" && (
              <div
                className="cal-quick"
                role="group"
                aria-label="Quick scheduling"
              >
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openForm("event", undefined, "holiday")}
                >
                  <Palmtree size={14} aria-hidden="true" /> Set holiday
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openForm("event", undefined, "exam")}
                >
                  <GraduationCap size={14} aria-hidden="true" /> Schedule exam
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => openForm("ptm")}
                >
                  <UsersRound size={14} aria-hidden="true" /> Schedule PTM
                </button>
              </div>
            )}
            <div
              className="cal-filters"
              role="group"
              aria-label="Show categories"
            >
              {entryCategories.map((category) => {
                const count = all.filter(
                  (item) => item.category === category,
                ).length;
                return (
                  <button
                    key={category}
                    type="button"
                    className="cal-filter"
                    data-category={category}
                    aria-pressed={!hidden.includes(category)}
                    onClick={() =>
                      setHidden((current) =>
                        current.includes(category)
                          ? current.filter((item) => item !== category)
                          : [...current, category],
                      )
                    }
                  >
                    <span className="cal-dot" aria-hidden="true" />
                    {entryLabels[category]}
                    <span className="tab-count">{count}</span>
                  </button>
                );
              })}
              {hidden.length > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHidden([])}
                >
                  Show all
                </button>
              )}
            </div>
            <div ref={grid}>
              {view === "month" && (
                <MonthView
                  selected={selected}
                  today={today}
                  entries={entries}
                  onSelect={setCursor}
                  onOpen={setOpenKey}
                  onKey={onKey}
                />
              )}
              {view === "week" && (
                <WeekView
                  selected={selected}
                  today={today}
                  entries={entries}
                  records={records}
                  onSelect={setCursor}
                  onOpen={setOpenKey}
                  onKey={onKey}
                />
              )}
              {view === "agenda" && (
                <AgendaView
                  selected={selected}
                  entries={entries}
                  records={records}
                  onOpen={setOpenKey}
                />
              )}
            </div>
          </section>
          <aside className="cal-side" aria-label="Day and upcoming events">
            <SectionCard
              title={longDate(selected)}
              description={selected === today ? "Today" : "Selected day"}
            >
              <EntryList
                entries={entriesOn(entries, selected)}
                records={records}
                onOpen={setOpenKey}
                empty="Nothing scheduled."
              />
            </SectionCard>
            <SectionCard
              title="Upcoming"
              description="The next events on your calendar"
            >
              <EntryList
                entries={upcoming}
                records={records}
                onOpen={setOpenKey}
                empty="Nothing coming up."
              />
            </SectionCard>
            {role === "teacher" && (
              <SectionCard
                title="My suggestions"
                description="Class activities you proposed"
              >
                {mySuggestions.length ? (
                  <ul className="cal-entry-list">
                    {mySuggestions.map((event) => (
                      <li key={event.id}>
                        <EntryButton
                          entry={
                            all.find(
                              (item) => item.key === "event:" + event.id,
                            ) ?? {
                              key: "event:" + event.id,
                              source: "event",
                              sourceId: event.id,
                              category: event.category,
                              title: event.title,
                              description: event.description,
                              startDate: event.startDate,
                              endDate: event.endDate,
                              startTime: event.startTime,
                              endTime: event.endTime,
                              allDay: event.allDay,
                              location: event.location,
                              status: event.status,
                              sections: event.sections,
                              event,
                            }
                          }
                          records={records}
                          onOpen={setOpenKey}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>No suggestions yet.</EmptyState>
                )}
              </SectionCard>
            )}
            {role === "school-admin" && proposals.length > 0 && (
              <SectionCard
                title="Awaiting approval"
                description={proposals.length + " teacher suggestion(s)"}
              >
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setTab("approvals")}
                >
                  Review suggestions
                </button>
              </SectionCard>
            )}
          </aside>
        </div>
      )}

      {tab === "ptm" && role === "parent" && (
        <ParentPtm
          comm={comm}
          now={now}
          run={toast.run}
          show={toast.show}
          setForm={setForm}
        />
      )}
      {tab === "ptm" && role === "teacher" && (
        <TeacherPtm
          comm={comm}
          now={now}
          run={toast.run}
          show={toast.show}
          setForm={setForm}
        />
      )}
      {tab === "ptm" && role === "school-admin" && (
        <AdminPtm
          comm={comm}
          now={now}
          run={toast.run}
          show={toast.show}
          setForm={setForm}
          onSchedule={() => openForm("ptm")}
          onEdit={(event) => openForm("ptm", event)}
        />
      )}

      {tab === "approvals" && role === "school-admin" && (
        <div className="ptm-layout">
          <SectionCard
            title="Teacher suggestions"
            description="Class activities proposed by teachers. Approving publishes them to the selected sections."
          >
            {proposals.length ? (
              <ul className="cal-entry-list">
                {proposals.map((event) => (
                  <li key={event.id} className="cal-approval">
                    <EntryButton
                      entry={all.find(
                        (item) => item.key === "event:" + event.id,
                      )!}
                      records={records}
                      onOpen={setOpenKey}
                    />
                    <span className="field-hint">
                      Suggested by{" "}
                      {personName(records, "teachers", event.organizerId)}
                    </span>
                    <div className="card-actions">
                      {eventActions(
                        all.find((item) => item.key === "event:" + event.id),
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No suggestions are waiting.</EmptyState>
            )}
          </SectionCard>
          <SectionCard
            title="Drafts"
            description="Only administrators can see drafts until they are published."
          >
            {drafts.length ? (
              <ul className="cal-entry-list">
                {drafts.map((event) => (
                  <li key={event.id} className="cal-approval">
                    <EntryButton
                      entry={all.find(
                        (item) => item.key === "event:" + event.id,
                      )!}
                      records={records}
                      onOpen={setOpenKey}
                    />
                    <div className="card-actions">
                      {eventActions(
                        all.find((item) => item.key === "event:" + event.id),
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No drafts.</EmptyState>
            )}
          </SectionCard>
        </div>
      )}

      <EntryDrawer
        entry={open}
        records={records}
        onClose={() => setOpenKey(undefined)}
        actions={eventActions(open)}
      />
      <FormDialog config={form} onClose={() => setForm(undefined)} />
      {toast.element}
    </div>
  );
}

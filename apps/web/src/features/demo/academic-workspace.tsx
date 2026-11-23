"use client";

import { useRef, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { attendancePercentage } from "@/services/attendance-model";
import {
  removeAcademicRecord,
  saveAcademicRecord,
  visibleAnnouncements,
  type AcademicSchool,
  type AcademicTable,
  type Actor,
  type Entry,
} from "@/services/academic-model";
import { updateAcademicState } from "@/services/academic-store";
import { Plus } from "lucide-react";

type Field = [
  key: string,
  label: string,
  source?: AcademicTable | string[],
  optional?: boolean,
];
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const statuses = (...values: string[]) => values;
const config: Record<
  AcademicTable,
  { title: string; fields: Field[]; removable?: boolean }
> = {
  years: {
    title: "Academic years",
    fields: [
      ["name", "Year identifier"],
      ["start", "Start date"],
      ["end", "End date"],
      ["status", "Status", statuses("Draft", "Active", "Archived")],
    ],
  },
  sections: {
    title: "Classes and sections",
    fields: [
      ["grade", "Class / grade"],
      ["name", "Section"],
      ["year", "Academic year", "years"],
      ["capacity", "Capacity"],
      ["coordinator", "Coordinator", "teachers", true],
      ["status", "Status", statuses("Active", "Archived")],
    ],
  },
  subjects: {
    title: "Subjects",
    fields: [
      ["name", "Subject"],
      ["code", "Code"],
    ],
  },
  teachers: {
    title: "Teachers",
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["availability", "Availability"],
      ["status", "Status", statuses("Active", "Inactive")],
    ],
  },
  allocations: {
    title: "Teaching allocations",
    fields: [
      ["teacher", "Teacher", "teachers"],
      ["subject", "Subject", "subjects"],
      ["section", "Section", "sections"],
    ],
  },
  students: {
    title: "Students",
    fields: [
      ["name", "Name"],
      ["code", "Student number"],
    ],
  },
  enrollments: {
    title: "Enrollments",
    fields: [
      ["student", "Student", "students"],
      ["section", "Section", "sections"],
      ["status", "Status", statuses("Enrolled", "Withdrawn")],
    ],
  },
  guardians: {
    title: "Parents and guardians",
    fields: [
      ["name", "Name"],
      ["email", "Email"],
    ],
  },
  links: {
    title: "Guardian relationships",
    fields: [
      ["guardian", "Guardian", "guardians"],
      ["student", "Student", "students"],
      [
        "relationship",
        "Relationship",
        statuses("Parent", "Guardian", "Grandparent", "Other"),
      ],
      ["primary", "Primary contact", statuses("No", "Yes")],
    ],
    removable: true,
  },
  sessions: {
    title: "Timetable",
    fields: [
      ["allocation", "Teaching allocation", "allocations"],
      ["day", "Day", days],
      ["start", "Start time"],
      ["end", "End time"],
      ["room", "Room or online session"],
    ],
    removable: true,
  },
  announcements: {
    title: "Announcements",
    fields: [
      ["name", "Title"],
      ["message", "Message"],
      ["audience", "Audience", statuses("All", "teacher", "student", "parent")],
      ["section", "Section", "sections", true],
      ["status", "Status", statuses("Draft", "Published")],
    ],
    removable: true,
  },
};

function label(
  school: AcademicSchool,
  table: AcademicTable,
  id: string,
): string {
  const row = school[table].find((item) => item.id === id);
  if (!row) return "—";
  if ("grade" in row)
    return (
      row.grade +
      " · " +
      row.name +
      " (" +
      label(school, "years", row.year) +
      ")"
    );
  if ("teacher" in row)
    return [
      label(school, "subjects", row.subject),
      label(school, "teachers", row.teacher),
      label(school, "sections", row.section),
    ].join(" · ");
  return "name" in row ? row.name : id;
}

function fieldType(key: string, table: AcademicTable) {
  if (key === "start" || key === "end")
    return table === "sessions" ? "time" : "date";
  if (key === "capacity") return "number";
  return key === "email" ? "email" : "text";
}

export const academicConfig = config;

/** CRUD workspace for one or more academic tables (shown as tabs). */
export function AcademicWorkspace({
  actor,
  school,
  tables,
}: {
  actor: Actor;
  school: AcademicSchool;
  tables: AcademicTable[];
}) {
  const [table, setTable] = useState<AcademicTable>(tables[0]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [editing, setEditing] = useState<Record<string, string>>();
  const [detail, setDetail] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<string>();
  const formDialog = useRef<HTMLDialogElement>(null);
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const definition = config[table];
  const choices = definition.fields.find(([key]) => key === "status")?.[2];
  const display = (row: Record<string, string>, [key, , source]: Field) =>
    typeof source === "string" ? label(school, source, row[key]) : row[key];
  const records = (school[table] as Record<string, string>[])
    .filter(
      (row) =>
        (!status || row.status === status) &&
        (table !== "sessions" ||
          !section ||
          school.allocations.some(
            (item) => item.id === row.allocation && item.section === section,
          )) &&
        definition.fields.some((field) =>
          display(row, field)
            ?.toLowerCase()
            .includes(query.trim().toLowerCase()),
        ),
    )
    .sort((a, b) =>
      display(a, definition.fields[0]).localeCompare(
        display(b, definition.fields[0]),
      ),
    );
  const selected = (school[table] as Record<string, string>[]).find(
    (item) => item.id === detail,
  );

  function openForm(row?: Record<string, string>) {
    setEditing(row ?? {});
    setFormVersion((version) => version + 1);
    setError("");
    formDialog.current?.showModal();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    const id = editing?.id ?? crypto.randomUUID();
    try {
      updateAcademicState((state) =>
        saveAcademicRecord(state, actor, table, { ...fields, id } as Entry<
          typeof table
        >),
      );
      setNotice("Record saved.");
      formDialog.current?.close();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function confirm() {
    try {
      if (
        confirmation &&
        (table === "sessions" || table === "links" || table === "announcements")
      ) {
        const id = confirmation;
        updateAcademicState((state) =>
          removeAcademicRecord(state, actor, table, id),
        );
        setNotice("Record removed.");
      }
      setDetail(undefined);
      confirmDialog.current?.close();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function ask(id: string) {
    setError("");
    setConfirmation(id);
    confirmDialog.current?.showModal();
  }

  return (
    <Card className="dash-card academic-workspace">
      {tables.length > 1 && (
        <nav className="segmented-tabs" aria-label="Record types">
          {tables.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === table}
              onClick={() => {
                setTable(key);
                setQuery("");
                setStatus("");
                setSection("");
                setDetail(undefined);
                setNotice("");
              }}
            >
              {config[key].title}
              <span className="tab-count">{school[key].length}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="academic-toolbar">
        <div>
          <h2 className="workspace-title">{definition.title}</h2>
          <p className="workspace-subtitle">
            {records.length} of {school[table].length} records
          </p>
        </div>
        <label>
          Search{" "}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Search " + definition.title.toLowerCase()}
          />
        </label>
        {Array.isArray(choices) && (
          <label>
            Status{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {choices.map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
          </label>
        )}
        {table === "sessions" && (
          <label>
            Section{" "}
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              <option value="">All sections</option>
              {school.sections.map((item) => (
                <option value={item.id} key={item.id}>
                  {label(school, "sections", item.id)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="button button-primary"
          onClick={() => openForm()}
        >
          <Plus size={16} aria-hidden="true" />
          Add record
        </button>
      </div>
      <p role="status">{notice}</p>
      {table === "sessions" && (
        <div className="academic-week" aria-label="Weekly timetable">
          {days.map((day) => (
            <div key={day}>
              <strong>{day}</strong>
              {records
                .filter((row) => row.day === day)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => setDetail(row.id)}
                  >
                    {row.start}–{row.end}
                    <br />
                    {label(school, "allocations", row.allocation)}
                    <br />
                    {row.room}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="academic-table">
        <table>
          <caption className="sr-only">{definition.title}</caption>
          <thead>
            <tr>
              {definition.fields.map(([key, title]) => (
                <th key={key} scope="col">
                  {title}
                </th>
              ))}
              {table === "sections" && <th scope="col">Enrolled</th>}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <tr key={row.id}>
                {definition.fields.map((field) => (
                  <td key={field[0]}>{display(row, field) || "—"}</td>
                ))}
                {table === "sections" && (
                  <td>
                    {
                      school.enrollments.filter(
                        (item) =>
                          item.section === row.id && item.status === "Enrolled",
                      ).length
                    }
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDetail(row.id)}
                  >
                    View
                  </button>{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => openForm(row)}
                  >
                    Edit
                  </button>{" "}
                  {definition.removable && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => ask(row.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!records.length && <p>No matching records.</p>}
      {selected && (
        <section className="academic-detail" aria-label="Record details">
          <div className="academic-toolbar">
            <h3>Record details</h3>
            <button
              className="text-button"
              type="button"
              onClick={() => setDetail(undefined)}
            >
              Close details
            </button>
          </div>
          <dl>
            {definition.fields.map((field) => (
              <div key={field[0]}>
                <dt>{field[1]}</dt>
                <dd>{display(selected, field) || "—"}</dd>
              </div>
            ))}
          </dl>
          {(table === "teachers" ||
            table === "sections" ||
            table === "subjects") && (
            <ul>
              {school.allocations
                .filter(
                  (item) =>
                    item[
                      table === "teachers"
                        ? "teacher"
                        : table === "subjects"
                          ? "subject"
                          : "section"
                    ] === selected.id,
                )
                .map((item) => (
                  <li key={item.id}>
                    {label(school, "allocations", item.id)}
                    {school.sessions
                      .filter((session) => session.allocation === item.id)
                      .map((session) => (
                        <div key={session.id}>
                          {session.day} {session.start}–{session.end} ·{" "}
                          {session.room}
                        </div>
                      ))}
                  </li>
                ))}
            </ul>
          )}
          {(table === "guardians" || table === "students") && (
            <ul>
              {school.links
                .filter(
                  (item) =>
                    item[table === "guardians" ? "guardian" : "student"] ===
                    selected.id,
                )
                .map((item) => (
                  <li key={item.id}>
                    {table === "guardians"
                      ? label(school, "students", item.student)
                      : label(school, "guardians", item.guardian)}{" "}
                    · {item.relationship}
                    {item.primary === "Yes" && " · Primary contact"}
                  </li>
                ))}
              {table === "students" &&
                school.enrollments
                  .filter((item) => item.student === selected.id)
                  .map((item) => (
                    <li key={item.id}>
                      {label(school, "sections", item.section)} · {item.status}
                    </li>
                  ))}
            </ul>
          )}
          {table === "students" &&
            (() => {
              const attendance = attendancePercentage(
                school.attendance.flatMap((session) =>
                  session.marks[selected.id]
                    ? [
                        {
                          ...session,
                          marks: { [selected.id]: session.marks[selected.id] },
                        },
                      ]
                    : [],
                ),
              );
              const grades = school.submissions.filter(
                (item) =>
                  item.student === selected.id && item.status === "Graded",
              );
              return (
                <section aria-label="Academic overview">
                  <h4>Academic overview</h4>
                  <p>
                    {attendance === undefined
                      ? "No attendance recorded"
                      : attendance + "% recorded attendance"}
                  </p>
                  {grades.length ? (
                    <ul>
                      {grades.map((grade) => {
                        const assignment = school.assignments.find(
                          (item) => item.id === grade.assignment,
                        );
                        return (
                          <li key={grade.assignment}>
                            {assignment?.title} · {grade.marks}/
                            {assignment?.maximum} · {grade.feedback}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>No graded assignments yet.</p>
                  )}
                </section>
              );
            })()}
          {table === "announcements" && (
            <ul>
              {(["teacher", "student", "parent"] as const).map((role) => {
                const people =
                  role === "teacher"
                    ? school.teachers
                    : role === "student"
                      ? school.students
                      : school.links;
                const visible = people.some((person) =>
                  "guardian" in person
                    ? visibleAnnouncements(
                        school,
                        role,
                        person.guardian,
                        person.student,
                      ).some((item) => item.id === selected.id)
                    : visibleAnnouncements(school, role, person.id).some(
                        (item) => item.id === selected.id,
                      ),
                );
                return (
                  <li key={role}>
                    {role[0].toUpperCase() + role.slice(1)} preview ·{" "}
                    {visible ? selected.message : "Hidden for this audience"}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <dialog
        ref={formDialog}
        className="search-dialog academic-dialog"
        aria-labelledby="academic-form-title"
      >
        <h2 id="academic-form-title">
          {editing?.id ? "Edit record" : "Add record"}
        </h2>
        {editing && (
          <form onSubmit={save} key={formVersion}>
            {definition.fields.map(([key, title, source, optional]) => (
              <label key={key}>
                {title}
                {source ? (
                  <select
                    name={key}
                    required={!optional}
                    defaultValue={editing[key] ?? ""}
                  >
                    <option value="">
                      {optional ? "None" : "Select " + title.toLowerCase()}
                    </option>
                    {Array.isArray(source)
                      ? source.map((item) => <option key={item}>{item}</option>)
                      : school[source].map(({ id }) => (
                          <option key={id} value={id}>
                            {label(school, source, id)}
                          </option>
                        ))}
                  </select>
                ) : key === "message" ? (
                  <textarea name={key} defaultValue={editing[key]} required />
                ) : (
                  <input
                    name={key}
                    type={fieldType(key, table)}
                    defaultValue={editing[key]}
                    required={!optional && key !== "availability"}
                  />
                )}
              </label>
            ))}
            {error && <p role="alert">{error}</p>}
            <div className="academic-toolbar">
              <button
                type="button"
                className="button button-outline"
                onClick={() => formDialog.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="button button-outline">
                Save record
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={confirmDialog}
        className="search-dialog academic-dialog"
        aria-labelledby="academic-confirm-title"
      >
        <h2 id="academic-confirm-title">Remove record?</h2>
        <p>Remove this record from the demo school.</p>
        {error && <p role="alert">{error}</p>}
        <div className="academic-toolbar">
          <button
            type="button"
            className="button button-outline"
            onClick={() => confirmDialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={confirm}
          >
            Confirm
          </button>
        </div>
      </dialog>
    </Card>
  );
}

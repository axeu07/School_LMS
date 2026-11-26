"use client";

import { useState } from "react";
import {
  Bandage,
  CircleCheck,
  Droplet,
  HeartPulse,
  Pill as PillIcon,
  Plus,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Trash2,
} from "lucide-react";
import {
  acknowledgeIncident,
  bloodGroups,
  healthOf,
  incidentKinds,
  newId,
  reportIncident,
  saveHealth,
  type HealthProfile,
  type Incident,
} from "@/services/preschool-model";
import { updatePreschoolState } from "@/services/preschool-store";
import {
  FormDialog,
  type FormConfig,
  confirmAction,
} from "@/features/demo/form-dialog";
import { formatDate } from "@/features/demo/format";
import {
  Avatar,
  Card,
  ClassFilter,
  Empty,
  Modal,
  Note,
  Pill,
  Ready,
  Stat,
  dayLabel,
  friendlyTime,
  usePreschool,
  type Preschool,
} from "./ui";

export function HealthPage() {
  const p = usePreschool();
  return (
    <Ready now={p.now}>
      {p.role === "parent" ? <ParentHealth p={p} /> : <StaffHealth p={p} />}
      {p.toast.element}
    </Ready>
  );
}

const severityTone = {
  Mild: "info",
  Moderate: "warn",
  Severe: "danger",
} as const;

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(to + "T00:00:00").getTime() -
      new Date(from + "T00:00:00").getTime()) /
      86_400_000,
  );
}

export function vaccineState(due: string, given: string, today: string) {
  if (given)
    return { label: "Given " + formatDate(given), tone: "good" as const };
  const days = daysBetween(today, due);
  if (days < 0)
    return { label: "Overdue by " + -days + " days", tone: "danger" as const };
  if (days <= 30)
    return { label: "Due in " + days + " days", tone: "warn" as const };
  return { label: "Due " + formatDate(due), tone: "muted" as const };
}

/* ========================================================================
   Parent
   ======================================================================== */

function ParentHealth({ p }: { p: Preschool }) {
  const child = p.data.child;
  const [form, setForm] = useState<FormConfig>();
  const [acking, setAcking] = useState<Incident>();
  const [ackNote, setAckNote] = useState("");
  if (!child) return <Empty>No children are linked to your account.</Empty>;
  const first = child.name.split(" ")[0];
  const profile = healthOf(p.school, child.id);
  const incidents = p.school.incidents.filter(
    (item) => item.student === child.id,
  );
  const waiting = incidents.filter(
    (item) => item.status === "Awaiting acknowledgement",
  );
  /** For dialogs: a rule error stays in the dialog so it can be fixed. */
  const change = (
    edit: (profile: HealthProfile) => HealthProfile,
    message: string,
  ) => {
    updatePreschoolState((state) =>
      saveHealth(state, p.records, p.actor, child.id, edit, p.iso),
    );
    p.toast.show(message);
  };
  /** For one-click actions: the outcome is shown as a toast. */
  const apply = (
    edit: (profile: HealthProfile) => HealthProfile,
    message: string,
  ) =>
    p.act(
      (state) => saveHealth(state, p.records, p.actor, child.id, edit, p.iso),
      message,
    );

  return (
    <div className="pk-stack">
      {waiting.map((incident) => (
        <section key={incident.id} className="pk-alert-card" role="alert">
          <Bandage size={22} aria-hidden="true" />
          <div>
            <strong>
              {incident.kind} · {dayLabel(incident.date, p.today)} at{" "}
              {friendlyTime(incident.time)}
            </strong>
            <p>{incident.description}</p>
            <p className="pk-muted">Care given: {incident.action}</p>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setAcking(incident)}
          >
            Acknowledge
          </button>
        </section>
      ))}

      <div className="pk-health-head">
        <Stat icon={Droplet} label="Blood group" value={profile.bloodGroup} />
        <Stat
          icon={ShieldAlert}
          label="Allergies"
          value={profile.allergies.length || "None"}
          hint={
            profile.allergies.map((item) => item.name).join(", ") || "Recorded"
          }
          tone={
            profile.allergies.some((item) => item.severity === "Severe")
              ? "warn"
              : undefined
          }
        />
        <Stat
          icon={Stethoscope}
          label="Family doctor"
          value={profile.doctor.name || "—"}
          hint={
            profile.doctor.phone ? (
              <a href={"tel:" + profile.doctor.phone.replace(/\s/g, "")}>
                {profile.doctor.phone}
              </a>
            ) : (
              "Add your doctor"
            )
          }
        />
      </div>

      <div className="pk-columns">
        <Card
          icon={ShieldAlert}
          title="Allergies"
          subtitle={"Shown to every teacher who looks after " + first + "."}
          actions={
            <button
              type="button"
              className="button button-outline"
              onClick={() =>
                setForm({
                  title: "Add an allergy",
                  submitLabel: "Add allergy",
                  fields: [
                    { name: "name", label: "Allergic to" },
                    {
                      name: "severity",
                      label: "Severity",
                      type: "select",
                      options: ["Mild", "Moderate", "Severe"].map((value) => ({
                        value,
                        label: value,
                      })),
                    },
                    {
                      name: "reaction",
                      label: "What happens",
                      required: false,
                    },
                    {
                      name: "action",
                      label: "What staff should do",
                      type: "textarea",
                    },
                  ],
                  values: { severity: "Moderate" },
                  onSubmit: (data) =>
                    change(
                      (current) => ({
                        ...current,
                        allergies: [
                          ...current.allergies,
                          {
                            id: newId("allergy"),
                            name: String(data.get("name")),
                            severity: String(data.get("severity")) as "Mild",
                            reaction: String(data.get("reaction") ?? ""),
                            action: String(data.get("action")),
                          },
                        ],
                      }),
                      "Allergy added.",
                    ),
                })
              }
            >
              <Plus size={15} aria-hidden="true" /> Add
            </button>
          }
        >
          {profile.allergies.length ? (
            <ul className="pk-list">
              {profile.allergies.map((item) => (
                <li
                  key={item.id}
                  className="pk-allergy"
                  data-severity={item.severity}
                >
                  <span>
                    <strong>
                      {item.name}{" "}
                      <Pill tone={severityTone[item.severity]}>
                        {item.severity}
                      </Pill>
                    </strong>
                    {item.reaction && <small>Reaction: {item.reaction}</small>}
                    <small>Staff action: {item.action}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Remove " + item.name}
                    onClick={() =>
                      confirmAction("Remove the " + item.name + " allergy?") &&
                      apply(
                        (current) => ({
                          ...current,
                          allergies: current.allergies.filter(
                            (row) => row.id !== item.id,
                          ),
                        }),
                        "Allergy removed.",
                      )
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No allergies recorded.</Empty>
          )}
        </Card>

        <Card
          icon={PillIcon}
          title="Medicines at school"
          subtitle="Teachers give these at the time shown, from the labelled bottle you send."
          actions={
            <button
              type="button"
              className="button button-outline"
              onClick={() =>
                setForm({
                  title: "Medicine to give at school",
                  submitLabel: "Add medicine",
                  fields: [
                    { name: "name", label: "Medicine" },
                    { name: "dose", label: "Dose", hint: "e.g. 2.5 ml" },
                    { name: "time", label: "Time", type: "time" },
                    { name: "until", label: "Give until", type: "date" },
                    { name: "notes", label: "Notes", required: false },
                  ],
                  values: { time: "13:00", until: p.today },
                  onSubmit: (data) =>
                    change(
                      (current) => ({
                        ...current,
                        medicines: [
                          ...current.medicines,
                          {
                            id: newId("medicine"),
                            name: String(data.get("name")),
                            dose: String(data.get("dose")),
                            time: String(data.get("time")),
                            until: String(data.get("until")),
                            notes: String(data.get("notes") ?? ""),
                          },
                        ],
                      }),
                      "Medicine added. Please send it in a labelled bottle.",
                    ),
                })
              }
            >
              <Plus size={15} aria-hidden="true" /> Add
            </button>
          }
        >
          {profile.medicines.length ? (
            <ul className="pk-list">
              {profile.medicines.map((item) => (
                <li key={item.id}>
                  <span className="pk-avatar pk-avatar-icon">
                    <PillIcon size={17} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>
                      {item.name} · {item.dose}
                    </strong>
                    <small>
                      Daily at {friendlyTime(item.time)} until{" "}
                      {formatDate(item.until)}
                      {item.notes && " · " + item.notes}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Stop " + item.name}
                    onClick={() =>
                      apply(
                        (current) => ({
                          ...current,
                          medicines: current.medicines.filter(
                            (row) => row.id !== item.id,
                          ),
                        }),
                        "Medicine removed.",
                      )
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No medicines to give at school.</Empty>
          )}
        </Card>
      </div>

      <Card
        icon={Syringe}
        title="Vaccinations"
        subtitle="As per the IAP immunisation schedule."
      >
        <div className="table-scroll">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Vaccine</th>
                <th>Due</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {profile.vaccinations.map((item) => {
                const state = vaccineState(item.due, item.given, p.today);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{formatDate(item.due)}</td>
                    <td>
                      <Pill tone={state.tone}>{state.label}</Pill>
                    </td>
                    <td className="pk-cell-action">
                      {!item.given && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setForm({
                              title: "Record " + item.name,
                              submitLabel: "Save",
                              fields: [
                                {
                                  name: "given",
                                  label: "Date given",
                                  type: "date",
                                },
                              ],
                              values: { given: p.today },
                              onSubmit: (data) =>
                                change(
                                  (current) => ({
                                    ...current,
                                    vaccinations: current.vaccinations.map(
                                      (row) =>
                                        row.id === item.id
                                          ? {
                                              ...row,
                                              given: String(data.get("given")),
                                            }
                                          : row,
                                    ),
                                  }),
                                  item.name + " recorded as given.",
                                ),
                            })
                          }
                        >
                          Mark as given
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="pk-columns">
        <Card
          icon={Stethoscope}
          title="Medical details"
          actions={
            <button
              type="button"
              className="button button-outline"
              onClick={() =>
                setForm({
                  title: "Medical details",
                  submitLabel: "Save details",
                  fields: [
                    {
                      name: "blood",
                      label: "Blood group",
                      type: "select",
                      options: bloodGroups.map((value) => ({
                        value,
                        label: value,
                      })),
                    },
                    {
                      name: "conditions",
                      label: "Conditions staff should know about",
                      type: "textarea",
                      required: false,
                    },
                    { name: "doctor", label: "Doctor's name", required: false },
                    {
                      name: "clinic",
                      label: "Clinic or hospital",
                      required: false,
                    },
                    { name: "phone", label: "Doctor's phone", required: false },
                  ],
                  values: {
                    blood: profile.bloodGroup,
                    conditions: profile.conditions,
                    doctor: profile.doctor.name,
                    clinic: profile.doctor.clinic,
                    phone: profile.doctor.phone,
                  },
                  onSubmit: (data) =>
                    change(
                      (current) => ({
                        ...current,
                        bloodGroup: String(data.get("blood")),
                        conditions: String(data.get("conditions") ?? "").trim(),
                        doctor: {
                          name: String(data.get("doctor") ?? "").trim(),
                          clinic: String(data.get("clinic") ?? "").trim(),
                          phone: String(data.get("phone") ?? "").trim(),
                        },
                      }),
                      "Medical details saved.",
                    ),
                })
              }
            >
              Edit
            </button>
          }
        >
          <dl className="pk-details">
            <dt>Blood group</dt>
            <dd>{profile.bloodGroup}</dd>
            <dt>Conditions</dt>
            <dd>{profile.conditions || "None recorded"}</dd>
            <dt>Doctor</dt>
            <dd>
              {profile.doctor.name || "—"}
              {profile.doctor.clinic && <small>{profile.doctor.clinic}</small>}
            </dd>
            <dt>Updated</dt>
            <dd>
              {profile.updatedAt
                ? formatDate(profile.updatedAt.slice(0, 10))
                : "—"}
            </dd>
          </dl>
        </Card>

        <Card
          icon={Bandage}
          title="Incident reports"
          subtitle="Any bump, injury or illness at school is reported here the same day."
        >
          <IncidentList incidents={incidents} today={p.today} />
        </Card>
      </div>

      <FormDialog config={form} onClose={() => setForm(undefined)} />
      <Modal
        open={!!acking}
        title="Acknowledge incident report"
        onClose={() => {
          setAcking(undefined);
          setAckNote("");
        }}
      >
        {acking && (
          <form
            className="pk-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                p.act(
                  (state) =>
                    acknowledgeIncident(
                      state,
                      p.records,
                      p.actor,
                      acking.id,
                      ackNote,
                      p.iso,
                    ),
                  "Thank you. The school has been told you've read the report.",
                )
              ) {
                setAcking(undefined);
                setAckNote("");
              }
            }}
          >
            <p>
              <strong>{acking.kind}</strong> on {formatDate(acking.date)} at{" "}
              {friendlyTime(acking.time)}, reported by {acking.reportedBy}.
            </p>
            <p>{acking.description}</p>
            <p className="pk-muted">Care given: {acking.action}</p>
            <label>
              Message for the teacher (optional)
              <textarea
                value={ackNote}
                maxLength={300}
                onChange={(event) => setAckNote(event.target.value)}
              />
            </label>
            <div className="academic-toolbar">
              <button type="submit" className="button button-primary">
                <CircleCheck size={15} aria-hidden="true" /> I have read this
                report
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function IncidentList({
  incidents,
  today,
  names,
}: {
  incidents: Incident[];
  today: string;
  names?: (id: string) => string;
}) {
  if (!incidents.length) return <Empty>No incidents reported.</Empty>;
  return (
    <ul className="pk-list">
      {incidents.map((item) => (
        <li key={item.id}>
          <span
            className="pk-avatar pk-avatar-icon"
            data-tone={item.status === "Acknowledged" ? "good" : "warn"}
          >
            <Bandage size={16} aria-hidden="true" />
          </span>
          <span>
            <strong>
              {names ? names(item.student) + " · " : ""}
              {item.kind}
            </strong>
            <small>
              {dayLabel(item.date, today)} at {friendlyTime(item.time)} ·{" "}
              {item.description}
            </small>
            {item.parentNote && <small>Parent: “{item.parentNote}”</small>}
          </span>
          <Pill tone={item.status === "Acknowledged" ? "good" : "warn"}>
            {item.status === "Acknowledged"
              ? "Acknowledged" +
                (item.ackBy ? " by " + item.ackBy.split(" ")[0] : "")
              : "Awaiting parent"}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================
   Teacher & office
   ======================================================================== */

function StaffHealth({ p }: { p: Preschool }) {
  const [section, setSection] = useState("all");
  const [form, setForm] = useState<FormConfig>();
  const [viewing, setViewing] = useState<string>();
  const children = p.children.filter(
    (child) => section === "all" || child.section === section,
  );
  const ids = new Set(children.map((child) => child.id));
  const profiles = children.map((child) => ({
    child,
    profile: healthOf(p.school, child.id),
  }));
  const order = { Severe: 0, Moderate: 1, Mild: 2 };
  const allergies = profiles
    .flatMap(({ child, profile }) =>
      profile.allergies.map((allergy) => ({ child, allergy })),
    )
    .sort((a, b) => order[a.allergy.severity] - order[b.allergy.severity]);
  const medicines = profiles
    .flatMap(({ child, profile }) =>
      profile.medicines
        .filter((item) => item.until >= p.today)
        .map((medicine) => ({ child, medicine })),
    )
    .sort((a, b) => a.medicine.time.localeCompare(b.medicine.time));
  const vaccinesDue = profiles.flatMap(({ child, profile }) =>
    profile.vaccinations
      .filter((item) => !item.given && daysBetween(p.today, item.due) <= 30)
      .map((item) => ({ child, item })),
  );
  const incidents = p.school.incidents.filter((item) => ids.has(item.student));
  const nameOf = (id: string) =>
    p.children.find((child) => child.id === id)?.name ?? "Child";
  const viewed = profiles.find(({ child }) => child.id === viewing);

  return (
    <div className="pk-stack">
      <div className="pk-toolbar">
        <ClassFilter
          value={section}
          onChange={setSection}
          sections={p.sections}
        />
        <span className="pk-spacer" />
        <button
          type="button"
          className="button button-primary"
          onClick={() =>
            setForm({
              title: "Report an incident",
              description:
                "Parents are notified straight away and asked to acknowledge the report.",
              submitLabel: "Send report to parents",
              fields: [
                {
                  name: "student",
                  label: "Child",
                  type: "select",
                  options: children.map((child) => ({
                    value: child.id,
                    label: child.name,
                    group: child.sectionLabel,
                  })),
                },
                {
                  name: "kind",
                  label: "What happened",
                  type: "select",
                  options: incidentKinds.map((value) => ({
                    value,
                    label: value,
                  })),
                },
                { name: "time", label: "Time", type: "time" },
                { name: "description", label: "Description", type: "textarea" },
                {
                  name: "action",
                  label: "First aid or care given",
                  type: "textarea",
                },
              ],
              values: { time: p.time, kind: "Minor injury" },
              onSubmit: (data) => {
                updatePreschoolState((state) =>
                  reportIncident(
                    state,
                    p.records,
                    p.actor,
                    {
                      student: String(data.get("student")),
                      date: p.today,
                      time: String(data.get("time")),
                      kind: String(data.get("kind")) as Incident["kind"],
                      description: String(data.get("description")),
                      action: String(data.get("action")),
                    },
                    p.today,
                  ),
                );
                p.toast.show("Incident reported. Parents have been notified.");
              },
            })
          }
        >
          <Plus size={15} aria-hidden="true" /> Report incident
        </button>
      </div>

      <div className="pk-stats">
        <Stat
          icon={ShieldAlert}
          label="Children with allergies"
          value={new Set(allergies.map((row) => row.child.id)).size}
          hint={
            allergies.filter((row) => row.allergy.severity === "Severe")
              .length + " severe"
          }
          tone={
            allergies.some((row) => row.allergy.severity === "Severe")
              ? "warn"
              : undefined
          }
        />
        <Stat
          icon={PillIcon}
          label="Medicines today"
          value={medicines.length}
        />
        <Stat
          icon={Bandage}
          label="Awaiting parent"
          value={
            incidents.filter((item) => item.status !== "Acknowledged").length
          }
        />
        <Stat
          icon={Syringe}
          label="Vaccines due soon"
          value={vaccinesDue.length}
        />
      </div>

      <div className="pk-columns">
        <Card
          icon={ShieldAlert}
          title="Allergy alerts"
          subtitle="Check before every meal, snack and activity."
          tone={
            allergies.some((row) => row.allergy.severity === "Severe")
              ? "alert"
              : undefined
          }
        >
          {allergies.length ? (
            <ul className="pk-list">
              {allergies.map(({ child, allergy }) => (
                <li
                  key={child.id + allergy.id}
                  className="pk-allergy"
                  data-severity={allergy.severity}
                >
                  <Avatar name={child.name} size={36} />
                  <span>
                    <strong>
                      {child.name} · {allergy.name}{" "}
                      <Pill tone={severityTone[allergy.severity]}>
                        {allergy.severity}
                      </Pill>
                    </strong>
                    <small>{allergy.action}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No allergies in this class.</Empty>
          )}
        </Card>
        <Card icon={PillIcon} title="Medicines to give today">
          {medicines.length ? (
            <ul className="pk-list">
              {medicines.map(({ child, medicine }) => (
                <li key={medicine.id}>
                  <span className="pk-time-badge">
                    {friendlyTime(medicine.time)}
                  </span>
                  <span>
                    <strong>
                      {child.name} · {medicine.name}
                    </strong>
                    <small>
                      {medicine.dose}
                      {medicine.notes && " · " + medicine.notes}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No medicines due today.</Empty>
          )}
        </Card>
      </div>

      <div className="pk-columns">
        <Card icon={Bandage} title="Incident reports">
          <IncidentList incidents={incidents} today={p.today} names={nameOf} />
        </Card>
        <Card
          icon={HeartPulse}
          title="Health cards"
          subtitle="Open a child's card in an emergency."
        >
          <ul className="pk-mini-roster">
            {children.map((child) => {
              const profile = healthOf(p.school, child.id);
              return (
                <li key={child.id}>
                  <button type="button" onClick={() => setViewing(child.id)}>
                    <Avatar name={child.name} size={32} />
                    <span>{child.name}</span>
                    <small>{profile.bloodGroup}</small>
                    {profile.allergies.length > 0 && (
                      <ShieldAlert
                        size={14}
                        className="pk-flag"
                        aria-label="Has allergies"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      {vaccinesDue.length > 0 && p.role === "school-admin" && (
        <Card
          icon={Syringe}
          title="Vaccinations due within 30 days"
          subtitle="Send a reminder to these families."
        >
          <ul className="pk-list pk-list-compact">
            {vaccinesDue.map(({ child, item }) => {
              const state = vaccineState(item.due, item.given, p.today);
              return (
                <li key={item.id}>
                  <span>
                    <strong>{child.name}</strong> · {item.name}
                  </span>
                  <Pill tone={state.tone}>{state.label}</Pill>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <FormDialog config={form} onClose={() => setForm(undefined)} />
      <Modal
        open={!!viewed}
        title={viewed ? viewed.child.name + " · health card" : ""}
        onClose={() => setViewing(undefined)}
      >
        {viewed && <HealthCard profile={viewed.profile} today={p.today} />}
      </Modal>
    </div>
  );
}

function HealthCard({
  profile,
  today,
}: {
  profile: HealthProfile;
  today: string;
}) {
  return (
    <div className="pk-form">
      <dl className="pk-details">
        <dt>Blood group</dt>
        <dd>{profile.bloodGroup}</dd>
        <dt>Allergies</dt>
        <dd>
          {profile.allergies.length
            ? profile.allergies.map((item) => (
                <span key={item.id} className="pk-detail-line">
                  <Pill tone={severityTone[item.severity]}>
                    {item.severity}
                  </Pill>{" "}
                  {item.name}: {item.action}
                </span>
              ))
            : "None"}
        </dd>
        <dt>Conditions</dt>
        <dd>{profile.conditions || "None recorded"}</dd>
        <dt>Medicines</dt>
        <dd>
          {profile.medicines.length
            ? profile.medicines
                .map(
                  (item) =>
                    item.name +
                    " " +
                    item.dose +
                    " at " +
                    friendlyTime(item.time),
                )
                .join(", ")
            : "None"}
        </dd>
        <dt>Doctor</dt>
        <dd>
          {profile.doctor.name || "—"}
          {profile.doctor.clinic && <small>{profile.doctor.clinic}</small>}
          {profile.doctor.phone && (
            <a href={"tel:" + profile.doctor.phone.replace(/\s/g, "")}>
              {profile.doctor.phone}
            </a>
          )}
        </dd>
        <dt>Vaccinations</dt>
        <dd>
          {profile.vaccinations.map((item) => (
            <span key={item.id} className="pk-detail-line">
              {item.name}: {vaccineState(item.due, item.given, today).label}
            </span>
          ))}
        </dd>
      </dl>
      <Note>
        In an emergency call 108 (ambulance), then the child&apos;s parents.
      </Note>
    </div>
  );
}

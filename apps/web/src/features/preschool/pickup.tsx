"use client";

import { useState } from "react";
import {
  BusFront,
  CircleCheck,
  Clock,
  DoorOpen,
  KeyRound,
  LogIn,
  LogOut,
  MessageCircle,
  Phone,
  Plus,
  QrCode as QrIcon,
  ScanLine,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  addDays,
  addPickupPerson,
  allowedCollectors,
  approvePickupPerson,
  cancelPass,
  checkIn,
  checkOut,
  createPass,
  dayStatus,
  removePickupPerson,
  riderOf,
  verifyPass,
  type GateMethod,
  type PickupPass,
} from "@/services/preschool-model";
import { updatePreschoolState } from "@/services/preschool-store";
import { confirmAction } from "@/features/demo/form-dialog";
import { formatDate } from "@/features/demo/format";
import {
  Avatar,
  Card,
  ClassFilter,
  Empty,
  Modal,
  Note,
  PhotoField,
  Pill,
  QrCode,
  Ready,
  Stat,
  dayLabel,
  friendlyTime,
  usePreschool,
  type Preschool,
} from "./ui";

export function PickupPage() {
  const p = usePreschool();
  return (
    <Ready now={p.now}>
      {p.role === "parent" ? <ParentPickup p={p} /> : <StaffPickup p={p} />}
      {p.toast.element}
    </Ready>
  );
}

function statusTone(state: string) {
  return state === "In school"
    ? "good"
    : state === "Picked up"
      ? "info"
      : "muted";
}

/* ========================================================================
   Parent
   ======================================================================== */

function ParentPickup({ p }: { p: Preschool }) {
  const child = p.data.child;
  const [adding, setAdding] = useState(false);
  const [passing, setPassing] = useState(false);
  if (!child) return <Empty>No children are linked to your account.</Empty>;
  const first = child.name.split(" ")[0];
  const status = dayStatus(p.school, child.id, p.today);
  const people = p.school.pickupPeople.filter(
    (item) => item.student === child.id,
  );
  const passes = p.school.passes
    .filter((item) => item.student === child.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = passes.filter(
    (item) => item.status === "Active" && item.date >= p.today,
  );
  const history = [1, 2, 3, 4, 5, 6, 7]
    .map((back) => addDays(p.today, -back))
    .map((date) => ({ date, ...dayStatus(p.school, child.id, date) }))
    .filter((row) => row.in || row.out)
    .slice(0, 5);
  const bus = riderOf(p.school, child.id);

  return (
    <div className="pk-stack">
      <section className="pk-today" data-state={status.state}>
        <span className="pk-today-icon">
          {status.state === "In school" ? (
            <ShieldCheck size={26} aria-hidden="true" />
          ) : status.state === "Picked up" ? (
            <CircleCheck size={26} aria-hidden="true" />
          ) : (
            <Clock size={26} aria-hidden="true" />
          )}
        </span>
        <div>
          <small>Today · {formatDate(p.today)}</small>
          <h2>
            {status.state === "In school"
              ? first + " is safely in school"
              : status.state === "Picked up"
                ? first + " has been picked up"
                : first + " hasn't arrived yet"}
          </h2>
          <p>
            {status.in &&
              "Checked in at " +
                friendlyTime(status.in.time) +
                " · " +
                (status.in.method === "School bus"
                  ? "came by school bus"
                  : "dropped off by " + status.in.person)}
            {status.out &&
              " · Checked out at " +
                friendlyTime(status.out.time) +
                " by " +
                status.out.person +
                " (" +
                status.out.method +
                ")"}
            {!status.in &&
              (bus
                ? "Bus pickup at " +
                  bus.stop.name +
                  ", " +
                  friendlyTime(bus.stop.am) +
                  "."
                : "School opens at 8:30 am.")}
          </p>
        </div>
      </section>

      <Card
        icon={KeyRound}
        title="Someone else picking up?"
        subtitle={
          "Create a one-day pickup pass. The person shows its QR code or tells the OTP at the gate, and the school checks " +
          first +
          " out only after it matches."
        }
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() => setPassing(true)}
          >
            <Plus size={15} aria-hidden="true" /> New pickup pass
          </button>
        }
      >
        {active.length ? (
          <div className="pk-passes">
            {active.map((pass) => (
              <PassCard
                key={pass.id}
                pass={pass}
                childName={first}
                today={p.today}
                onCancel={() =>
                  confirmAction(
                    "Cancel the pickup pass for " + pass.name + "?",
                  ) &&
                  p.act(
                    (state) => cancelPass(state, p.records, p.actor, pass.id),
                    "Pickup pass cancelled.",
                  )
                }
              />
            ))}
          </div>
        ) : (
          <Empty>No active pickup passes.</Empty>
        )}
        {passes.some((item) => item.status !== "Active") && (
          <ul className="pk-list pk-list-compact">
            {passes
              .filter((item) => item.status !== "Active")
              .slice(0, 4)
              .map((pass) => (
                <li key={pass.id}>
                  <span>
                    <strong>{pass.name}</strong> · {pass.relation}
                  </span>
                  <small>{formatDate(pass.date)}</small>
                  <Pill tone={pass.status === "Used" ? "good" : "muted"}>
                    {pass.status === "Used"
                      ? "Verified " +
                        (pass.usedAt
                          ? new Date(pass.usedAt).toTimeString().slice(0, 5)
                          : "")
                      : pass.status}
                  </Pill>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card
        icon={UsersRound}
        title="People allowed to collect"
        subtitle="The gate staff compare the person with this photo before handing over your child."
        actions={
          <button
            type="button"
            className="button button-outline"
            onClick={() => setAdding(true)}
          >
            <Plus size={15} aria-hidden="true" /> Add person
          </button>
        }
      >
        <ul className="pk-people">
          {allowedCollectors(p.school, p.records, child.id)
            .filter((item) => !people.some((own) => own.id === item.id))
            .map((item) => (
              <li key={item.id}>
                <Avatar name={item.name} size={52} />
                <span className="pk-people-copy">
                  <strong>{item.name}</strong>
                  <small>{item.relation} · on the school record</small>
                </span>
                <Pill tone="good" icon={ShieldCheck}>
                  Guardian
                </Pill>
              </li>
            ))}
          {people.map((item) => (
            <li key={item.id}>
              <Avatar name={item.name} photo={item.photo} size={52} />
              <span className="pk-people-copy">
                <strong>{item.name}</strong>
                <small>
                  {item.relation} · {item.phone}
                </small>
              </span>
              {item.status === "Approved" ? (
                <Pill tone="good" icon={UserCheck}>
                  Approved
                </Pill>
              ) : (
                <Pill tone="warn" icon={Clock}>
                  Awaiting office approval
                </Pill>
              )}
              <button
                type="button"
                className="icon-button"
                aria-label={"Remove " + item.name}
                onClick={() =>
                  confirmAction(
                    "Remove " + item.name + " from the pickup list?",
                  ) &&
                  p.act(
                    (state) =>
                      removePickupPerson(state, p.records, p.actor, item.id),
                    item.name + " removed from the pickup list.",
                  )
                }
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <Note>
          New people are approved by the school office after an ID check,
          usually within a day. Until then, use a pickup pass.
        </Note>
      </Card>

      <Card
        icon={DoorOpen}
        title="Gate log"
        subtitle="Drop-off and pickup times recorded at the gate."
      >
        {history.length ? (
          <div className="table-scroll">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Arrived</th>
                  <th>Left</th>
                  <th>Collected by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.date}>
                    <td>{dayLabel(row.date, p.today)}</td>
                    <td>{row.in ? friendlyTime(row.in.time) : "—"}</td>
                    <td>{row.out ? friendlyTime(row.out.time) : "—"}</td>
                    <td>
                      {row.out ? row.out.person + " · " + row.out.method : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No gate records yet.</Empty>
        )}
      </Card>

      <AddPersonDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(input) =>
          p.act(
            (state) =>
              addPickupPerson(state, p.records, p.actor, {
                ...input,
                student: child.id,
              }),
            input.name + " added. The office will approve them shortly.",
          ) && setAdding(false)
        }
        onError={(message) => p.toast.show(message, "error")}
      />
      <PassDialog
        open={passing}
        today={p.today}
        onClose={() => setPassing(false)}
        onSave={(input) =>
          p.act(
            (state) =>
              createPass(
                state,
                p.records,
                p.actor,
                { ...input, student: child.id },
                p.today,
                p.iso,
              ),
            "Pickup pass created. Share the QR code or OTP with " +
              input.name +
              ".",
          ) && setPassing(false)
        }
      />
    </div>
  );
}

function PassCard({
  pass,
  childName,
  today,
  onCancel,
}: {
  pass: PickupPass;
  childName: string;
  today: string;
  onCancel: () => void;
}) {
  const share =
    "Oak and Ivy pickup pass for " +
    childName +
    " on " +
    formatDate(pass.date) +
    " at " +
    friendlyTime(pass.time) +
    ". OTP: " +
    pass.otp +
    ". Pass code: " +
    pass.code +
    ". Show this at the school gate.";
  return (
    <article className="pk-pass">
      <QrCode text={pass.code} size={150} />
      <div className="pk-pass-copy">
        <Pill tone="accent" icon={QrIcon}>
          {dayLabel(pass.date, today)} · {friendlyTime(pass.time)}
        </Pill>
        <h3>{pass.name}</h3>
        <p>
          {pass.relation} · {pass.phone}
        </p>
        <div
          className="pk-otp"
          aria-label={"OTP " + pass.otp.split("").join(" ")}
        >
          {pass.otp.split("").map((digit, index) => (
            <span key={index}>{digit}</span>
          ))}
        </div>
        <small>
          OTP · pass code <code>{pass.code}</code>
        </small>
        {pass.note && <p className="pk-muted">“{pass.note}”</p>}
        <div className="pk-row">
          <a
            className="button button-outline"
            href={"https://wa.me/?text=" + encodeURIComponent(share)}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={15} aria-hidden="true" /> Share on WhatsApp
          </a>
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel pass
          </button>
        </div>
      </div>
    </article>
  );
}

function AddPersonDialog({
  open,
  onClose,
  onSave,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    relation: string;
    phone: string;
    photo: string;
  }) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    relation: "",
    phone: "",
    photo: "",
  });
  return (
    <Modal
      open={open}
      title="Add a person to the pickup list"
      onClose={() => {
        setForm({ name: "", relation: "", phone: "", photo: "" });
        onClose();
      }}
    >
      <form
        className="pk-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <PhotoField
          value={form.photo}
          name={form.name}
          onChange={(photo) => setForm({ ...form, photo })}
          onError={onError}
        />
        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <div className="field-row">
          <label>
            Relation to child
            <input
              required
              placeholder="e.g. Grandfather"
              value={form.relation}
              onChange={(event) =>
                setForm({ ...form, relation: event.target.value })
              }
            />
          </label>
          <label>
            Mobile number
            <input
              required
              inputMode="tel"
              placeholder="98765 43210"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
        </div>
        <p className="field-hint">
          A clear face photo helps the gate staff. They will also check a photo
          ID the first time.
        </p>
        <div className="academic-toolbar">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            Send for approval
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PassDialog({
  open,
  today,
  onClose,
  onSave,
}: {
  open: boolean;
  today: string;
  onClose: () => void;
  onSave: (input: {
    name: string;
    relation: string;
    phone: string;
    date: string;
    time: string;
    note: string;
  }) => void;
}) {
  const blank = {
    name: "",
    relation: "",
    phone: "",
    date: today,
    time: "13:30",
    note: "",
  };
  const [form, setForm] = useState(blank);
  const set = (patch: Partial<typeof blank>) => setForm({ ...form, ...patch });
  return (
    <Modal
      open={open}
      title="New pickup pass"
      onClose={() => {
        setForm(blank);
        onClose();
      }}
    >
      <form
        className="pk-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <label>
          Who is picking up?
          <input
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <div className="field-row">
          <label>
            Relation
            <input
              required
              placeholder="e.g. Aunt"
              value={form.relation}
              onChange={(e) => set({ relation: e.target.value })}
            />
          </label>
          <label>
            Their mobile
            <input
              required
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            Date
            <input
              type="date"
              required
              min={today}
              max={addDays(today, 7)}
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </label>
          <label>
            Pickup time
            <input
              type="time"
              required
              value={form.time}
              onChange={(e) => set({ time: e.target.value })}
            />
          </label>
        </div>
        <label>
          Note for the teacher (optional)
          <input
            maxLength={200}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </label>
        <p className="field-hint">
          We&apos;ll create a QR pass and a 4-digit OTP. The pass works once, on
          the chosen day only.
        </p>
        <div className="academic-toolbar">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            Create pass
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ========================================================================
   Teacher & office: the gate board
   ======================================================================== */

function StaffPickup({ p }: { p: Preschool }) {
  const [section, setSection] = useState(
    p.role === "teacher" ? (p.sections[0]?.id ?? "all") : "all",
  );
  const [checkingIn, setCheckingIn] = useState<string>();
  const [checkingOut, setCheckingOut] = useState<string>();
  const roster = p.children
    .filter((child) => section === "all" || child.section === section)
    .map((child) => ({
      child,
      status: dayStatus(p.school, child.id, p.today),
    }));
  const count = (state: string) =>
    roster.filter((row) => row.status.state === state).length;
  const ids = new Set(roster.map((row) => row.child.id));
  const passesToday = p.school.passes.filter(
    (item) => item.date === p.today && ids.has(item.student),
  );
  const pending = p.school.pickupPeople.filter(
    (item) => item.status === "Pending approval" && ids.has(item.student),
  );
  const nameOf = (id: string) =>
    p.children.find((child) => child.id === id)?.name ?? "Child";
  const inChild = roster.find((row) => row.child.id === checkingIn)?.child;
  const outChild = roster.find((row) => row.child.id === checkingOut)?.child;

  return (
    <div className="pk-stack">
      <div className="pk-toolbar">
        <ClassFilter
          value={section}
          onChange={setSection}
          sections={p.sections}
        />
        <span className="pk-spacer" />
        <Pill tone="info" icon={Clock}>
          {formatDate(p.today)} · {friendlyTime(p.time)}
        </Pill>
      </div>
      <div className="pk-stats">
        <Stat
          icon={ShieldCheck}
          label="In school now"
          value={count("In school")}
          tone="good"
        />
        <Stat icon={LogOut} label="Picked up" value={count("Picked up")} />
        <Stat
          icon={Clock}
          label="Not arrived"
          value={count("Not arrived")}
          tone={count("Not arrived") ? "warn" : undefined}
        />
        <Stat
          icon={KeyRound}
          label="Pickup passes today"
          value={passesToday.length}
        />
      </div>

      {passesToday.length > 0 && (
        <Card
          icon={KeyRound}
          title="Someone else is collecting today"
          subtitle="Ask for the QR pass or the 4-digit OTP before handing over the child."
        >
          <ul className="pk-list">
            {passesToday.map((pass) => (
              <li key={pass.id}>
                <Avatar name={pass.name} size={36} />
                <span>
                  <strong>
                    {pass.name} → {nameOf(pass.student)}
                  </strong>
                  <small>
                    {pass.relation} · {pass.phone} · expected{" "}
                    {friendlyTime(pass.time)}
                    {pass.note && " · “" + pass.note + "”"}
                  </small>
                </span>
                <Pill
                  tone={
                    pass.status === "Used"
                      ? "good"
                      : pass.status === "Active"
                        ? "accent"
                        : "muted"
                  }
                >
                  {pass.status === "Used"
                    ? "Verified · " + pass.verifiedBy
                    : pass.status}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.role === "school-admin" && pending.length > 0 && (
        <Card
          icon={UserCheck}
          title="Waiting for approval"
          subtitle="People parents added to a pickup list. Check their photo ID before approving."
        >
          <ul className="pk-list">
            {pending.map((person) => (
              <li key={person.id}>
                <Avatar name={person.name} photo={person.photo} size={36} />
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.relation} of {nameOf(person.student)} ·{" "}
                    {person.phone}
                  </small>
                </span>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    p.act(
                      (state) =>
                        approvePickupPerson(
                          state,
                          p.records,
                          p.actor,
                          person.id,
                        ),
                      person.name + " approved for pickup.",
                    )
                  }
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        icon={DoorOpen}
        title="Gate board"
        subtitle="Check children in as they arrive, and out when they are collected."
      >
        <div className="table-scroll">
          <table className="pk-table pk-gate">
            <thead>
              <tr>
                <th>Child</th>
                <th>Status</th>
                <th>Arrived</th>
                <th>Left</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map(({ child, status }) => (
                <tr key={child.id}>
                  <td>
                    <span className="pk-cell-person">
                      <Avatar name={child.name} size={34} />
                      <span>
                        <strong>{child.name}</strong>
                        <small>{child.sectionLabel}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Pill tone={statusTone(status.state)}>{status.state}</Pill>
                  </td>
                  <td>
                    {status.in ? (
                      <span className="pk-cell-time">
                        {friendlyTime(status.in.time)}
                        <small>
                          {status.in.method === "School bus"
                            ? "Bus"
                            : status.in.person}
                        </small>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {status.out ? (
                      <span className="pk-cell-time">
                        {friendlyTime(status.out.time)}
                        <small>
                          {status.out.person} · {status.out.method}
                        </small>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pk-cell-action">
                    {status.state === "Not arrived" && (
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setCheckingIn(child.id)}
                      >
                        <LogIn size={15} aria-hidden="true" /> Check in
                      </button>
                    )}
                    {status.state === "In school" && (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => setCheckingOut(child.id)}
                      >
                        <LogOut size={15} aria-hidden="true" /> Check out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!inChild}
        title={inChild ? "Check in " + inChild.name : ""}
        onClose={() => setCheckingIn(undefined)}
      >
        {inChild && (
          <CheckInForm
            p={p}
            student={inChild.id}
            onDone={() => setCheckingIn(undefined)}
          />
        )}
      </Modal>
      <Modal
        open={!!outChild}
        title={outChild ? "Check out " + outChild.name : ""}
        onClose={() => setCheckingOut(undefined)}
        wide
      >
        {outChild && (
          <CheckOutForm
            p={p}
            student={outChild.id}
            name={outChild.name}
            onDone={() => setCheckingOut(undefined)}
          />
        )}
      </Modal>
    </div>
  );
}

function CheckInForm({
  p,
  student,
  onDone,
}: {
  p: Preschool;
  student: string;
  onDone: () => void;
}) {
  const people = allowedCollectors(p.school, p.records, student).filter(
    (item) => item.status === "Approved",
  );
  const bus = riderOf(p.school, student);
  const options = [
    ...people.map((item) => ({
      key: item.id,
      label: item.name + " (" + item.relation + ")",
      method: (p.records.guardians.some((g) => g.id === item.id)
        ? "Parent"
        : "Authorised person") as GateMethod,
      person: item.name,
    })),
    ...(bus
      ? [
          {
            key: "bus",
            label: bus.vehicle.label + " · " + bus.vehicle.number,
            method: "School bus" as GateMethod,
            person: "Bus attendant",
          },
        ]
      : []),
  ];
  const [choice, setChoice] = useState(options[0]?.key ?? "");
  const picked = options.find((item) => item.key === choice);
  return (
    <form
      className="pk-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!picked) return;
        if (
          p.act(
            (state) =>
              checkIn(
                state,
                p.records,
                p.actor,
                student,
                picked.person,
                picked.method,
                p.today,
                p.time,
              ),
            "Checked in at " +
              friendlyTime(p.time) +
              ". Parents have been notified.",
          )
        )
          onDone();
      }}
    >
      <fieldset className="pk-choice-list">
        <legend>Who dropped the child off?</legend>
        {options.map((item) => (
          <label key={item.key} className="pk-choice">
            <input
              type="radio"
              name="dropoff"
              checked={choice === item.key}
              onChange={() => setChoice(item.key)}
            />
            {item.key === "bus" ? (
              <span className="pk-avatar pk-avatar-icon">
                <BusFront size={18} aria-hidden="true" />
              </span>
            ) : (
              <Avatar name={item.person} size={36} />
            )}
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      <p className="field-hint">
        Time recorded: {friendlyTime(p.time)}. The parent gets an “arrived
        safely” notification.
      </p>
      <div className="academic-toolbar">
        <button
          type="button"
          className="button button-outline"
          onClick={onDone}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={!picked}
        >
          <LogIn size={15} aria-hidden="true" /> Check in
        </button>
      </div>
    </form>
  );
}

function CheckOutForm({
  p,
  student,
  name,
  onDone,
}: {
  p: Preschool;
  student: string;
  name: string;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"list" | "pass">("list");
  const [chosen, setChosen] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  /** Errors stay inside the dialog, where the gate staff are looking. */
  const attempt = (
    change: Parameters<typeof updatePreschoolState>[0],
    success: string,
  ) => {
    try {
      updatePreschoolState(change);
      p.toast.show(success);
      onDone();
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  const people = allowedCollectors(p.school, p.records, student);
  const pass = p.school.passes.find(
    (item) =>
      item.student === student &&
      item.date === p.today &&
      item.status === "Active",
  );
  const first = name.split(" ")[0];
  return (
    <div className="pk-form">
      <div
        className="pk-segment pk-segment-wide"
        role="group"
        aria-label="How is the child being collected?"
      >
        <button
          type="button"
          aria-pressed={mode === "list"}
          onClick={() => setMode("list")}
        >
          <UsersRound size={15} aria-hidden="true" /> Pickup list
        </button>
        <button
          type="button"
          aria-pressed={mode === "pass"}
          onClick={() => setMode("pass")}
        >
          <ScanLine size={15} aria-hidden="true" /> OTP or QR pass
          {pass && (
            <span className="pk-dot" aria-label="A pass is active today" />
          )}
        </button>
      </div>
      {mode === "list" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            attempt(
              (state) =>
                checkOut(
                  state,
                  p.records,
                  p.actor,
                  student,
                  chosen,
                  p.today,
                  p.time,
                ),
              first + " checked out. Parents have been notified.",
            );
          }}
          className="pk-form"
        >
          <p className="field-hint">
            Match the person in front of you with their photo, then confirm.
          </p>
          <div className="pk-collectors">
            {people.map((item) => (
              <label
                key={item.id}
                className="pk-collector"
                data-pending={item.status !== "Approved" ? "" : undefined}
              >
                <input
                  type="radio"
                  name="collector"
                  value={item.id}
                  checked={chosen === item.id}
                  onChange={() => {
                    setChosen(item.id);
                    setConfirmed(false);
                  }}
                />
                <Avatar name={item.name} photo={item.photo} size={64} />
                <strong>{item.name}</strong>
                <small>{item.relation}</small>
                {item.status !== "Approved" && (
                  <Pill tone="warn">Not approved</Pill>
                )}
              </label>
            ))}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!chosen}
            />
            I have matched this person with their photo.
          </label>
          <div className="academic-toolbar">
            <button
              type="button"
              className="button button-outline"
              onClick={onDone}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!chosen || !confirmed}
            >
              <LogOut size={15} aria-hidden="true" /> Hand over {first}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="pk-form"
          onSubmit={(event) => {
            event.preventDefault();
            attempt(
              (state) =>
                verifyPass(
                  state,
                  p.records,
                  p.actor,
                  student,
                  secret,
                  p.today,
                  p.iso,
                  p.time,
                ),
              "Pass verified. " + first + " checked out.",
            );
          }}
        >
          {pass ? (
            <div className="pk-expected">
              <Avatar name={pass.name} size={44} />
              <span>
                <strong>Expected: {pass.name}</strong>
                <small>
                  {pass.relation} · {pass.phone} · around{" "}
                  {friendlyTime(pass.time)}
                </small>
              </span>
            </div>
          ) : (
            <Note>
              No pass for {first} today. Any code entered will be rejected.
            </Note>
          )}
          <label>
            OTP or pass code
            <input
              autoFocus
              value={secret}
              onChange={(event) => {
                setSecret(event.target.value);
                setError("");
              }}
              placeholder="4-digit OTP, or scan the QR (OI-XXXXXX)"
              autoComplete="off"
            />
            <span className="field-hint">
              <ScanLine size={13} aria-hidden="true" /> The gate QR scanner
              types the pass code here automatically.
            </span>
          </label>
          <div className="academic-toolbar">
            <button
              type="button"
              className="button button-outline"
              onClick={onDone}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!secret.trim()}
            >
              <ShieldCheck size={15} aria-hidden="true" /> Verify & hand over
            </button>
          </div>
          {pass && (
            <p className="pk-demo-hint">
              Demo: the OTP is <code>{pass.otp}</code> and the pass code is{" "}
              <code>{pass.code}</code>.
            </p>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="pk-muted">
        <Phone size={13} aria-hidden="true" /> Unsure? Call the parent before
        handing over the child.
      </p>
    </div>
  );
}

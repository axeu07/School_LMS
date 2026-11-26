"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BellRing,
  CircleCheck,
  CloudRain,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Search,
  Siren,
  Trash2,
  X,
} from "lucide-react";
import {
  acknowledgeBroadcast,
  broadcastCategories,
  broadcastFamilies,
  broadcastsFor,
  changeContact,
  closeBroadcast,
  contactsOf,
  saveContact,
  sendBroadcast,
  teacherSections,
  type Broadcast,
} from "@/services/preschool-model";
import {
  updatePreschoolState,
  usePreschoolSchool,
} from "@/services/preschool-store";
import { useDemo } from "@/features/demo/demo-context";
import {
  FormDialog,
  confirmAction,
  type FormConfig,
} from "@/features/demo/form-dialog";
import { roleHref } from "@/features/demo/navigation";
import { formatDateTime } from "@/features/demo/format";
import { localDateTime } from "@/services/learning-model";
import {
  Avatar,
  Card,
  Empty,
  Modal,
  Pill,
  Ready,
  usePreschool,
  type Preschool,
} from "./ui";

export function EmergencyPage() {
  const p = usePreschool();
  return (
    <Ready now={p.now}>
      {p.role === "parent" ? (
        <ParentEmergency p={p} />
      ) : (
        <StaffEmergency p={p} />
      )}
      {p.toast.element}
    </Ready>
  );
}

const schoolNumbers = [
  { label: "School office", phone: "0135 271 4420", note: "8:00 am – 4:00 pm" },
  {
    label: "School nurse",
    phone: "+91 98370 55120",
    note: "During school hours",
  },
  {
    label: "Transport desk",
    phone: "+91 94120 33871",
    note: "Bus and van queries",
  },
  { label: "Ambulance", phone: "108", note: "Emergency" },
  { label: "Police", phone: "112", note: "Emergency" },
];

const tel = (phone: string) => "tel:" + phone.replace(/\s/g, "");
const sentLabel = (iso: string) => formatDateTime(localDateTime(new Date(iso)));

function CategoryIcon({ category }: { category: Broadcast["category"] }) {
  if (category === "Rain / weather")
    return <CloudRain size={18} aria-hidden="true" />;
  if (category === "General") return <Megaphone size={18} aria-hidden="true" />;
  return <Siren size={18} aria-hidden="true" />;
}

/* ---------- The banner across every page ---------- */

/** Active alerts a parent has not acknowledged, shown above every page. */
export function UrgentBanner() {
  const { role, records, actor, schoolId } = useDemo();
  const school = usePreschoolSchool(schoolId);
  const [hidden, setHidden] = useState<string[]>([]);
  if (role !== "parent") return null;
  const alerts = broadcastsFor(school, records, actor).filter(
    (item) =>
      item.active &&
      !item.acks.includes(actor.person) &&
      !hidden.includes(item.id),
  );
  if (!alerts.length) return null;
  const alert = alerts[0];
  return (
    <div className="pk-urgent" role="alert">
      <span className="pk-urgent-icon">
        <CategoryIcon category={alert.category} />
      </span>
      <span className="pk-urgent-copy">
        <strong>{alert.title}</strong>
        <span>{alert.message}</span>
      </span>
      <span className="pk-urgent-actions">
        <button
          type="button"
          className="button button-white"
          onClick={() =>
            updatePreschoolState((state) =>
              acknowledgeBroadcast(state, records, actor, alert.id),
            )
          }
        >
          <CircleCheck size={15} aria-hidden="true" /> Got it
        </button>
        <Link href={roleHref(role, "emergency")} className="pk-urgent-link">
          Details
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-label="Hide for now"
          onClick={() => setHidden([...hidden, alert.id])}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

/* ---------- Parent ---------- */

function ParentEmergency({ p }: { p: Preschool }) {
  const child = p.data.child;
  const [form, setForm] = useState<FormConfig>();
  if (!child) return <Empty>No children are linked to your account.</Empty>;
  const first = child.name.split(" ")[0];
  const contacts = contactsOf(p.school, child.id);
  const alerts = broadcastsFor(p.school, p.records, p.actor);
  const active = alerts.filter((item) => item.active);
  const past = alerts.filter((item) => !item.active);
  const edit = (contact?: (typeof contacts)[number]) =>
    setForm({
      title: contact ? "Edit emergency contact" : "Add emergency contact",
      submitLabel: contact ? "Save" : "Add contact",
      fields: [
        { name: "name", label: "Name" },
        { name: "relation", label: "Relation to " + first },
        { name: "phone", label: "Mobile number" },
      ],
      values: contact
        ? {
            name: contact.name,
            relation: contact.relation,
            phone: contact.phone,
          }
        : {},
      onSubmit: (data) => {
        updatePreschoolState((state) =>
          saveContact(state, p.records, p.actor, {
            id: contact?.id,
            student: child.id,
            name: String(data.get("name")),
            relation: String(data.get("relation")),
            phone: String(data.get("phone")),
          }),
        );
        p.toast.show(contact ? "Contact updated." : "Emergency contact added.");
      },
    });

  return (
    <div className="pk-stack">
      {active.length > 0 && (
        <Card icon={BellRing} title="Active alerts from school" tone="alert">
          <ul className="pk-alerts">
            {active.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                acknowledged={alert.acks.includes(p.actor.person)}
                onAck={() =>
                  p.act(
                    (state) =>
                      acknowledgeBroadcast(state, p.records, p.actor, alert.id),
                    "Thanks, the school knows you've seen this.",
                  )
                }
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="pk-columns">
        <Card
          icon={Phone}
          title={first + "'s emergency contacts"}
          subtitle="The school calls them in this order if it can't reach you."
          actions={
            contacts.length < 5 && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => edit()}
              >
                <Plus size={15} aria-hidden="true" /> Add
              </button>
            )
          }
        >
          <ol className="pk-contacts">
            {contacts.map((contact, index) => (
              <li key={contact.id}>
                <span className="pk-contact-rank">{index + 1}</span>
                <Avatar name={contact.name} size={40} />
                <span className="pk-contact-copy">
                  <strong>{contact.name}</strong>
                  <small>
                    {contact.relation} ·{" "}
                    <a href={tel(contact.phone)}>{contact.phone}</a>
                  </small>
                </span>
                <span className="pk-row">
                  {index > 0 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Call " + contact.name + " earlier"}
                      onClick={() =>
                        p.act(
                          (state) =>
                            changeContact(
                              state,
                              p.records,
                              p.actor,
                              contact.id,
                              "up",
                            ),
                          contact.name + " moved up.",
                        )
                      }
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Edit " + contact.name}
                    onClick={() => edit(contact)}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Remove " + contact.name}
                    onClick={() =>
                      confirmAction("Remove " + contact.name + "?") &&
                      p.act(
                        (state) =>
                          changeContact(
                            state,
                            p.records,
                            p.actor,
                            contact.id,
                            "remove",
                          ),
                        contact.name + " removed.",
                      )
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card icon={Siren} title="Important numbers">
          <ul className="pk-numbers">
            {schoolNumbers.map((item) => (
              <li key={item.label}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
                <a className="button button-outline" href={tel(item.phone)}>
                  <Phone size={14} aria-hidden="true" /> {item.phone}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card icon={Megaphone} title="Past alerts">
        {past.length ? (
          <ul className="pk-alerts">
            {past.map((alert) => (
              <AlertRow key={alert.id} alert={alert} acknowledged />
            ))}
          </ul>
        ) : (
          <Empty>No earlier alerts.</Empty>
        )}
      </Card>
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </div>
  );
}

function AlertRow({
  alert,
  acknowledged,
  onAck,
  footer,
}: {
  alert: Broadcast;
  acknowledged?: boolean;
  onAck?: () => void;
  footer?: ReactNode;
}) {
  return (
    <li className="pk-alert" data-active={alert.active ? "" : undefined}>
      <span className="pk-alert-icon">
        <CategoryIcon category={alert.category} />
      </span>
      <span className="pk-alert-copy">
        <span className="pk-row">
          <Pill tone={alert.active ? "danger" : "muted"}>{alert.category}</Pill>
          <small suppressHydrationWarning>
            {sentLabel(alert.sentAt)} · {alert.by} · {alert.channels.join(", ")}
          </small>
        </span>
        <strong>{alert.title}</strong>
        <span>{alert.message}</span>
        {footer}
      </span>
      {onAck &&
        (acknowledged ? (
          <Pill tone="good" icon={CircleCheck}>
            Seen
          </Pill>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={onAck}
          >
            Got it
          </button>
        ))}
    </li>
  );
}

/* ---------- Teacher & office ---------- */

const templates: Record<
  string,
  { title: string; message: string; category: Broadcast["category"] }
> = {
  rain: {
    title: "Rain alert: early dismissal at 12:30 today",
    message:
      "Due to heavy rain, school closes at 12:30 today and buses leave 30 minutes early. Please collect your child on time.",
    category: "Rain / weather",
  },
  closure: {
    title: "School closed tomorrow",
    message:
      "The school will stay closed tomorrow on the district administration's advice. Classes resume the day after.",
    category: "Early closure",
  },
  transport: {
    title: "Bus running 20 minutes late",
    message:
      "Traffic on Rajpur Road has delayed the bus by about 20 minutes. Children are safe on board. Track it live in the app.",
    category: "Transport delay",
  },
  blank: { title: "", message: "", category: "General" },
};

function StaffEmergency({ p }: { p: Preschool }) {
  const [composing, setComposing] = useState<keyof typeof templates>();
  const [query, setQuery] = useState("");
  const own =
    p.role === "teacher"
      ? teacherSections(p.records, p.actor.person)
      : p.records.sections;
  const alerts = broadcastsFor(p.school, p.records, p.actor);
  const term = query.trim().toLowerCase();
  const directory = p.children.filter((child) =>
    (child.name + " " + child.sectionLabel).toLowerCase().includes(term),
  );
  const draft = composing ? templates[composing] : undefined;

  return (
    <div className="pk-stack">
      <Card
        icon={Siren}
        title="Send an urgent alert"
        subtitle={
          p.role === "teacher"
            ? "Alerts go to the families of your classes by app notification, SMS and WhatsApp."
            : "Alerts go to every family, or one class, by app notification, SMS and WhatsApp."
        }
      >
        <div className="pk-templates">
          <button type="button" onClick={() => setComposing("rain")}>
            <CloudRain size={20} aria-hidden="true" />
            <strong>Rain / early dismissal</strong>
            <small>Close early and send buses sooner</small>
          </button>
          <button type="button" onClick={() => setComposing("closure")}>
            <Siren size={20} aria-hidden="true" />
            <strong>School closure</strong>
            <small>Closed tomorrow or for the day</small>
          </button>
          <button type="button" onClick={() => setComposing("transport")}>
            <BellRing size={20} aria-hidden="true" />
            <strong>Transport delay</strong>
            <small>A bus or van is running late</small>
          </button>
          <button type="button" onClick={() => setComposing("blank")}>
            <Megaphone size={20} aria-hidden="true" />
            <strong>Write your own</strong>
            <small>Any other urgent message</small>
          </button>
        </div>
      </Card>

      <Card
        icon={BellRing}
        title="Alerts sent"
        subtitle="See which families have read each alert."
      >
        {alerts.length ? (
          <ul className="pk-alerts">
            {alerts.map((alert) => {
              const families = broadcastFamilies(p.records, alert.audience);
              const seen = alert.acks.filter((id) =>
                families.includes(id),
              ).length;
              const percent = families.length
                ? Math.round((seen / families.length) * 100)
                : 0;
              const canClose =
                alert.active &&
                (p.role === "school-admin" || alert.byId === p.actor.person);
              return (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  footer={
                    <span className="pk-ack">
                      <span className="pk-meter" aria-hidden="true">
                        <i style={{ width: percent + "%" }} />
                      </span>
                      <small>
                        Seen by {seen} of {families.length} families ·{" "}
                        {alert.audience === "all"
                          ? "Whole school"
                          : p.records.sections.find(
                              (s) => s.id === alert.audience,
                            )?.grade +
                            " · " +
                            p.records.sections.find(
                              (s) => s.id === alert.audience,
                            )?.name}
                      </small>
                      {canClose && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            p.act(
                              (state) =>
                                closeBroadcast(
                                  state,
                                  p.records,
                                  p.actor,
                                  alert.id,
                                ),
                              "Alert closed. Families no longer see the banner.",
                            )
                          }
                        >
                          Close alert
                        </button>
                      )}
                    </span>
                  }
                />
              );
            })}
          </ul>
        ) : (
          <Empty>No alerts sent yet.</Empty>
        )}
      </Card>

      <Card
        icon={Phone}
        title="Emergency contacts"
        subtitle="Who to call for each child, in order."
        actions={
          <label className="pk-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Find a child</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a child"
            />
          </label>
        }
      >
        <div className="table-scroll">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Child</th>
                <th>First call</th>
                <th>Second call</th>
              </tr>
            </thead>
            <tbody>
              {directory.map((child) => {
                const contacts = contactsOf(p.school, child.id);
                return (
                  <tr key={child.id}>
                    <td>
                      <span className="pk-cell-person">
                        <Avatar name={child.name} size={30} />
                        <span>
                          <strong>{child.name}</strong>
                          <small>{child.sectionLabel}</small>
                        </span>
                      </span>
                    </td>
                    {[0, 1].map((index) => (
                      <td key={index}>
                        {contacts[index] ? (
                          <span className="pk-cell-time">
                            <a href={tel(contacts[index].phone)}>
                              {contacts[index].phone}
                            </a>
                            <small>
                              {contacts[index].name} ·{" "}
                              {contacts[index].relation}
                            </small>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!draft}
        title="Send urgent alert"
        onClose={() => setComposing(undefined)}
      >
        {draft && (
          <ComposeForm
            key={composing}
            p={p}
            sections={own}
            initial={draft}
            onDone={() => setComposing(undefined)}
          />
        )}
      </Modal>
    </div>
  );
}

function ComposeForm({
  p,
  sections,
  initial,
  onDone,
}: {
  p: Preschool;
  sections: { id: string; grade: string; name: string }[];
  initial: (typeof templates)[string];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    ...initial,
    audience: p.role === "teacher" ? (sections[0]?.id ?? "") : "all",
    channels: ["SMS", "WhatsApp"],
  });
  const [error, setError] = useState("");
  const families = form.audience
    ? broadcastFamilies(p.records, form.audience).length
    : 0;
  return (
    <form
      className="pk-form"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          updatePreschoolState((state) =>
            sendBroadcast(state, p.records, p.actor, form, p.iso),
          );
          p.toast.show("Alert sent to " + families + " families.");
          onDone();
        } catch (failure) {
          setError((failure as Error).message);
        }
      }}
    >
      <div className="field-row">
        <label>
          Send to
          <select
            value={form.audience}
            onChange={(event) =>
              setForm({ ...form, audience: event.target.value })
            }
          >
            {p.role === "school-admin" && (
              <option value="all">Every family</option>
            )}
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.grade} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(event) =>
              setForm({
                ...form,
                category: event.target.value as Broadcast["category"],
              })
            }
          >
            {broadcastCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Title
        <input
          required
          maxLength={80}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label>
        Message
        <textarea
          required
          maxLength={500}
          value={form.message}
          onChange={(event) =>
            setForm({ ...form, message: event.target.value })
          }
        />
      </label>
      <fieldset className="pk-inline-checks">
        <legend>Also send by</legend>
        {["SMS", "WhatsApp"].map((channel) => (
          <label key={channel} className="check-row">
            <input
              type="checkbox"
              checked={form.channels.includes(channel)}
              onChange={(event) =>
                setForm({
                  ...form,
                  channels: event.target.checked
                    ? [...form.channels, channel]
                    : form.channels.filter((item) => item !== channel),
                })
              }
            />
            {channel}
          </label>
        ))}
      </fieldset>
      <p className="field-hint">
        Reaches {families} families. Parents see a banner at the top of the app
        until they tap “Got it”.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
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
          className="button button-primary pk-danger-button"
        >
          <Siren size={15} aria-hidden="true" /> Send alert now
        </button>
      </div>
    </form>
  );
}

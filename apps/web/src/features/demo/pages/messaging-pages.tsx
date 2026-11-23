"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  Info,
  Lock,
  Megaphone,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { saveAcademicRecord } from "@/services/academic-model";
import { updateAcademicState } from "@/services/academic-store";
import { sectionName } from "@/services/calendar-model";
import {
  updateCommunicationState,
  useCommunicationState,
} from "@/services/communication-store";
import { useNow } from "@/services/learning-store";
import {
  communicationStats,
  conversationsFor,
  canConverse,
  markConversationRead,
  messageLimit,
  messagesFor,
  messageTopics,
  parentsForTeacher,
  sendMessage,
  setConversationStatus,
  startConversation,
  teachersForChild,
  type ConversationView,
  type MessageTopic,
} from "@/services/messaging-model";
import { useDemo } from "../demo-context";
import { EmptyState, StatCards } from "../dashboard-widgets";
import { FormDialog, type FormConfig } from "../form-dialog";
import { formatDate, newId } from "../format";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";
import { useToast } from "../toast";

/* ---------- Helpers ---------- */

const pad = (value: number) => String(value).padStart(2, "0");
function localDay(iso: string) {
  const date = new Date(iso);
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate())
  );
}
function localTime(iso: string) {
  const date = new Date(iso);
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}
/** "14:05" today, otherwise "20 Nov". Rendered only after hydration. */
function shortStamp(iso: string, now: Date) {
  const day = localDay(iso);
  const today = localDay(now.toISOString());
  return day === today
    ? localTime(iso)
    : formatDate(day).replace(/ \d{4}$/, "");
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function Loading() {
  return <p className="field-hint">Loading messages…</p>;
}

function LocalDemoNote() {
  return (
    <p className="msg-demo-note" role="note">
      <Info size={16} aria-hidden="true" />
      <span>
        <strong>Local demo.</strong> Messages are saved in this browser only and
        won&apos;t sync to other browsers or devices. Use{" "}
        <Link href="/demo/select-profile">Switch Demo Role</Link> to reply as
        the other participant.
      </span>
    </p>
  );
}

/* ---------- Inbox (parents and teachers) ---------- */

export function MessagesInbox() {
  return (
    <Suspense fallback={<Loading />}>
      <InboxRoute />
    </Suspense>
  );
}

function InboxRoute() {
  const params = useSearchParams();
  const requested = params.get("conversation") ?? undefined;
  return <Inbox key={requested ?? "inbox"} requested={requested} />;
}

type StatusFilter = "all" | "unread" | "open" | "resolved";

function Inbox({ requested }: { requested?: string }) {
  const { role, records, actor, data, setChild } = useDemo();
  const comm = useCommunicationState();
  const now = useNow(30_000);
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | undefined>(requested);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [section, setSection] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const thread = useRef<HTMLOListElement>(null);

  const school = comm.schools[actor.school];
  const conversations = conversationsFor(comm, records, actor);
  const selected = conversations.find((item) => item.id === selectedId);

  // A notification can point at a conversation about another linked child.
  useEffect(() => {
    if (role !== "parent" || !requested || selected) return;
    const target = school?.conversations.find(
      (item) => item.id === requested && item.parentId === actor.person,
    );
    if (target && data.children.some((child) => child.id === target.studentId))
      setChild(target.studentId);
  }, [
    role,
    requested,
    selected,
    school,
    actor.person,
    data.children,
    setChild,
  ]);

  // Opening a conversation marks the other participant's messages read.
  const unread = selected?.unread ?? 0;
  useEffect(() => {
    if (!selectedId || !unread) return;
    updateCommunicationState((state) =>
      markConversationRead(state, records, actor, selectedId, new Date()),
    );
  }, [selectedId, unread, records, actor]);

  const messageCount = selected
    ? messagesFor(comm, records, actor, selected.id).length
    : 0;
  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [selectedId, messageCount]);

  if (!now) return <Loading />;
  if (role === "parent" && !data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );

  const contacts =
    role === "parent"
      ? teachersForChild(records, actor.school, actor.person, actor.child ?? "")
      : [];
  const parents =
    role === "teacher"
      ? parentsForTeacher(records, actor.school, actor.person)
      : [];
  const teacherSections = [...new Set(parents.map((item) => item.sectionId))];

  const counterpart = (item: ConversationView) =>
    role === "parent"
      ? {
          name:
            records.teachers.find((entry) => entry.id === item.teacherId)
              ?.name ?? "Teacher",
          label: "Teacher",
        }
      : {
          name:
            records.guardians.find((entry) => entry.id === item.parentId)
              ?.name ?? "Parent",
          label:
            (records.links.find(
              (entry) =>
                entry.guardian === item.parentId &&
                entry.student === item.studentId,
            )?.relationship ?? "Parent") +
            " of " +
            studentName(item.studentId),
        };
  function studentName(id: string) {
    return records.students.find((item) => item.id === id)?.name ?? "Student";
  }

  const term = query.trim().toLowerCase();
  const filtered = conversations.filter((item) => {
    if (status === "unread" && !item.unread) return false;
    if (status === "open" && item.status !== "Open") return false;
    if (status === "resolved" && item.status !== "Resolved") return false;
    if (section && item.sectionId !== section) return false;
    if (!term) return true;
    const haystack = [
      item.title,
      item.topic,
      counterpart(item).name,
      studentName(item.studentId),
      ...item.subjects,
      ...messagesFor(comm, records, actor, item.id).map(
        (message) => message.messageBody,
      ),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });
  const totalUnread = conversations.reduce((sum, item) => sum + item.unread, 0);
  const messages = selected
    ? messagesFor(comm, records, actor, selected.id)
    : [];
  const eligible =
    selected &&
    canConverse(
      records,
      actor.school,
      selected.parentId,
      selected.studentId,
      selected.teacherId,
    );

  const startForm = (): FormConfig => ({
    title: "New conversation",
    description:
      role === "parent"
        ? "Message one of " +
          (data.child?.name ?? "your child") +
          "'s teachers."
        : "Message a parent or guardian of a student in your classes.",
    submitLabel: "Send message",
    fields: [
      role === "parent"
        ? {
            name: "counterpart",
            label: "Teacher",
            type: "select",
            options: contacts.map((item) => ({
              value: item.teacherId,
              label: item.name + " — " + item.subjects.join(", "),
            })),
          }
        : {
            name: "counterpart",
            label: "Parent or guardian",
            type: "select",
            options: parents.map((item) => ({
              value: item.parentId + "|" + item.studentId,
              label:
                item.parentName +
                " (" +
                item.relationship.toLowerCase() +
                " of " +
                item.studentName +
                ")",
              group: sectionName(records, item.sectionId),
            })),
          },
      {
        name: "topic",
        label: "Topic",
        type: "select",
        options: messageTopics.map((topic) => ({ value: topic, label: topic })),
      },
      { name: "title", label: "Subject", hint: "3–120 characters." },
      {
        name: "body",
        label: "Message",
        type: "textarea",
        hint:
          "Up to " +
          messageLimit.toLocaleString("en-IN") +
          " characters. Plain text only — attachments aren't supported in the demo.",
      },
    ],
    values: { topic: "General Inquiry" },
    onSubmit(fields) {
      const [counterpartId, studentId] = String(
        fields.get("counterpart") ?? "",
      ).split("|");
      const id = newId(actor.school + "-conversation");
      updateCommunicationState((state) =>
        startConversation(
          state,
          records,
          actor,
          {
            counterpartId,
            studentId,
            topic: String(fields.get("topic")) as MessageTopic,
            title: String(fields.get("title") ?? ""),
            body: String(fields.get("body") ?? ""),
          },
          new Date(),
          { conversation: id, message: newId(actor.school + "-message") },
        ),
      );
      setSelectedId(id);
      setStatus("all");
      toast.show(
        "Message sent. " +
          (role === "parent" ? "The teacher" : "The parent") +
          " has been notified.",
      );
    },
  });

  const send = () => {
    if (!selected) return;
    if (
      toast.run(
        () =>
          updateCommunicationState((state) =>
            sendMessage(
              state,
              records,
              actor,
              selected.id,
              draft,
              new Date(),
              newId(actor.school + "-message"),
            ),
          ),
        "Message sent.",
      )
    )
      setDraft("");
  };

  const setConversation = (next: "Open" | "Resolved") =>
    toast.run(
      () =>
        updateCommunicationState((state) =>
          setConversationStatus(
            state,
            records,
            actor,
            selected!.id,
            next,
            new Date(),
          ),
        ),
      next === "Resolved" ? "Marked as resolved." : "Conversation reopened.",
    );

  const canStart = role === "parent" ? contacts.length > 0 : parents.length > 0;
  const remaining = messageLimit - draft.length;

  return (
    <div className="msg-page">
      <LocalDemoNote />
      <div className="msg-workspace" data-view={selected ? "thread" : "list"}>
        <section
          className="msg-list-pane dash-card"
          aria-labelledby="msg-list-title"
        >
          <div className="msg-list-head">
            <h2 id="msg-list-title">
              Conversations
              {totalUnread > 0 && (
                <span
                  className="msg-badge"
                  aria-label={totalUnread + " unread messages"}
                >
                  {totalUnread}
                </span>
              )}
            </h2>
            <button
              type="button"
              className="button button-primary"
              disabled={!canStart}
              title={canStart ? undefined : "No eligible contacts"}
              onClick={() => setForm(startForm())}
            >
              <MessageSquarePlus size={16} aria-hidden="true" />
              New
            </button>
          </div>
          {role === "parent" && data.child && (
            <p className="field-hint">
              About {data.child.name}
              {data.children.length > 1 && (
                <>
                  {" · "}
                  <label className="msg-inline-select">
                    <span className="sr-only">Switch child</span>
                    <select
                      value={data.child.id}
                      onChange={(event) => setChild(event.target.value)}
                    >
                      {data.children.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </p>
          )}
          <label className="inline-search msg-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search conversations and messages</span>
            <input
              type="search"
              placeholder="Search messages"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="msg-filters">
            <div
              className="segmented"
              role="group"
              aria-label="Filter conversations"
            >
              {(["all", "unread", "open", "resolved"] as StatusFilter[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={status === item}
                    onClick={() => setStatus(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ),
              )}
            </div>
            {role === "teacher" && teacherSections.length > 0 && (
              <label className="msg-inline-select">
                <span className="sr-only">Class and section</span>
                <select
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                >
                  <option value="">All classes</option>
                  {teacherSections.map((id) => (
                    <option key={id} value={id}>
                      {sectionName(records, id)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {filtered.length ? (
            <ul className="msg-conversations">
              {filtered.map((item) => {
                const person = counterpart(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="msg-conversation"
                      aria-current={item.id === selectedId ? "true" : undefined}
                      data-unread={item.unread > 0 || undefined}
                      onClick={() => {
                        setSelectedId(item.id);
                        setShowDetails(false);
                        setDraft("");
                      }}
                    >
                      <span className="msg-avatar" aria-hidden="true">
                        {initials(person.name)}
                      </span>
                      <span className="msg-conversation-body">
                        <span className="msg-row">
                          <strong>{person.name}</strong>
                          <time dateTime={item.lastMessageAt}>
                            {shortStamp(item.lastMessageAt, now)}
                          </time>
                        </span>
                        <span className="msg-context">
                          {person.label} ·{" "}
                          {sectionName(records, item.sectionId)}
                        </span>
                        <span className="msg-row">
                          <span className="msg-preview">
                            <span className="msg-title">{item.title}</span>
                            {item.lastMessage &&
                              " — " + item.lastMessage.messageBody}
                          </span>
                          {item.unread > 0 && (
                            <span
                              className="msg-badge"
                              aria-label={item.unread + " unread"}
                            >
                              {item.unread}
                            </span>
                          )}
                        </span>
                        <span className="msg-row msg-tags">
                          <span className="pill pill-muted">{item.topic}</span>
                          {item.status === "Resolved" && (
                            <span className="pill pill-success">Resolved</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>
              {conversations.length
                ? "No conversations match your search or filters."
                : canStart
                  ? "No conversations yet. Start one with New."
                  : role === "parent"
                    ? "No teachers are allocated to your child's section yet."
                    : "You have no assigned students with linked parents."}
            </EmptyState>
          )}
        </section>

        <section
          className="msg-thread-pane dash-card"
          aria-label="Conversation"
        >
          {selected ? (
            <>
              <header className="msg-thread-head">
                <button
                  type="button"
                  className="icon-button msg-back"
                  aria-label="Back to conversations"
                  onClick={() => setSelectedId(undefined)}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <span className="msg-avatar" aria-hidden="true">
                  {initials(counterpart(selected).name)}
                </span>
                <div className="msg-thread-title">
                  <h2>{selected.title}</h2>
                  <p>
                    {counterpart(selected).name} · {counterpart(selected).label}
                  </p>
                  <p className="msg-context">
                    {studentName(selected.studentId)} ·{" "}
                    {sectionName(records, selected.sectionId)}
                    {selected.subjects.length
                      ? " · " + selected.subjects.join(", ")
                      : ""}{" "}
                    · {selected.topic}
                  </p>
                </div>
                <div className="card-actions">
                  {selected.status === "Open" ? (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setConversation("Resolved")}
                    >
                      <CheckCheck size={15} aria-hidden="true" />
                      Resolve
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setConversation("Open")}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Conversation details"
                    aria-expanded={showDetails}
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <Info size={18} aria-hidden="true" />
                  </button>
                </div>
              </header>
              {showDetails && (
                <dl className="detail-list msg-details">
                  <div>
                    <dt>Participants</dt>
                    <dd>
                      {
                        records.guardians.find(
                          (item) => item.id === selected.parentId,
                        )?.name
                      }{" "}
                      (parent) and{" "}
                      {
                        records.teachers.find(
                          (item) => item.id === selected.teacherId,
                        )?.name
                      }{" "}
                      (teacher)
                    </dd>
                  </div>
                  <div>
                    <dt>Student</dt>
                    <dd>
                      {studentName(selected.studentId)} ·{" "}
                      {sectionName(records, selected.sectionId)}
                    </dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>
                      {formatDate(localDay(selected.createdAt))} by the{" "}
                      {selected.startedBy}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {selected.status}
                      {selected.resolvedAt
                        ? " on " + formatDate(localDay(selected.resolvedAt))
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Privacy</dt>
                    <dd>
                      <Lock size={13} aria-hidden="true" /> Only the two
                      participants can read this conversation.
                    </dd>
                  </div>
                </dl>
              )}
              <ol
                className="msg-thread"
                ref={thread}
                aria-label="Messages"
                tabIndex={0}
              >
                {messages.map((message, index) => {
                  const own = message.senderRole === role;
                  const day = localDay(message.createdAt);
                  const divider =
                    !index || day !== localDay(messages[index - 1].createdAt);
                  return (
                    <li key={message.id} className={own ? "msg-own" : "msg-in"}>
                      {divider && (
                        <span className="msg-day">{formatDate(day)}</span>
                      )}
                      <div className="msg-bubble">
                        <p>{message.messageBody}</p>
                        <span className="msg-meta">
                          <span className="sr-only">
                            {own ? "You" : counterpart(selected).name},{" "}
                          </span>
                          <time dateTime={message.createdAt}>
                            {localTime(message.createdAt)}
                          </time>
                          {own && (message.readAt ? " · Seen" : " · Sent")}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {selected.status === "Resolved" ? (
                <p className="msg-closed">
                  This conversation is resolved. Reopen it to send another
                  message.
                </p>
              ) : !eligible ? (
                <p className="msg-closed">
                  The teacher no longer teaches this student, so new messages
                  can&apos;t be sent.
                </p>
              ) : (
                <form
                  className="msg-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <label htmlFor="msg-draft" className="sr-only">
                    Reply to {counterpart(selected).name}
                  </label>
                  <textarea
                    id="msg-draft"
                    value={draft}
                    maxLength={messageLimit}
                    rows={2}
                    placeholder={"Reply to " + counterpart(selected).name}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.ctrlKey || event.metaKey)
                      ) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    aria-describedby="msg-draft-hint"
                  />
                  <div className="msg-composer-bar">
                    <span
                      id="msg-draft-hint"
                      className="field-hint"
                      data-low={remaining < 100 || undefined}
                    >
                      {remaining.toLocaleString("en-IN")} characters left ·
                      Ctrl+Enter to send
                    </span>
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={!draft.trim()}
                    >
                      <Send size={15} aria-hidden="true" />
                      Send
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="msg-empty">
              <MessageSquarePlus size={28} aria-hidden="true" />
              <h2>Select a conversation</h2>
              <p className="muted-copy">
                {role === "parent"
                  ? "Choose a conversation or start a new one with one of your child's teachers."
                  : "Choose a conversation or start a new one with a parent from your classes."}
              </p>
            </div>
          )}
        </section>
      </div>
      <FormDialog config={form} onClose={() => setForm(undefined)} />
      {toast.element}
    </div>
  );
}

/* ---------- School admin overview ---------- */

function duration(minutes?: number) {
  if (minutes === undefined) return "—";
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  return hours + " h" + (minutes % 60 ? " " + (minutes % 60) + " min" : "");
}

export function AdminCommunication() {
  const { records, actor, role } = useDemo();
  const comm = useCommunicationState();
  const toast = useToast();
  const [form, setForm] = useState<FormConfig>();
  if (role !== "school-admin") return null;
  const stats = communicationStats(comm, records, actor);
  const maxTopic = Math.max(1, ...stats.byTopic.map((item) => item.count));
  const notices = [...records.announcements].reverse().slice(0, 5);

  const noticeForm: FormConfig = {
    title: "Send an administrative notice",
    description:
      "Notices appear on the Announcements page and in the notification panel of everyone in the audience.",
    submitLabel: "Publish notice",
    fields: [
      { name: "name", label: "Title" },
      { name: "message", label: "Message", type: "textarea" },
      {
        name: "audience",
        label: "Audience",
        type: "select",
        options: [
          { value: "All", label: "Everyone" },
          { value: "teacher", label: "Teachers" },
          { value: "student", label: "Students" },
          { value: "parent", label: "Parents" },
        ],
      },
      {
        name: "section",
        label: "Class and section",
        type: "select",
        required: false,
        options: [
          { value: "", label: "Whole school" },
          ...records.sections
            .filter((item) => item.status === "Active")
            .map((item) => ({
              value: item.id,
              label: item.grade + " · " + item.name,
            })),
        ],
      },
    ],
    values: { audience: "All", section: "" },
    onSubmit(fields) {
      updateAcademicState((state) =>
        saveAcademicRecord(state, actor, "announcements", {
          id: newId(actor.school + "-notice"),
          name: String(fields.get("name") ?? ""),
          message: String(fields.get("message") ?? ""),
          audience: String(fields.get("audience") ?? ""),
          section: String(fields.get("section") ?? ""),
          status: "Published",
        }),
      );
      toast.show("Notice published.");
    },
  };

  return (
    <div className="msg-page">
      <StatCards
        stats={[
          {
            label: "Conversations",
            value: String(stats.total),
            note: stats.open + " open · " + stats.resolved + " resolved",
            icon: "tasks",
          },
          {
            label: "Awaiting a reply",
            value: String(stats.awaitingReply),
            note: "Open, last message from a parent",
            icon: "attendance",
          },
          {
            label: "Unread messages",
            value: String(stats.unreadMessages),
            note: "Not yet opened by the recipient",
            icon: "calendar",
          },
          {
            label: "Average first response",
            value: duration(stats.averageResponseMinutes),
            note: "Across " + stats.responded + " answered conversation(s)",
            icon: "teachers",
          },
        ]}
      />
      <div className="dashboard-grid">
        <SectionCard
          title="By teacher"
          description="Conversation load and pending replies. No message content is shown."
        >
          {stats.byTeacher.length ? (
            <div className="table-wrap">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th scope="col">Teacher</th>
                    <th scope="col">Conversations</th>
                    <th scope="col">Awaiting reply</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byTeacher.map((item) => (
                    <tr key={item.teacherId}>
                      <td>{item.name}</td>
                      <td>{item.conversations}</td>
                      <td>
                        {item.awaitingReply ? (
                          <span className="pill pill-warning">
                            {item.awaitingReply}
                          </span>
                        ) : (
                          <span className="pill pill-success">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No teacher–parent conversations yet.</EmptyState>
          )}
        </SectionCard>
        <SectionCard
          title="By topic"
          description="What families and teachers are writing about"
        >
          <ul className="msg-topic-bars">
            {stats.byTopic.map((item) => (
              <li key={item.topic}>
                <span>{item.topic}</span>
                <span className="bar-track" aria-hidden="true">
                  <span
                    style={{ width: (100 * item.count) / maxTopic + "%" }}
                  />
                </span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      <div className="dashboard-grid">
        <SectionCard
          title="Administrative notices"
          description="Send school-wide or class notices. They are not private messages."
          actions={
            <button
              type="button"
              className="button button-primary"
              onClick={() => setForm(noticeForm)}
            >
              <Megaphone size={16} aria-hidden="true" />
              New notice
            </button>
          }
        >
          {notices.length ? (
            <ul className="stack-list">
              {notices.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span className="cell-note">
                    {item.audience === "All" ? "Everyone" : item.audience + "s"}
                    {item.section
                      ? " · " + sectionName(records, item.section)
                      : ""}{" "}
                    · {item.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No notices yet.</EmptyState>
          )}
          <Link
            className="view-all"
            href={roleHref("school-admin", "announcements")}
          >
            Manage all announcements
          </Link>
        </SectionCard>
        <SectionCard
          title="Privacy and oversight policy"
          description="How private teacher–parent messages are protected"
        >
          <ul className="msg-policy">
            <li>
              <ShieldCheck size={16} aria-hidden="true" />
              Administrators see counts and response times only — never subject
              lines or message text.
            </li>
            <li>
              <Lock size={16} aria-hidden="true" />
              Reading a conversation for safeguarding or a complaint would
              require a documented request, approval by a second authorised
              person, a time-limited grant and a permanent audit-log entry that
              participants can be told about. This is enforced on the server, so
              it isn&apos;t available in the browser demo.
            </li>
            <li>
              <Info size={16} aria-hidden="true" />
              Students can&apos;t open teacher–parent conversations. Parents see
              only their linked children&apos;s conversations, and teachers only
              those for students they teach.
            </li>
          </ul>
        </SectionCard>
      </div>
      <FormDialog config={form} onClose={() => setForm(undefined)} />
      {toast.element}
    </div>
  );
}

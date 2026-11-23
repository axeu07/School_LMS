"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import type { DemoRole, DemoRow } from "@/types/demo";
import { useDemo, type DemoContextValue } from "./demo-context";
import { deals, seedCandidates, seedLeads } from "./pages/growth-pages";

/* ---------- Mascot ---------- */

export type Gesture = "idle" | "wave" | "think" | "talk" | "cheer" | "walk";

/** Animated assistant character: head with a face, arms with hands, and legs. */
export function Mascot({ gesture }: { gesture: Gesture }) {
  return (
    <svg
      className="mascot"
      data-gesture={gesture}
      viewBox="0 0 120 160"
      aria-hidden="true"
    >
      <ellipse className="m-shadow" cx="60" cy="153" rx="26" ry="4" />
      <g className="m-figure">
        {/* legs */}
        <g className="m-leg m-leg-left">
          <rect x="45" y="104" width="10" height="34" rx="5" />
          <ellipse className="m-foot" cx="48" cy="141" rx="10" ry="5" />
        </g>
        <g className="m-leg m-leg-right">
          <rect x="65" y="104" width="10" height="34" rx="5" />
          <ellipse className="m-foot" cx="72" cy="141" rx="10" ry="5" />
        </g>
        {/* arms (behind body) */}
        <g className="m-arm m-arm-left">
          <rect x="21" y="70" width="10" height="34" rx="5" />
          <g className="m-hand">
            <circle cx="26" cy="106" r="7" />
            <rect x="19" y="99" width="4" height="7" rx="2" />
          </g>
        </g>
        <g className="m-arm m-arm-right">
          <rect x="89" y="70" width="10" height="34" rx="5" />
          <g className="m-hand">
            <circle cx="94" cy="106" r="7" />
            <rect x="97" y="99" width="4" height="7" rx="2" />
          </g>
        </g>
        {/* body */}
        <rect className="m-body" x="32" y="64" width="56" height="46" rx="16" />
        <rect className="m-belly" x="44" y="74" width="32" height="22" rx="8" />
        <path
          className="m-badge"
          d="M60 78 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z"
        />
        {/* head */}
        <g className="m-head">
          <line className="m-antenna" x1="60" y1="14" x2="60" y2="4" />
          <circle className="m-antenna-tip" cx="60" cy="4" r="4" />
          <rect
            className="m-skull"
            x="28"
            y="12"
            width="64"
            height="50"
            rx="22"
          />
          <rect
            className="m-face"
            x="35"
            y="20"
            width="50"
            height="34"
            rx="15"
          />
          <ellipse className="m-cheek" cx="42" cy="44" rx="4" ry="2.5" />
          <ellipse className="m-cheek" cx="78" cy="44" rx="4" ry="2.5" />
          <g className="m-eyes">
            <ellipse className="m-eye" cx="49" cy="35" rx="4.2" ry="5.2" />
            <ellipse className="m-eye" cx="71" cy="35" rx="4.2" ry="5.2" />
            <circle className="m-glint" cx="50.5" cy="33" r="1.3" />
            <circle className="m-glint" cx="72.5" cy="33" r="1.3" />
          </g>
          <path className="m-smile" d="M52 44 q8 7 16 0" />
          <ellipse className="m-mouth" cx="60" cy="46" rx="5" ry="3.5" />
        </g>
      </g>
    </svg>
  );
}

/* ---------- Role-aware demo answers ---------- */

type Message = {
  id: number;
  from: "bot" | "user";
  text: string;
  rows?: DemoRow[];
};
type Reply = { text: string; rows?: DemoRow[]; gesture?: Gesture };

const suggestions: Record<DemoRole, string[]> = {
  "super-admin": [
    "Platform summary",
    "Schools on trial",
    "Recent activity",
    "What can you do?",
  ],
  "school-admin": [
    "Today's summary",
    "New leads",
    "Interviews this week",
    "Upcoming deals",
  ],
  teacher: [
    "My schedule",
    "Assignments to review",
    "Student doubts",
    "Upcoming assessments",
  ],
  student: ["Pending homework", "My attendance", "My timetable", "Study tip"],
  parent: [
    "Child's attendance",
    "Homework due",
    "Upcoming exams",
    "Announcements",
  ],
};

const studyTips = [
  "Try the 25/5 Pomodoro: 25 minutes of focus, 5 minutes of rest. After four rounds, take a longer break.",
  "Explain a topic out loud as if teaching a friend — gaps in your understanding show up fast.",
  "Revise weak topics first while your mind is fresh, then finish with something you enjoy.",
];

const has = (text: string, ...words: string[]) =>
  words.some((word) => text.includes(word));

function answer(input: string, ctx: DemoContextValue): Reply {
  const text = input.toLowerCase();
  const { role, data, school, schools } = ctx;
  const stat = (label: string) =>
    data.stats.find((item) => item.label === label);
  const panel = (id: string) => data.panels.find((item) => item.id === id);
  const rowsOf = (id: string, limit = 4) =>
    panel(id)?.rows.slice(0, limit) ?? [];
  const who = role === "parent" ? (data.child?.name ?? "your child") : "you";

  if (has(text, "hello", "hi", "hey", "namaste"))
    return {
      text:
        "Hello " +
        data.person.name.split(" ")[0] +
        "! 👋 Ask me anything about " +
        (role === "super-admin" ? "the platform" : school.name) +
        ".",
      gesture: "wave",
    };
  if (has(text, "what can you do", "help"))
    return {
      text:
        "I can answer quick questions using your " +
        ctx.profile.label +
        " workspace. Try one of these:",
      rows: suggestions[role].slice(0, 3).map((item) => ({
        title: item,
        detail: "Tap a suggestion below or type it",
      })),
      gesture: "cheer",
    };
  if (has(text, "thank"))
    return {
      text: "You're welcome! Happy to help any time. 🎉",
      gesture: "cheer",
    };

  if (role === "super-admin") {
    if (has(text, "trial"))
      return {
        text: "Schools currently on a trial plan:",
        rows: schools
          .filter((item) => item.status === "Trial")
          .map((item) => ({
            title: item.name,
            detail: item.location + " · " + item.students + " students",
            meta: item.plan,
          })),
      };
    if (has(text, "activity", "recent"))
      return { text: "Latest platform activity:", rows: rowsOf("activity") };
    if (has(text, "subscription", "plan", "billing"))
      return { text: "Subscription overview:", rows: rowsOf("subscriptions") };
    if (has(text, "summary", "platform", "school"))
      return {
        text: "Here's the platform at a glance:",
        rows: data.stats.map((item) => ({
          title: item.label,
          detail: item.note,
          meta: item.value,
        })),
      };
  }

  if (role === "school-admin") {
    if (
      has(text, "lead", "enquir", "admission", "instagram", "facebook", "meta")
    ) {
      const fresh = seedLeads.filter((lead) => lead.stage === "New");
      return {
        text: fresh.length + " new leads need a first call. Newest first:",
        rows: fresh.map((lead) => ({
          title: lead.name + " · " + lead.grade,
          detail: lead.source + " · " + lead.campaign,
          meta: "Follow up " + lead.followUp,
        })),
      };
    }
    if (has(text, "interview", "recruit", "hiring", "candidate")) {
      const upcoming = seedCandidates.filter((item) => item.interview);
      return {
        text: upcoming.length + " interviews are booked this week:",
        rows: upcoming.map((item) => ({
          title: item.name,
          detail: item.role,
          meta: item.interview!.date + " " + item.interview!.time,
        })),
      };
    }
    if (has(text, "deal", "collab", "partner", "sponsor"))
      return {
        text: "Deals closing soon:",
        rows: deals.slice(0, 4).map((deal) => ({
          title: deal.partner,
          detail: deal.kind + " · " + deal.stage,
          meta: deal.probability + "%",
        })),
      };
    if (has(text, "event"))
      return {
        text: "Upcoming events at " + school.name + ":",
        rows: rowsOf("events"),
      };
    if (
      has(
        text,
        "summary",
        "today",
        "overview",
        "attendance",
        "student",
        "teacher",
      )
    )
      return {
        text: "Today at " + school.name + ":",
        rows: data.stats.map((item) => ({
          title: item.label,
          detail: item.note,
          meta: item.value,
        })),
      };
  }

  if (has(text, "attendance", "present", "absent")) {
    const value = stat("Attendance") ?? stat("Recorded attendance");
    return value
      ? {
          text:
            (role === "parent" ? data.child?.name + "'s" : "Your") +
            " recorded attendance is " +
            value.value +
            ". " +
            (parseInt(value.value) >= 85
              ? "Great consistency — keep it up! ✅"
              : "A little below the 85% target — let's aim for full weeks. 💪"),
          gesture: parseInt(value.value) >= 85 ? "cheer" : "talk",
        }
      : { text: "No attendance has been recorded yet." };
  }
  if (has(text, "homework", "assignment", "review", "due", "pending")) {
    const id = role === "teacher" ? "assignments" : "homework";
    const rows = rowsOf(id);
    return rows.length
      ? {
          text:
            role === "teacher"
              ? "Submissions waiting for your review:"
              : "Open homework for " + who + ":",
          rows,
        }
      : {
          text:
            role === "teacher"
              ? "Nothing to review right now. 🎉"
              : "No pending homework — all caught up! 🎉",
          gesture: "cheer",
        };
  }
  if (has(text, "schedule", "timetable", "class", "lesson", "next")) {
    const rows = rowsOf("schedule", 5);
    return rows.length
      ? {
          text:
            "Here's " +
            (role === "parent" ? who + "'s" : "your") +
            " weekly timetable:",
          rows,
        }
      : { text: "No sessions on the timetable yet." };
  }
  if (has(text, "doubt", "question"))
    return rowsOf("doubts").length
      ? { text: "Most recent anonymous doubts:", rows: rowsOf("doubts") }
      : { text: "No new doubts from your classes." };
  if (has(text, "exam", "quiz", "test", "assessment")) {
    const rows = [
      ...rowsOf("assessments"),
      ...rowsOf("quizzes"),
      ...rowsOf("exams"),
    ];
    return rows.length
      ? { text: "Upcoming assessments:", rows }
      : { text: "No assessments are scheduled right now." };
  }
  if (has(text, "announcement", "notice", "news"))
    return rowsOf("announcements", 3).length
      ? { text: "Latest announcements:", rows: rowsOf("announcements", 3) }
      : { text: "No announcements yet." };
  if (has(text, "tip", "study", "focus", "motivat"))
    return {
      text: studyTips[Math.floor(Math.random() * studyTips.length)],
      gesture: "cheer",
    };
  if (has(text, "result", "grade", "mark", "score"))
    return rowsOf("assignment-results").length
      ? { text: "Recent graded work:", rows: rowsOf("assignment-results") }
      : { text: "No graded work yet." };

  return {
    text: "I'm a demo assistant, so I only know this workspace's sample data. Try one of the suggestions below. 🙂",
    gesture: "think",
  };
}

/* ---------- Widget ---------- */

export function ChatAssistant() {
  const ctx = useDemo();
  const { role, data, profile } = ctx;
  const firstName = data.person.name.split(" ")[0];
  const [open, setOpen] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("walk");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [nudge, setNudge] = useState(true);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      from: "bot",
      text:
        "Hi " +
        firstName +
        "! I'm Orbi, your " +
        profile.label +
        " assistant. What would you like to know?",
    },
  ]);
  const timers = useRef<number[]>([]);
  const log = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const play = (next: Gesture, ms = 1800) => {
    setGesture(next);
    later(() => setGesture("idle"), ms);
  };

  // Walk in, wave hello, then idle with an occasional wave while closed.
  useEffect(() => {
    later(() => play("wave", 2200), 1400);
    later(() => setNudge(false), 9000);
    const interval = window.setInterval(() => {
      setGesture((current) => (current === "idle" ? "wave" : current));
      later(
        () => setGesture((current) => (current === "wave" ? "idle" : current)),
        1800,
      );
    }, 14000);
    const pending = timers.current;
    return () => {
      window.clearInterval(interval);
      pending.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || typing) return;
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "user", text },
    ]);
    setDraft("");
    setTyping(true);
    setGesture("think");
    const reply = answer(text, ctx);
    later(
      () => {
        setTyping(false);
        setMessages((current) => [
          ...current,
          { id: nextId.current++, from: "bot", ...reply },
        ]);
        play(reply.gesture ?? "talk", 2000);
      },
      900 + Math.min(900, reply.text.length * 8),
    );
  };

  const toggle = () => {
    setNudge(false);
    setOpen((value) => !value);
    play(open ? "wave" : "cheer", 1500);
  };

  return (
    <div className="chat-assistant" data-open={open ? "true" : undefined}>
      {open && (
        <section className="chat-panel" aria-label="Orbi assistant">
          <header>
            <span className="chat-avatar">
              <Mascot
                gesture={
                  typing ? "think" : gesture === "walk" ? "idle" : gesture
                }
              />
            </span>
            <div>
              <strong>Orbi</strong>
              <small>
                <i className="chat-online" /> {profile.label} assistant · demo
                data
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close assistant"
              onClick={toggle}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="chat-log" ref={log} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={"chat-msg chat-" + message.from}>
                <p>{message.text}</p>
                {message.rows && message.rows.length > 0 && (
                  <ul>
                    {message.rows.map((row, index) => (
                      <li key={index}>
                        <span>
                          <strong>{row.title}</strong>
                          {row.detail && <small>{row.detail}</small>}
                        </span>
                        {row.meta && <em>{row.meta}</em>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {typing && (
              <div
                className="chat-msg chat-bot chat-typing"
                aria-label="Orbi is typing"
              >
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="chat-chips">
            {suggestions[role].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => ask(item)}
                disabled={typing}
              >
                {item}
              </button>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => gesture === "idle" && play("think", 1200)}
              placeholder="Ask Orbi…"
              aria-label="Message Orbi"
            />
            <button
              type="submit"
              className="button button-primary"
              aria-label="Send"
              disabled={!draft.trim() || typing}
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      {nudge && !open && (
        <p className="chat-nudge" role="status">
          Hi {firstName}! Need help? 👋
        </p>
      )}
      <button
        type="button"
        className="chat-launcher"
        aria-label={open ? "Close Orbi assistant" : "Open Orbi assistant"}
        aria-expanded={open}
        onClick={toggle}
        onMouseEnter={() => gesture === "idle" && play("wave", 1600)}
      >
        <Mascot gesture={typing ? "think" : gesture} />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Baby,
  CheckCheck,
  Clock,
  Heart,
  Moon,
  NotebookText,
  Send,
  ShieldAlert,
  Smile,
  Sprout,
  Utensils,
} from "lucide-react";
import {
  activityOptions,
  diaryFor,
  healthOf,
  markDiaryRead,
  mealLevels,
  meals,
  moods,
  replyToDiary,
  saveDiary,
  visibleDiaries,
  type Diary,
  type DiaryInput,
  type MealLevel,
} from "@/services/preschool-model";
import { updatePreschoolState } from "@/services/preschool-store";
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
  weekday,
  type Preschool,
} from "./ui";

export function DailyDiaryPage() {
  const p = usePreschool();
  return (
    <Ready now={p.now}>
      {p.role === "parent" ? <ParentDiary p={p} /> : <StaffDiary p={p} />}
      {p.toast.element}
    </Ready>
  );
}

/* ---------- Shared pieces ---------- */

const mealNames = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack" };
const mealFill: Record<MealLevel, number> = {
  All: 4,
  Most: 3,
  Some: 2,
  None: 0,
};

export function moodOf(key: string) {
  return moods.find((item) => item.key === key) ?? moods[0];
}

function napLength(diary: Pick<Diary, "napStart" | "napEnd">) {
  if (!diary.napStart || !diary.napEnd) return "No nap";
  const [a, b] = [diary.napStart, diary.napEnd].map((time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  });
  const span = b - a;
  return (
    (span >= 60 ? Math.floor(span / 60) + " h " : "") + (span % 60) + " min"
  );
}

function MealMeter({ level }: { level: MealLevel }) {
  return (
    <span className="pk-meal-meter" aria-label={level + " eaten"}>
      {[0, 1, 2, 3].map((index) => (
        <i key={index} data-on={index < mealFill[level] ? "" : undefined} />
      ))}
    </span>
  );
}

/** The parent-facing diary page for one day. */
export function DiarySheet({ diary }: { diary: Diary }) {
  const mood = moodOf(diary.mood);
  return (
    <div className="pk-diary-sheet">
      <div className="pk-diary-mood">
        <span className="pk-diary-emoji" aria-hidden="true">
          {mood.emoji}
        </span>
        <span>
          <small>Mood</small>
          <strong>{mood.label}</strong>
        </span>
      </div>
      <div className="pk-diary-grid">
        <div className="pk-diary-tile">
          <h3>
            <Utensils size={15} aria-hidden="true" /> Meals
          </h3>
          <ul className="pk-meals">
            {meals.map((meal) => (
              <li key={meal}>
                <span>{mealNames[meal]}</span>
                <MealMeter level={diary.meals[meal]} />
                <small>{diary.meals[meal]}</small>
              </li>
            ))}
          </ul>
        </div>
        <div className="pk-diary-tile">
          <h3>
            <Moon size={15} aria-hidden="true" /> Nap
          </h3>
          <strong className="pk-big">{napLength(diary)}</strong>
          {diary.napStart && (
            <small>
              {friendlyTime(diary.napStart)} – {friendlyTime(diary.napEnd)}
            </small>
          )}
        </div>
        <div className="pk-diary-tile">
          <h3>
            <Baby size={15} aria-hidden="true" /> Toilet
          </h3>
          <strong className="pk-big">
            {diary.potty} potty {diary.potty === 1 ? "visit" : "visits"}
          </strong>
          <small>
            {diary.diaper
              ? diary.diaper +
                " diaper change" +
                (diary.diaper === 1 ? "" : "s")
              : "No diaper changes"}
          </small>
        </div>
      </div>
      {diary.activities.length > 0 && (
        <div className="pk-diary-activities">
          <h3>
            <Sprout size={15} aria-hidden="true" /> What we did
          </h3>
          <div className="pk-chips">
            {diary.activities.map((item) => (
              <span key={item} className="pk-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
      {diary.note && (
        <blockquote className="pk-diary-note">
          <p>{diary.note}</p>
          <footer>— {diary.author}</footer>
        </blockquote>
      )}
    </div>
  );
}

/* ---------- Parent ---------- */

const quickReplies = [
  "Thank you! 🙏",
  "Lovely to read, thanks!",
  "Noted, thank you.",
];

function ParentDiary({ p }: { p: Preschool }) {
  const child = p.data.child;
  const diaries = child
    ? visibleDiaries(p.school, p.records, p.actor)
        .filter((item) => item.student === child.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const [chosen, setChosen] = useState<string>();
  const [reply, setReply] = useState("");
  const selected =
    diaries.find((item) => item.id === chosen) ??
    diaries.find((item) => item.date === p.today) ??
    diaries[0];
  const unread = selected && !selected.readAt;
  const selectedId = selected?.id;
  const { records, actor, iso } = p;

  // Opening a diary marks it as read for the teacher.
  useEffect(() => {
    if (!unread || !selectedId) return;
    updatePreschoolState((state) =>
      markDiaryRead(state, records, actor, selectedId, iso),
    );
  }, [unread, selectedId, records, actor, iso]);

  if (!child) return <Empty>No children are linked to your account.</Empty>;
  const first = child.name.split(" ")[0];
  const todaySent = diaries.some((item) => item.date === p.today);

  return (
    <div className="pk-stack">
      {!todaySent && (
        <Note>
          {first}&apos;s diary for today is on its way. Teachers send it by 2:30
          pm, and you&apos;ll get a notification.
        </Note>
      )}
      <div className="pk-day-strip" role="tablist" aria-label="Diary days">
        {diaries.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === selected?.id}
            className="pk-day"
            onClick={() => {
              setChosen(item.id);
              setReply("");
            }}
          >
            <small>{weekday(item.date)}</small>
            <span aria-hidden="true">{moodOf(item.mood).emoji}</span>
            <strong>{dayLabel(item.date, p.today)}</strong>
          </button>
        ))}
      </div>
      {selected ? (
        <Card
          icon={NotebookText}
          title={first + "'s day · " + dayLabel(selected.date, p.today)}
          subtitle={
            "From " +
            selected.author +
            (selected.sentAt
              ? " · sent " +
                friendlyTime(
                  new Date(selected.sentAt).toTimeString().slice(0, 5),
                )
              : "")
          }
          actions={
            selected.reply ? (
              <Pill tone="good" icon={Heart}>
                You replied
              </Pill>
            ) : undefined
          }
        >
          <DiarySheet diary={selected} />
          <div className="pk-reply">
            {selected.reply ? (
              <p className="pk-reply-sent">
                <Heart size={14} aria-hidden="true" />
                Your reply: “{selected.reply}”
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    p.act(
                      (state) =>
                        replyToDiary(
                          state,
                          p.records,
                          p.actor,
                          selected.id,
                          reply,
                        ),
                      "Reply sent to " + selected.author + ".",
                    )
                  )
                    setReply("");
                }}
              >
                <span className="pk-chips">
                  {quickReplies.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="pk-chip pk-chip-button"
                      onClick={() => setReply(text)}
                    >
                      {text}
                    </button>
                  ))}
                </span>
                <span className="pk-reply-row">
                  <input
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={"Reply to " + selected.author.split(" ")[0]}
                    maxLength={300}
                    aria-label="Reply to the teacher"
                  />
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={reply.trim().length < 2}
                  >
                    <Send size={15} aria-hidden="true" /> Send
                  </button>
                </span>
              </form>
            )}
          </div>
        </Card>
      ) : (
        <Empty>No diaries yet. The first one arrives this afternoon.</Empty>
      )}
      {diaries.length > 1 && (
        <Card title="This week at a glance" icon={Smile}>
          <ul className="pk-week">
            {diaries.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span aria-hidden="true">{moodOf(item.mood).emoji}</span>
                <strong>{weekday(item.date)}</strong>
                <small>
                  Lunch: {item.meals.lunch} · Nap: {napLength(item)}
                </small>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------- Teacher & office ---------- */

function blankDiary(student: string, date: string): DiaryInput {
  return {
    student,
    date,
    meals: { breakfast: "All", lunch: "All", snack: "All" },
    napStart: "12:15",
    napEnd: "13:00",
    mood: "happy",
    potty: 2,
    diaper: 0,
    activities: ["Circle time"],
    note: "",
  };
}

function StaffDiary({ p }: { p: Preschool }) {
  const [section, setSection] = useState(p.sections[0]?.id ?? "all");
  const [date, setDate] = useState(p.today);
  const [editing, setEditing] = useState<string>();
  const roster = p.children.filter(
    (child) => section === "all" || child.section === section,
  );
  const rows = roster.map((child) => ({
    child,
    diary: diaryFor(p.school, child.id, date),
    allergies: healthOf(p.school, child.id).allergies,
  }));
  const sent = rows.filter((row) => row.diary?.status === "Sent").length;
  const read = rows.filter((row) => row.diary?.readAt).length;
  const drafts = rows.filter(
    (row) => row.diary?.status === "Draft" && row.diary.note.trim().length >= 5,
  );
  const editingRow = rows.find((row) => row.child.id === editing);

  return (
    <div className="pk-stack">
      <div className="pk-toolbar">
        <ClassFilter
          value={section}
          onChange={setSection}
          sections={p.sections}
          all={p.role === "school-admin"}
        />
        <label className="pk-select">
          <span className="sr-only">Date</span>
          <input
            type="date"
            value={date}
            max={p.today}
            onChange={(event) => setDate(event.target.value || p.today)}
          />
        </label>
        <span className="pk-spacer" />
        {drafts.length > 0 && (
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              p.act(
                (state) => {
                  let next = state;
                  for (const row of drafts) {
                    const { diary } = row;
                    if (diary)
                      next = saveDiary(
                        next,
                        p.records,
                        p.actor,
                        diary,
                        true,
                        p.iso,
                        p.today,
                      );
                  }
                  return next;
                },
                "Sent " + drafts.length + " diaries to parents.",
              )
            }
          >
            <Send size={15} aria-hidden="true" /> Send {drafts.length} ready
            draft{drafts.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <div className="pk-stats">
        <Stat
          icon={NotebookText}
          label="Diaries sent"
          value={sent + " / " + rows.length}
          hint={dayLabel(date, p.today)}
          tone={sent === rows.length && rows.length ? "good" : undefined}
        />
        <Stat
          icon={CheckCheck}
          label="Read by parents"
          value={read}
          hint={sent ? Math.round((read / sent) * 100) + "% of sent" : "—"}
        />
        <Stat
          icon={Clock}
          label="Still to write"
          value={rows.length - sent}
          hint="Send by 2:30 pm"
          tone={rows.length - sent > 0 && date === p.today ? "warn" : undefined}
        />
      </div>
      {rows.length ? (
        <ul className="pk-roster">
          {rows.map(({ child, diary, allergies }) => (
            <li key={child.id}>
              <button
                type="button"
                className="pk-roster-card"
                onClick={() => setEditing(child.id)}
              >
                <Avatar name={child.name} size={44} />
                <span className="pk-roster-copy">
                  <strong>{child.name}</strong>
                  <small>{child.sectionLabel}</small>
                </span>
                <span className="pk-roster-meta">
                  {diary && (
                    <span className="pk-roster-mood" aria-hidden="true">
                      {moodOf(diary.mood).emoji}
                    </span>
                  )}
                  {diary?.readAt ? (
                    <Pill tone="good" icon={CheckCheck}>
                      Read
                    </Pill>
                  ) : diary?.status === "Sent" ? (
                    <Pill tone="info">Sent</Pill>
                  ) : diary ? (
                    <Pill tone="warn">Draft</Pill>
                  ) : (
                    <Pill>Not started</Pill>
                  )}
                  {allergies.length > 0 && (
                    <Pill tone="danger" icon={ShieldAlert}>
                      {allergies.map((item) => item.name).join(", ")}
                    </Pill>
                  )}
                </span>
                {diary?.reply && (
                  <span className="pk-roster-reply">
                    <Heart size={12} aria-hidden="true" /> “{diary.reply}”
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No children in this class.</Empty>
      )}
      <Modal
        open={!!editingRow}
        title={
          editingRow
            ? editingRow.child.name + " · " + dayLabel(date, p.today)
            : ""
        }
        onClose={() => setEditing(undefined)}
        wide
      >
        {editingRow && (
          <DiaryEditor
            key={editingRow.child.id + date}
            initial={editingRow.diary ?? blankDiary(editingRow.child.id, date)}
            sent={editingRow.diary?.status === "Sent"}
            onSave={(input, send) => {
              if (
                p.act(
                  (state) =>
                    saveDiary(
                      state,
                      p.records,
                      p.actor,
                      input,
                      send,
                      p.iso,
                      p.today,
                    ),
                  send
                    ? "Diary sent to " +
                        editingRow.child.name.split(" ")[0] +
                        "'s parents."
                    : "Draft saved.",
                )
              )
                setEditing(undefined);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function DiaryEditor({
  initial,
  sent,
  onSave,
}: {
  initial: DiaryInput;
  sent: boolean;
  onSave: (input: DiaryInput, send: boolean) => void;
}) {
  const [draft, setDraft] = useState<DiaryInput>({
    student: initial.student,
    date: initial.date,
    meals: { ...initial.meals },
    napStart: initial.napStart,
    napEnd: initial.napEnd,
    mood: initial.mood,
    potty: initial.potty,
    diaper: initial.diaper,
    activities: [...initial.activities],
    note: initial.note,
  });
  const napped = !!(draft.napStart || draft.napEnd);
  const set = (patch: Partial<DiaryInput>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return (
    <form
      className="pk-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        onSave(draft, submitter?.value === "send");
      }}
    >
      <fieldset>
        <legend>Mood</legend>
        <div className="pk-mood-picker">
          {moods.map((mood) => (
            <button
              key={mood.key}
              type="button"
              aria-pressed={draft.mood === mood.key}
              onClick={() => set({ mood: mood.key })}
            >
              <span aria-hidden="true">{mood.emoji}</span>
              {mood.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Meals</legend>
        {meals.map((meal) => (
          <div className="pk-meal-row" key={meal}>
            <span>{mealNames[meal]}</span>
            <div
              className="pk-segment"
              role="group"
              aria-label={mealNames[meal]}
            >
              {mealLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={draft.meals[meal] === level}
                  onClick={() =>
                    set({ meals: { ...draft.meals, [meal]: level } })
                  }
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <div className="pk-editor-row">
        <fieldset>
          <legend>Nap</legend>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!napped}
              onChange={(event) =>
                set(
                  event.target.checked
                    ? { napStart: "", napEnd: "" }
                    : { napStart: "12:15", napEnd: "13:00" },
                )
              }
            />
            Didn&apos;t nap today
          </label>
          {napped && (
            <span className="pk-time-pair">
              <label>
                From
                <input
                  type="time"
                  value={draft.napStart}
                  onChange={(event) => set({ napStart: event.target.value })}
                />
              </label>
              <label>
                To
                <input
                  type="time"
                  value={draft.napEnd}
                  onChange={(event) => set({ napEnd: event.target.value })}
                />
              </label>
            </span>
          )}
        </fieldset>
        <fieldset>
          <legend>Toilet</legend>
          <Stepper
            label="Potty visits"
            value={draft.potty}
            onChange={(potty) => set({ potty })}
          />
          <Stepper
            label="Diaper changes"
            value={draft.diaper}
            onChange={(diaper) => set({ diaper })}
          />
        </fieldset>
      </div>
      <fieldset>
        <legend>Activities</legend>
        <div className="pk-chips">
          {activityOptions.map((item) => {
            const on = draft.activities.includes(item);
            return (
              <button
                key={item}
                type="button"
                className="pk-chip pk-chip-button"
                aria-pressed={on}
                onClick={() =>
                  set({
                    activities: on
                      ? draft.activities.filter((value) => value !== item)
                      : [...draft.activities, item],
                  })
                }
              >
                {item}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label>
        Note for parents
        <textarea
          value={draft.note}
          maxLength={600}
          onChange={(event) => set({ note: event.target.value })}
          placeholder="A highlight from the day, anything parents should know…"
        />
        <span className="field-hint">{draft.note.length}/600</span>
      </label>
      <div className="academic-toolbar">
        {!sent && (
          <button type="submit" value="draft" className="button button-outline">
            Save draft
          </button>
        )}
        <button type="submit" value="send" className="button button-primary">
          <Send size={15} aria-hidden="true" />
          {sent ? "Update & resend" : "Send to parents"}
        </button>
      </div>
    </form>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <span className="pk-stepper">
      <span>{label}</span>
      <button
        type="button"
        aria-label={"Fewer " + label.toLowerCase()}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={"More " + label.toLowerCase()}
        onClick={() => onChange(Math.min(15, value + 1))}
      >
        +
      </button>
    </span>
  );
}

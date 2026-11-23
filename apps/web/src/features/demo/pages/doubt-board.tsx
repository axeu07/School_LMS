"use client";

import { useState, type FormEvent } from "react";
import { EyeOff, Send, ThumbsUp } from "lucide-react";
import { activeAllocations } from "@/services/assignment-model";
import {
  answerDoubt,
  doubtsFor,
  postDoubt,
  toggleDoubtVote,
  type DoubtView,
} from "@/services/doubt-model";
import { updateDoubtState, useDoubtState } from "@/services/doubt-store";
import { sectionLabel, subjectName } from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState } from "../dashboard-widgets";
import { SectionCard } from "../page-header";

const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const shortDate = (iso: string) =>
  Number(iso.slice(8, 10)) + " " + months[Number(iso.slice(5, 7)) - 1];

export function DoubtBoard() {
  const { role, records, actor } = useDemo();
  const state = useDoubtState();
  const [filter, setFilter] = useState("");
  const [subject, setSubject] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const teacher = role === "teacher";
  const allocations = activeAllocations(records, actor);
  const doubts = doubtsFor(state, records, actor);
  const visible = doubts.filter(
    (item) =>
      (!subject || item.subject === subject) &&
      (!filter ||
        (filter === "Open" ? item.status === "Open" : item.status !== "Open")),
  );
  const subjects = [...new Set(allocations.map((item) => item.subject))];

  function run(action: () => void, message: string) {
    setError("");
    setNotice("");
    try {
      action();
      setNotice(message);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    run(() => {
      updateDoubtState((current) =>
        postDoubt(
          current,
          records,
          actor,
          String(fields.get("allocation")),
          String(fields.get("text")),
          crypto.randomUUID(),
        ),
      );
      form.reset();
    }, "Your doubt was posted anonymously.");
  }

  const author = (doubt: DoubtView) =>
    doubt.own ? "You" : teacher ? "Anonymous student" : "Anonymous classmate";

  return (
    <>
      {!teacher && (
        <SectionCard
          title="Ask a doubt"
          description="Your doubt is fully anonymous — neither classmates nor teachers can see who asked it."
          className="page-section"
        >
          {allocations.length ? (
            <form className="doubt-form" onSubmit={post}>
              <label>
                Subject
                <select name="allocation" required>
                  {allocations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {subjectName(records, item.subject)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                Your doubt
                <textarea
                  name="text"
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="What would you like your teacher to explain?"
                />
              </label>
              <button className="button button-primary" type="submit">
                <EyeOff size={16} aria-hidden="true" />
                Post anonymously
              </button>
            </form>
          ) : (
            <EmptyState>
              You need a current enrollment to post doubts.
            </EmptyState>
          )}
        </SectionCard>
      )}
      <SectionCard
        title={teacher ? "Doubts from your classes" : "Your class's doubts"}
        description={
          teacher
            ? "Ranked by upvotes. Reply on the board or mark a doubt answered in class."
            : "Upvote the doubts you share so your teacher sees them first."
        }
        className="page-section"
      >
        <div className="filter-bar">
          <div className="segmented" aria-label="Doubt status">
            {[
              ["", "All"],
              ["Open", "Open"],
              ["Answered", "Answered"],
            ].map(([value, title]) => (
              <button
                key={title}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {title}
              </button>
            ))}
          </div>
          {subjects.length > 1 && (
            <label>
              Subject
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((id) => (
                  <option key={id} value={id}>
                    {subjectName(records, id)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p role="status" className="form-notice">
          {notice}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {visible.length ? (
          <ul className="doubt-list">
            {visible.map((doubt) => {
              const { voted, own } = doubt;
              return (
                <li key={doubt.id} className="doubt-card">
                  {teacher ? (
                    <span className="vote-count" aria-label="Upvotes">
                      <ThumbsUp size={15} aria-hidden="true" />
                      {doubt.voteCount}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="vote-count"
                      aria-pressed={voted}
                      disabled={own}
                      title={
                        own ? "You can't upvote your own doubt" : undefined
                      }
                      aria-label={
                        (voted ? "Remove upvote" : "Upvote") +
                        " · " +
                        doubt.voteCount +
                        " upvotes"
                      }
                      onClick={() =>
                        run(
                          () =>
                            updateDoubtState((current) =>
                              toggleDoubtVote(
                                current,
                                records,
                                actor,
                                doubt.id,
                              ),
                            ),
                          voted ? "Upvote removed." : "Upvoted.",
                        )
                      }
                    >
                      <ThumbsUp size={15} aria-hidden="true" />
                      {doubt.voteCount}
                    </button>
                  )}
                  <div>
                    <p className="doubt-text">{doubt.text}</p>
                    <div className="tag-row">
                      <span
                        className={
                          "pill " +
                          (doubt.status === "Open"
                            ? "pill-warning"
                            : "pill-success")
                        }
                      >
                        {doubt.status}
                      </span>
                      <span className="pill pill-muted">
                        {subjectName(records, doubt.subject)}
                      </span>
                      {teacher && (
                        <span className="pill pill-muted">
                          {sectionLabel(records, doubt.section)}
                        </span>
                      )}
                      <span className="doubt-meta">
                        {author(doubt)} · {shortDate(doubt.created)}
                      </span>
                    </div>
                    {doubt.reply && (
                      <blockquote className="doubt-reply">
                        <strong>Teacher reply</strong>
                        {doubt.reply}
                      </blockquote>
                    )}
                    {teacher && doubt.status === "Open" && (
                      <form
                        className="reply-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const fields = new FormData(
                            event.currentTarget,
                            (event.nativeEvent as SubmitEvent).submitter,
                          );
                          run(
                            () =>
                              updateDoubtState((current) =>
                                answerDoubt(
                                  current,
                                  records,
                                  actor,
                                  doubt.id,
                                  String(fields.get("reply")),
                                  fields.get("mode") === "class",
                                ),
                              ),
                            "Doubt updated.",
                          );
                        }}
                      >
                        <label>
                          <span className="sr-only">Reply</span>
                          <textarea
                            name="reply"
                            placeholder="Write a reply for the class"
                          />
                        </label>
                        <div className="card-actions">
                          <button
                            className="button button-primary"
                            name="mode"
                            value="reply"
                          >
                            <Send size={15} aria-hidden="true" />
                            Post reply
                          </button>
                          <button
                            className="button button-outline"
                            name="mode"
                            value="class"
                          >
                            Mark answered in class
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>
            {doubts.length
              ? "No doubts match these filters."
              : "No doubts have been posted yet."}
          </EmptyState>
        )}
      </SectionCard>
    </>
  );
}

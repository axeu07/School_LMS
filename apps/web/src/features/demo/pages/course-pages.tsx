"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  NotebookText,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import {
  chaptersFor,
  learnerFor,
  materialKinds,
  removeContent,
  saveChapter,
  saveMaterial,
  saveTopic,
  subjectsFor,
  type Chapter,
  type Material,
  type MaterialKind,
  type Topic,
} from "@/services/learning-model";
import {
  updateLearningState,
  useLearningState,
  useNow,
} from "@/services/learning-store";
import { studentTopicReport } from "@/services/results-model";
import { subjectName } from "@/services/insights";
import { useDemo } from "../demo-context";
import { EmptyState } from "../dashboard-widgets";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { roleHref } from "../navigation";
import { SectionCard } from "../page-header";

const kindIcons = { Notes: NotebookText, PDF: FileText, "Video link": Video };

export function Courses() {
  const { role, records, actor } = useDemo();
  const learning = useLearningState().schools[actor.school];
  const now = useNow(60_000);
  const teacher = role === "teacher";
  const subjects = subjectsFor(records, actor);
  const [picked, setPicked] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const subject = subjects.includes(picked) ? picked : subjects[0];
  const student = learnerFor(records, actor);
  const weak = new Set(
    now && student
      ? studentTopicReport(learning, records, student, now)
          .filter((item) => item.weak)
          .map((item) => item.topic)
      : [],
  );

  if (!subject)
    return <EmptyState>No subjects in the active academic year.</EmptyState>;
  const chapters = chaptersFor(learning, subject);

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

  const chapterForm = (chapter?: Chapter): FormConfig => ({
    title: chapter ? "Edit chapter" : "Add chapter",
    description: subjectName(records, subject),
    fields: [
      { name: "title", label: "Chapter title" },
      { name: "order", label: "Order", type: "number", min: 1 },
    ],
    values: {
      title: chapter?.title ?? "",
      order: String(chapter?.order ?? chapters.length + 1),
    },
    onSubmit: (fields) => {
      updateLearningState((state) =>
        saveChapter(state, records, actor, {
          id: chapter?.id ?? crypto.randomUUID(),
          subject,
          title: String(fields.get("title")),
          order: Number(fields.get("order")),
        }),
      );
      setNotice("Chapter saved.");
    },
  });

  const topicForm = (chapter: string, topic?: Topic): FormConfig => ({
    title: topic ? "Edit topic" : "Add topic",
    fields: [{ name: "title", label: "Topic title" }],
    values: { title: topic?.title ?? "" },
    onSubmit: (fields) => {
      updateLearningState((state) =>
        saveTopic(state, records, actor, {
          id: topic?.id ?? crypto.randomUUID(),
          chapter,
          title: String(fields.get("title")),
        }),
      );
      setNotice("Topic saved.");
    },
  });

  const materialForm = (topic: string, material?: Material): FormConfig => ({
    title: material ? "Edit material" : "Add material",
    description:
      "Notes are written here. PDFs and videos are added as links in this demo.",
    fields: [
      {
        name: "kind",
        label: "Type",
        type: "select",
        options: materialKinds.map((kind) => ({ value: kind, label: kind })),
      },
      { name: "title", label: "Title" },
      {
        name: "body",
        label: "Notes",
        type: "textarea",
        required: false,
        hint: "Required for notes.",
      },
      {
        name: "url",
        label: "Link",
        type: "url",
        required: false,
        hint: "Required for PDFs and videos.",
      },
    ],
    values: {
      kind: material?.kind ?? "Notes",
      title: material?.title ?? "",
      body: material?.body ?? "",
      url: material?.url ?? "",
    },
    onSubmit: (fields) => {
      updateLearningState((state) =>
        saveMaterial(state, records, actor, {
          id: material?.id ?? crypto.randomUUID(),
          topic,
          kind: String(fields.get("kind")) as MaterialKind,
          title: String(fields.get("title")),
          body: String(fields.get("body") ?? ""),
          url: String(fields.get("url") ?? ""),
        }),
      );
      setNotice("Material saved.");
    },
  });

  const remove = (
    table: "chapters" | "topics" | "materials",
    id: string,
    label: string,
  ) => {
    if (!confirmAction("Remove " + label + "?")) return;
    run(
      () =>
        updateLearningState((state) =>
          removeContent(state, records, actor, table, id),
        ),
      "Removed " + label + ".",
    );
  };

  const iconButton = (
    label: string,
    onClick: () => void,
    Icon: typeof Pencil,
  ) => (
    <button
      type="button"
      className="icon-button small"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );

  return (
    <>
      <div className="filter-bar spread">
        {subjects.length > 1 ? (
          <div className="segmented-tabs" aria-label="Subject">
            {subjects.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === subject}
                onClick={() => setPicked(id)}
              >
                {subjectName(records, id)}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="workspace-title">{subjectName(records, subject)}</h2>
        )}
        {teacher && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setForm(chapterForm())}
          >
            <Plus size={16} aria-hidden="true" />
            Add chapter
          </button>
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
      {!chapters.length && (
        <EmptyState>
          {teacher
            ? "No chapters yet. Add the first chapter for this subject."
            : "Your teacher hasn't added chapters for this subject yet."}
        </EmptyState>
      )}
      {chapters.map((chapter) => {
        const topics = learning.topics.filter(
          (item) => item.chapter === chapter.id,
        );
        const questionCount = learning.questions.filter((item) =>
          topics.some((topic) => topic.id === item.topic),
        ).length;
        return (
          <SectionCard
            key={chapter.id}
            title={"Chapter " + chapter.order + " · " + chapter.title}
            description={
              topics.length +
              (topics.length === 1 ? " topic" : " topics") +
              (teacher ? " · " + questionCount + " questions in the bank" : "")
            }
            actions={
              teacher ? (
                <div className="card-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setForm(topicForm(chapter.id))}
                  >
                    <Plus size={15} aria-hidden="true" />
                    Topic
                  </button>
                  {iconButton(
                    "Edit chapter",
                    () => setForm(chapterForm(chapter)),
                    Pencil,
                  )}
                  {iconButton(
                    "Remove chapter",
                    () => remove("chapters", chapter.id, chapter.title),
                    Trash2,
                  )}
                </div>
              ) : undefined
            }
          >
            {topics.length ? (
              <ul className="topic-list">
                {topics.map((topic) => {
                  const materials = learning.materials.filter(
                    (item) => item.topic === topic.id,
                  );
                  return (
                    <li key={topic.id}>
                      <div className="topic-head">
                        <strong>{topic.title}</strong>
                        {weak.has(topic.id) && (
                          <span className="pill pill-warning">
                            Needs practice
                          </span>
                        )}
                        {teacher && (
                          <div className="card-actions push">
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setForm(materialForm(topic.id))}
                            >
                              Add material
                            </button>
                            {iconButton(
                              "Edit topic",
                              () => setForm(topicForm(chapter.id, topic)),
                              Pencil,
                            )}
                            {iconButton(
                              "Remove topic",
                              () => remove("topics", topic.id, topic.title),
                              Trash2,
                            )}
                          </div>
                        )}
                        {!teacher && weak.has(topic.id) && (
                          <Link
                            className="text-button push"
                            href={roleHref(role, "daily-quiz")}
                          >
                            Practice
                          </Link>
                        )}
                      </div>
                      {materials.length ? (
                        <ul className="material-list">
                          {materials.map((material) => {
                            const Icon = kindIcons[material.kind];
                            return (
                              <li key={material.id}>
                                <Icon size={16} aria-hidden="true" />
                                {material.kind === "Notes" ? (
                                  <details>
                                    <summary>{material.title}</summary>
                                    <p>{material.body}</p>
                                  </details>
                                ) : (
                                  <a
                                    href={material.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {material.title}
                                    <ExternalLink
                                      size={13}
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      (opens in a new tab)
                                    </span>
                                  </a>
                                )}
                                <span className="pill pill-muted">
                                  {material.kind}
                                </span>
                                {teacher && (
                                  <span className="card-actions push">
                                    {iconButton(
                                      "Edit material",
                                      () =>
                                        setForm(
                                          materialForm(topic.id, material),
                                        ),
                                      Pencil,
                                    )}
                                    {iconButton(
                                      "Remove material",
                                      () =>
                                        remove(
                                          "materials",
                                          material.id,
                                          material.title,
                                        ),
                                      Trash2,
                                    )}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="field-hint">No study material yet.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState>No topics in this chapter yet.</EmptyState>
            )}
          </SectionCard>
        );
      })}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </>
  );
}

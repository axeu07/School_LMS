"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { AcademicSchool, Assignment } from "@/services/academic-model";
import { updateAcademicState } from "@/services/academic-store";
import {
  activeAllocations,
  assignmentsFor,
  localCalendarDate,
  reviewAssignment,
  saveAssignment,
  submitAssignment,
  type AssignmentActor,
} from "@/services/assignment-model";

export function AssignmentWorkspace({
  school,
  actor,
}: {
  school: AcademicSchool;
  actor: AssignmentActor;
}) {
  const [editing, setEditing] = useState<Assignment | "new">();
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const teacher = actor.role === "teacher";
  const person = actor.role === "parent" ? actor.child : actor.person;
  const allocations = activeAllocations(school, actor);
  const today = localCalendarDate();
  const assignments = assignmentsFor(school, actor);
  const record = typeof editing === "object" ? editing : undefined;
  const select = (next?: Assignment | "new") => {
    setEditing(next);
    setError("");
  };

  function run(
    event: FormEvent<HTMLFormElement>,
    action: (fields: FormData) => void,
    message: string,
  ) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      action(
        new FormData(
          event.currentTarget,
          (event.nativeEvent as SubmitEvent).submitter,
        ),
      );
      setNotice(message);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return (
    <Card id="assignment-workspace" className="dash-card academic-workspace">
      <div className="academic-toolbar">
        <div>
          <h2>
            {actor.role === "parent" ? "Homework tracking" : "Assignments"}
          </h2>
        </div>
        {teacher ? (
          <button
            className="button button-outline"
            type="button"
            onClick={() => select("new")}
            disabled={!allocations.length}
          >
            New assignment
          </button>
        ) : (
          <label>
            Status
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {[
                "All",
                "Pending",
                "Overdue",
                "Submitted",
                "Graded",
                "Revision required",
              ].map((item) => (
                <option key={item} value={item === "All" ? "" : item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
      {teacher && editing && (
        <form
          className="academic-detail academic-workspace"
          key={record?.id ?? "new"}
          onSubmit={(event) =>
            run(
              event,
              (fields) => {
                updateAcademicState((state) =>
                  saveAssignment(state, actor, {
                    id: record?.id ?? crypto.randomUUID(),
                    allocation: String(fields.get("allocation")),
                    title: String(fields.get("title")),
                    instructions: String(fields.get("instructions")),
                    due: String(fields.get("due")),
                    maximum: Number(fields.get("maximum")),
                    published: fields.get("published") === "on",
                  }),
                );
                select();
              },
              "Assignment saved.",
            )
          }
        >
          <h3>{record ? "Edit assignment" : "New assignment"}</h3>
          <label>
            Teaching allocation
            <select
              name="allocation"
              defaultValue={record?.allocation}
              required
            >
              {allocations.map((item) => {
                const section = school.sections.find(
                  (group) => group.id === item.section,
                );
                return (
                  <option key={item.id} value={item.id}>
                    {
                      school.subjects.find(
                        (subject) => subject.id === item.subject,
                      )?.name
                    }{" "}
                    · {section?.grade} {section?.name}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Title
            <input name="title" defaultValue={record?.title} required />
          </label>
          <label>
            Description and instructions
            <textarea
              name="instructions"
              defaultValue={record?.instructions}
              required
            />
          </label>
          <label>
            Deadline
            <input name="due" type="date" defaultValue={record?.due} required />
          </label>
          <label>
            Maximum marks
            <input
              name="maximum"
              type="number"
              min={1}
              defaultValue={record?.maximum}
              required
            />
          </label>
          <label>
            <span>
              <input
                type="checkbox"
                name="published"
                defaultChecked={record?.published}
              />{" "}
              Publish to students
            </span>
          </label>
          <div className="academic-toolbar">
            <button className="button button-outline" type="submit">
              Save assignment
            </button>
            <button
              className="button button-outline"
              type="button"
              onClick={() => select()}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {assignments.map((assignment): ReactNode => {
        const submission = school.submissions.find(
          (item) =>
            item.assignment === assignment.id && item.student === person,
        );
        const status = teacher
          ? assignment.published
            ? "Published"
            : "Draft"
          : submission?.status === "Draft" || !submission
            ? assignment.due < today
              ? "Overdue"
              : "Pending"
            : submission.status;
        if (filter && status !== filter) return null;
        const reviews = school.submissions.filter(
          (item) =>
            item.assignment === assignment.id && item.status !== "Draft",
        );
        return (
          <details className="academic-detail" key={assignment.id}>
            <summary>
              <strong>{assignment.title}</strong> · {status} · Due{" "}
              {assignment.due}
              {teacher &&
                " · " +
                  reviews.filter((item) => item.status === "Submitted").length +
                  " awaiting review"}
            </summary>
            <p>{assignment.instructions}</p>
            <p>Maximum marks {assignment.maximum}</p>
            {submission?.feedback && (
              <p>
                Teacher feedback · {submission.feedback}
                {submission.marks !== undefined &&
                  " · " + submission.marks + "/" + assignment.maximum}
              </p>
            )}
            {submission && submission.status !== "Draft" && (
              <p>{submission.text}</p>
            )}
            {actor.role === "student" &&
              (status === "Pending" || status === "Revision required") && (
                <form
                  className="academic-workspace"
                  onSubmit={(event) =>
                    run(
                      event,
                      (fields) => {
                        updateAcademicState((state) =>
                          submitAssignment(
                            state,
                            actor,
                            assignment.id,
                            String(fields.get("response")),
                            fields.get("action") === "submit",
                          ),
                        );
                      },
                      "Response saved.",
                    )
                  }
                >
                  <label>
                    Your response
                    <textarea
                      name="response"
                      required
                      defaultValue={submission?.text}
                    />
                  </label>
                  <div className="academic-toolbar">
                    <button
                      className="button button-outline"
                      name="action"
                      value="draft"
                    >
                      Save draft
                    </button>
                    <button
                      className="button button-outline"
                      name="action"
                      value="submit"
                    >
                      Submit for review
                    </button>
                  </div>
                </form>
              )}
            {teacher && (
              <button
                type="button"
                className="text-button"
                onClick={() => select(assignment)}
              >
                Edit assignment
              </button>
            )}
            {teacher &&
              reviews.map((item) => (
                <section className="academic-detail" key={item.student}>
                  <h3>
                    {
                      school.students.find(
                        (student) => student.id === item.student,
                      )?.name
                    }{" "}
                    · {item.status}
                  </h3>
                  <p>{item.text}</p>
                  {item.feedback && (
                    <p>
                      {item.feedback}
                      {item.marks !== undefined &&
                        " · " + item.marks + "/" + assignment.maximum}
                    </p>
                  )}
                  {item.status === "Submitted" && (
                    <form
                      className="academic-workspace"
                      onSubmit={(event) =>
                        run(
                          event,
                          (fields) => {
                            const grade = fields.get("review") === "grade";
                            if (grade && !String(fields.get("marks")).trim())
                              throw new Error("Enter marks before grading.");
                            updateAcademicState((state) =>
                              reviewAssignment(
                                state,
                                actor,
                                assignment.id,
                                item.student,
                                String(fields.get("feedback")),
                                grade ? Number(fields.get("marks")) : undefined,
                              ),
                            );
                          },
                          "Review saved.",
                        )
                      }
                    >
                      <label>
                        Feedback
                        <textarea name="feedback" required />
                      </label>
                      <label>
                        Marks
                        <input
                          name="marks"
                          type="number"
                          min={0}
                          max={assignment.maximum}
                          step="any"
                        />
                      </label>
                      <div className="academic-toolbar">
                        <button
                          className="button button-outline"
                          name="review"
                          value="grade"
                        >
                          Grade
                        </button>
                        <button
                          className="button button-outline"
                          name="review"
                          value="revision"
                        >
                          Return for revision
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              ))}
          </details>
        );
      })}
      {(!assignments.length ||
        (filter &&
          !assignments.some((assignment) => {
            const submission = school.submissions.find(
              (item) =>
                item.assignment === assignment.id && item.student === person,
            );
            return (
              (submission?.status === "Draft" || !submission
                ? assignment.due < today
                  ? "Overdue"
                  : "Pending"
                : submission.status) === filter
            );
          }))) && <p>No assignments match this view.</p>}
    </Card>
  );
}

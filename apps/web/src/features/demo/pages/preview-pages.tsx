"use client";

import { useState, type CSSProperties } from "react";
import {
  BookOpen,
  FileText,
  Lightbulb,
  Link2,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { academicRecords } from "@/mocks/academics";
import { activeAllocations } from "@/services/assignment-model";
import { sectionLabel, subjectName } from "@/services/insights";
import { useDemo } from "../demo-context";
import { DataTable, EmptyState, Meter } from "../dashboard-widgets";
import { PreviewNotice, SectionCard } from "../page-header";

const number = (value: number) => new Intl.NumberFormat("en").format(value);

function useSubjects() {
  const { records, actor } = useDemo();
  return [
    ...new Set(
      activeAllocations(records, actor).map((item) =>
        subjectName(records, item.subject),
      ),
    ),
  ];
}

/* ---------- Super Admin ---------- */

const plans = [
  {
    name: "Starter",
    price: "₹12,000",
    students: "Up to 750 students",
    storage: "50 GB storage",
    ai: "No AI tools",
    features: ["Academics & timetable", "Attendance", "Announcements"],
  },
  {
    name: "Professional",
    price: "₹28,000",
    students: "Up to 2,000 students",
    storage: "200 GB storage",
    ai: "5,000 AI requests / month",
    features: ["Everything in Starter", "Online tests", "Fees", "Doubt board"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    students: "Unlimited students",
    storage: "1 TB storage",
    ai: "20,000 AI requests / month",
    features: [
      "Everything in Professional",
      "Custom domain",
      "Priority support",
    ],
  },
];

export function SubscriptionsPreview() {
  const { schools } = useDemo();
  return (
    <>
      <PreviewNotice
        summary="Plans and billing figures below are illustrative. Subscription changes are not saved."
        planned={[
          "Create plans with price, student, storage and AI limits",
          "Switch modules on or off per plan",
          "Generate invoices, track paid and pending subscriptions, send renewal reminders",
        ]}
      />
      <div className="plan-grid">
        {plans.map((plan) => (
          <SectionCard
            key={plan.name}
            title={plan.name}
            className={plan.name === "Professional" ? "is-selected" : ""}
          >
            <p className="plan-price">
              {plan.price}
              {plan.price !== "Custom" && <small> / month</small>}
            </p>
            <ul className="check-list">
              <li>{plan.students}</li>
              <li>{plan.storage}</li>
              <li>{plan.ai}</li>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </SectionCard>
        ))}
      </div>
      <SectionCard
        title="School subscriptions"
        description="Sample billing status and usage."
        className="page-section"
      >
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col">Plan</th>
                <th scope="col">Billing</th>
                <th scope="col">Renews</th>
                <th scope="col">AI usage</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((item, index) => (
                <tr key={item.id}>
                  <th scope="row">{item.name}</th>
                  <td>{item.plan}</td>
                  <td>
                    <span
                      className={
                        "pill " +
                        (item.status === "Trial"
                          ? "pill-warning"
                          : "pill-success")
                      }
                    >
                      {item.status === "Trial" ? "Trial ends 15 Dec" : "Paid"}
                    </span>
                  </td>
                  <td>{["1 Jan 2027", "12 Feb 2027", "15 Dec 2026"][index]}</td>
                  <td>
                    <span className="meter-cell">
                      {[62, 38, 0][index]}%
                      <Meter value={[62, 38, 0][index]} label="AI usage" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

const brandColors: Record<string, string> = {
  westfield: "#4937b8",
  harborview: "#185483",
  cedar: "#5b398f",
};

export function BrandingPreview() {
  const { schools } = useDemo();
  return (
    <>
      <PreviewNotice
        summary="Each demo school already uses its own accent colour. Uploading logos and editing brand settings is not available yet."
        planned={[
          "Upload a logo and choose brand colours per school",
          "Custom subdomain or school code for each school's login page",
          "Preview the student and parent app with the school's branding",
        ]}
      />
      <div className="plan-grid">
        {schools.map((item) => (
          <SectionCard
            key={item.id}
            title={item.name}
            description={item.location}
          >
            <div
              className="brand-preview"
              style={{ "--brand": brandColors[item.id] } as CSSProperties}
            >
              <span className="brand-preview-bar">
                <span className="school-badge small">{item.initials}</span>
                {item.name}
              </span>
              <span className="brand-preview-body">
                <span />
                <span />
                <span />
              </span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Accent colour</dt>
                <dd>
                  <span
                    className="swatch"
                    style={{ background: brandColors[item.id] }}
                    aria-hidden="true"
                  />
                  {brandColors[item.id]}
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{item.id}.schoollms.example</dd>
              </div>
              <div>
                <dt>School code</dt>
                <dd>
                  {item.initials}-{1024 + item.students}
                </dd>
              </div>
            </dl>
          </SectionCard>
        ))}
      </div>
    </>
  );
}

export function PlatformSettingsPreview() {
  return (
    <>
      <PreviewNotice
        summary="These settings show how platform configuration will look. The controls are disabled in the demo."
        planned={[
          "Session timeout, password policy and parent OTP login",
          "Monthly AI request limits per plan",
          "Platform-wide announcements to every school",
          "Audited support access to school workspaces",
        ]}
      />
      <fieldset className="settings-grid" disabled>
        <SectionCard title="Security" description="Applies to every school.">
          <label className="setting-row">
            Session timeout
            <select defaultValue="30">
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>
          <label className="setting-row">
            Parent login with phone OTP
            <input type="checkbox" defaultChecked />
          </label>
          <label className="setting-row">
            Minimum password length
            <input type="number" defaultValue={10} />
          </label>
        </SectionCard>
        <SectionCard title="AI usage limits" description="Requests per month.">
          {plans.map((plan) => (
            <p className="setting-row" key={plan.name}>
              {plan.name}
              <strong>{plan.ai}</strong>
            </p>
          ))}
        </SectionCard>
        <SectionCard
          title="Platform announcement"
          description="Send a notice to all school admins."
        >
          <label className="setting-row stacked">
            Message
            <textarea defaultValue="Scheduled maintenance on Sunday, 6 Dec from 01:00 to 03:00 IST." />
          </label>
          <button type="button" className="button button-primary">
            <Send size={15} aria-hidden="true" />
            Send to all schools
          </button>
        </SectionCard>
        <SectionCard
          title="Support access"
          description="Sign in as a school admin to help with setup."
        >
          <p className="setting-row">
            Record every support session in the audit log
            <input type="checkbox" defaultChecked />
          </p>
          <p className="setting-row">
            Require school approval before access
            <input type="checkbox" />
          </p>
        </SectionCard>
      </fieldset>
    </>
  );
}

/* ---------- School Admin ---------- */

export function MarketingPreview() {
  const { schoolId } = useDemo();
  const marketing = academicRecords.find(
    (item) => item.schoolId === schoolId,
  )!.marketing;
  const funnel = [
    ["Enquiries", 48],
    ["Campus visits", 21],
    ["Applications", 12],
    ["Admissions", 7],
  ] as const;
  return (
    <>
      <PreviewNotice
        summary="Social figures are simulated. No social accounts are connected."
        planned={[
          "Connect Instagram, Facebook and Google Business Profile",
          "Admission enquiries with follow-ups",
          "Monthly reach and enquiry reports",
        ]}
      />
      <div className="plan-grid">
        {(
          [
            ["Instagram", "Accounts reached"],
            ["Facebook", "Post impressions"],
            ["Google Business Profile", "Profile interactions"],
          ] as const
        ).map(([channel, metric], index) => (
          <SectionCard key={channel} title={channel} description={metric}>
            <p className="plan-price">{number(marketing[index])}</p>
            <span className="pill pill-preview">Last 30 days · simulated</span>
          </SectionCard>
        ))}
      </div>
      <SectionCard
        title="Admissions funnel"
        description="Sample enquiry pipeline for this term."
        className="page-section"
      >
        <ul className="usage-list">
          {funnel.map(([stage, count]) => (
            <li key={stage}>
              <span>
                {stage} <strong>{count}</strong>
              </span>
              <Meter value={(100 * count) / funnel[0][1]} label={stage} />
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}

/* ---------- Teacher & Student learning ---------- */

const units = [
  ["Unit 1 · Core concepts", 4, 2, 1],
  ["Unit 2 · Applying the ideas", 3, 3, 2],
  ["Unit 3 · Review and practice", 2, 4, 1],
] as const;

export function CoursesPreview() {
  const { role, data } = useDemo();
  const subjects = useSubjects();
  const teacher = role === "teacher";
  return (
    <>
      <PreviewNotice
        summary="Your real subjects are listed with sample chapters and materials. Uploads are not saved yet."
        planned={
          teacher
            ? [
                "Create chapters and topics for each subject",
                "Upload PDFs and notes, and add video links",
                "Tag topics for tests and weak-topic analysis",
              ]
            : [
                "Browse chapters and topics by subject",
                "Open PDFs, notes and video links",
                "Track your progress through each chapter",
              ]
        }
      />
      {subjects.length ? (
        <div className="plan-grid">
          {subjects.map((subject, index) => {
            const progress = data.courses[index]?.progress;
            return (
              <SectionCard
                key={subject}
                title={subject}
                description={units.length + " units · sample material"}
                actions={
                  teacher ? (
                    <button
                      type="button"
                      className="button button-outline"
                      disabled
                    >
                      <Upload size={15} aria-hidden="true" />
                      Upload
                    </button>
                  ) : undefined
                }
              >
                {!teacher && progress !== undefined && (
                  <p className="usage-inline">
                    {progress}% complete
                    <Meter value={progress} label={progress + "% complete"} />
                  </p>
                )}
                <ul className="unit-list">
                  {units.map(([title, pdfs, notes, videos]) => (
                    <li key={title}>
                      <strong>{title}</strong>
                      <span>
                        <FileText size={13} aria-hidden="true" /> {pdfs} PDFs
                        <BookOpen size={13} aria-hidden="true" /> {notes} notes
                        <Link2 size={13} aria-hidden="true" /> {videos} videos
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <EmptyState>No subjects in the active academic year.</EmptyState>
      )}
    </>
  );
}

const questionBank = [
  ["Which fraction is equal to 0.75?", "Fractions · Decimals", "Easy"],
  ["Simplify 3(x + 4) − 2x.", "Algebra · Expressions", "Medium"],
  [
    "A ratio of 2:3 is shared out of 45. Find the larger part.",
    "Ratio · Sharing",
    "Medium",
  ],
  [
    "Explain why the product of two negatives is positive.",
    "Integers · Operations",
    "Hard",
  ],
] as const;

export function AssessmentsPreview() {
  const { role, data, records, actor } = useDemo();
  const panelId =
    role === "teacher"
      ? "assessments"
      : role === "student"
        ? "quizzes"
        : "exams";
  const upcoming = data.panels.find((panel) => panel.id === panelId);
  const sections = [
    ...new Set(activeAllocations(records, actor).map((item) => item.section)),
  ];
  if (role === "parent" && !data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  return (
    <>
      <PreviewNotice
        summary="Upcoming tests and results below are sample data. Online tests can't be taken or scored yet."
        planned={
          role === "teacher"
            ? [
                "MCQ question bank tagged by chapter and topic",
                "Timed tests built from the bank, with scheduling",
                "Auto-evaluated results and marks entry for offline exams",
              ]
            : role === "student"
              ? [
                  "Take timed MCQ tests in the browser",
                  "See your score and the correct answers after the test closes",
                  "Download your report card",
                ]
              : [
                  "Upcoming tests for your child",
                  "Marks, report cards and weak topics",
                ]
        }
      />
      <div className="dashboard-grid">
        <DataTable
          panel={{
            id: panelId,
            title: role === "teacher" ? "Scheduled tests" : "Upcoming tests",
            rows: upcoming?.rows ?? [],
            description: "Sample schedule",
          }}
        />
        <SectionCard
          title={role === "teacher" ? "Recent results" : "Recent results"}
          description="Sample auto-evaluated scores"
        >
          <ul className="usage-list">
            {(role === "teacher"
              ? sections.map((id, index) => [
                  sectionLabel(records, id) + " class average",
                  [74, 68][index] ?? 70,
                ])
              : [
                  ["Unit quiz 3", 85],
                  ["Unit quiz 2", 72],
                  ["Mid-term practice", 78],
                ]
            ).map(([title, score]) => (
              <li key={title}>
                <span>
                  {title} <strong>{score}%</strong>
                </span>
                <Meter value={Number(score)} label={score + "%"} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      {role === "teacher" && (
        <SectionCard
          title="Question bank"
          description="Sample questions tagged by chapter and topic"
          className="page-section"
        >
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Chapter · topic</th>
                  <th scope="col">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {questionBank.map(([question, tag, level]) => (
                  <tr key={question}>
                    <th scope="row">{question}</th>
                    <td>{tag}</td>
                    <td>
                      <span className="pill pill-muted">{level}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}

/* ---------- AI tools ---------- */

const teacherOutputs = {
  Summary:
    "Chapter summary: a fraction names part of a whole. Equivalent fractions name the same amount, and any fraction can be written as a decimal by dividing the numerator by the denominator.",
  "Homework questions":
    "1. Write two fractions equivalent to 3/4.\n2. Convert 5/8 to a decimal.\n3. Explain in words why 2/4 and 1/2 are equal.",
  "MCQ quiz":
    "Q1. Which is equal to 0.75? (a) 1/2 (b) 3/4 (c) 2/3\nQ2. Which is largest? (a) 0.6 (b) 5/8 (c) 3/5",
  "Question paper":
    "Section A — 5 short answers (2 marks each)\nSection B — 3 worked problems (5 marks each)\nSection C — 1 explanation question (5 marks)",
};

export function AiTeachingPreview() {
  const [output, setOutput] = useState<keyof typeof teacherOutputs>();
  const subjects = useSubjects();
  return (
    <>
      <PreviewNotice
        summary="AI responses are canned samples. No document is uploaded and no AI model is called."
        planned={[
          "Upload a chapter PDF and get draft summaries, homework, MCQ quizzes and question papers",
          "Review and edit every draft before sharing",
          "AI doubt grouping with a draft answer to approve",
        ]}
      />
      <div className="dashboard-grid">
        <SectionCard
          title="Teacher Assistant"
          description="Start from a chapter, then choose what to draft."
        >
          <div className="dropzone" aria-disabled="true">
            <Upload size={22} aria-hidden="true" />
            <strong>Drop a chapter PDF</strong>
            <span>
              Sample chapter: Fractions and decimals ·{" "}
              {subjects[0] ?? "Your subject"}
            </span>
          </div>
          <div className="card-actions">
            {(
              Object.keys(teacherOutputs) as (keyof typeof teacherOutputs)[]
            ).map((name) => (
              <button
                key={name}
                type="button"
                className="button button-outline"
                aria-pressed={output === name}
                onClick={() => setOutput(name)}
              >
                <Sparkles size={15} aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
        </SectionCard>
        <SectionCard
          title={output ? "Draft · " + output : "Draft output"}
          description="Simulated AI · sample response"
          className="ai-card"
        >
          {output ? (
            <pre className="ai-output" role="status">
              {teacherOutputs[output]}
            </pre>
          ) : (
            <EmptyState>Choose an output to see a sample draft.</EmptyState>
          )}
        </SectionCard>
      </div>
      <SectionCard
        title="Doubt grouping"
        description="Similar doubts grouped together, with a draft answer to approve."
        className="page-section"
      >
        <ul className="stack-list">
          <li>
            <strong>12 students asked about negative numbers</strong>
            <span>
              Draft answer: multiplying by a negative reverses direction on the
              number line, so reversing twice brings you back to positive.
            </span>
          </li>
          <li>
            <strong>5 students asked about converting fractions</strong>
            <span>
              Draft answer: divide the numerator by the denominator — 3 ÷ 4 =
              0.75.
            </span>
          </li>
        </ul>
      </SectionCard>
    </>
  );
}

const helperSteps = [
  "Write both fractions with the same denominator: 2/3 = 8/12 and 3/4 = 9/12.",
  "Compare the numerators: 9 is greater than 8.",
  "So 3/4 is the larger fraction.",
];

export function HomeworkHelperPreview() {
  const [stage, setStage] = useState(0);
  return (
    <>
      <PreviewNotice
        summary="The helper shows a fixed sample. Photo upload and real explanations are not available yet."
        planned={[
          "Upload a photo of a question",
          "Get a hint first, then a step-by-step explanation",
          "Switched off during tests, with a monthly limit per plan",
        ]}
      />
      <div className="dashboard-grid feature-grid">
        <SectionCard
          title="Sample question"
          description="Which is larger: 2/3 or 3/4?"
          className="ai-card"
        >
          <div className="card-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setStage(Math.max(stage, 1))}
            >
              <Lightbulb size={15} aria-hidden="true" />
              Show a hint
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={stage < 1}
              onClick={() => setStage(2)}
            >
              Explain step by step
            </button>
            {stage > 0 && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => setStage(0)}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Start over
              </button>
            )}
          </div>
          <div role="status" className="helper-output">
            {stage >= 1 && (
              <p>
                <strong>Hint:</strong> try giving both fractions the same
                denominator before comparing them.
              </p>
            )}
            {stage === 2 && (
              <ol>
                {helperSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        </SectionCard>
        <SectionCard title="This month" description="Sample usage">
          <ul className="usage-list">
            <li>
              <span>
                AI requests <strong>3 / 30</strong>
              </span>
              <Meter value={10} label="3 of 30 requests used" />
            </li>
          </ul>
          <p className="muted-copy">
            The helper pauses automatically while an online test is open.
          </p>
        </SectionCard>
      </div>
    </>
  );
}

export function AiNotesPreview() {
  const subjects = useSubjects();
  const [subject, setSubject] = useState(0);
  const name = subjects[subject];
  return (
    <>
      <PreviewNotice
        summary="Notes are a fixed template filled with your subject names. They are not generated from real chapters."
        planned={[
          "Short revision notes generated from each chapter",
          "Flashcards and key-term lists",
          "Extra practice questions for your weak topics",
        ]}
      />
      {name ? (
        <SectionCard
          title={name + " · revision notes"}
          description="Simulated AI · sample notes"
          className="page-section ai-card"
          actions={
            <div className="segmented" aria-label="Subject">
              {subjects.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={index === subject}
                  onClick={() => setSubject(index)}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        >
          <div className="notes-grid">
            <div>
              <h3>Key ideas</h3>
              <ul className="check-list">
                <li>Define each new term in your own words.</li>
                <li>Link every idea to one worked example from class.</li>
                <li>Note the mistakes your teacher flagged in feedback.</li>
              </ul>
            </div>
            <div>
              <h3>Flashcards</h3>
              <ul className="flashcards">
                <li>
                  <strong>What is the main idea of Unit 1?</strong>
                  <span>
                    Summarise it in one sentence, then check your notes.
                  </span>
                </li>
                <li>
                  <strong>Which example best shows Unit 2?</strong>
                  <span>Explain it to a classmate in under a minute.</span>
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>
      ) : (
        <EmptyState>No subjects in the active academic year.</EmptyState>
      )}
    </>
  );
}

const quiz = [
  ["Which fraction is equal to 0.75?", ["1/2", "3/4", "2/3"], 1],
  [
    "What gas do plants absorb for photosynthesis?",
    ["Oxygen", "Nitrogen", "Carbon dioxide"],
    2,
  ],
  ["Which word is a verb?", ["Quickly", "Run", "Blue"], 1],
  ["What is 7 × 8?", ["54", "56", "64"], 1],
  ["Which is a renewable energy source?", ["Coal", "Wind", "Diesel"], 1],
] as const;

export function DailyQuizPreview() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const done = Object.keys(answers).length === quiz.length;
  const score = quiz.filter(
    ([, , correct], index) => answers[index] === correct,
  ).length;
  return (
    <>
      <PreviewNotice
        summary="Five fixed sample questions. Scores are not saved."
        planned={[
          "A new quiz every day from your current chapters",
          "Questions weighted towards your weak topics",
          "Streaks and history in My Progress",
        ]}
      />
      <SectionCard
        title="Today's warm-up"
        description={
          done
            ? "You scored " + score + " out of " + quiz.length + "."
            : Object.keys(answers).length + " of " + quiz.length + " answered"
        }
        className="page-section"
        actions={
          <button
            type="button"
            className="button button-outline"
            onClick={() => setAnswers({})}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Restart
          </button>
        }
      >
        <ol className="quiz-list">
          {quiz.map(([question, options, correct], index) => {
            const answer = answers[index];
            return (
              <li key={question}>
                <strong>{question}</strong>
                <div className="card-actions">
                  {options.map((option, choice) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        "button button-outline" +
                        (answer !== undefined && choice === correct
                          ? " is-correct"
                          : answer === choice
                            ? " is-wrong"
                            : "")
                      }
                      aria-pressed={answer === choice}
                      disabled={answer !== undefined}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [index]: choice,
                        }))
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {answer !== undefined && (
                  <p className="form-notice" role="status">
                    {answer === correct
                      ? "Correct."
                      : "Not quite — the answer is " + options[correct] + "."}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </SectionCard>
    </>
  );
}

/* ---------- Parent ---------- */

export function MessagesPreview() {
  const { records, data } = useDemo();
  const [selected, setSelected] = useState(0);
  const enrollment = records.enrollments.find(
    (item) => item.student === data.child?.id && item.status === "Enrolled",
  );
  const teachers = records.allocations
    .filter((item) => item.section === enrollment?.section)
    .map((item) => ({
      name: records.teachers.find((teacher) => teacher.id === item.teacher)
        ?.name,
      subject: subjectName(records, item.subject),
    }));
  if (!data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  const thread = teachers[selected];
  return (
    <>
      <PreviewNotice
        summary="Conversations below are samples with your child's real teachers. Messages can't be sent yet."
        planned={[
          "Message the class or subject teacher one to one",
          "Receive replies and in-app notifications",
          "Daily digest of homework, attendance and notices",
        ]}
      />
      {teachers.length ? (
        <div className="messages-layout">
          <SectionCard title="Teachers" description={data.child.name}>
            <ul className="thread-list">
              {teachers.map((item, index) => (
                <li key={item.subject + index}>
                  <button
                    type="button"
                    aria-pressed={index === selected}
                    onClick={() => setSelected(index)}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.subject}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard
            title={thread.name ?? "Teacher"}
            description={thread.subject + " · sample conversation"}
          >
            <ol className="chat">
              <li className="chat-in">
                Hello! {data.child.name.split(" ")[0]} did well in class this
                week. Please encourage some extra reading at home.
              </li>
              <li className="chat-out">
                Thank you — we&apos;ll set aside time each evening. Is there a
                chapter to focus on?
              </li>
              <li className="chat-in">
                Unit 2 would be a great place to start.
              </li>
            </ol>
            <div className="chat-compose">
              <input
                disabled
                placeholder="Messaging is coming soon"
                aria-label="Message"
              />
              <button type="button" className="button button-primary" disabled>
                <Send size={15} aria-hidden="true" />
                Send
              </button>
            </div>
          </SectionCard>
        </div>
      ) : (
        <EmptyState>
          No teachers are allocated to your child&apos;s section yet.
        </EmptyState>
      )}
    </>
  );
}

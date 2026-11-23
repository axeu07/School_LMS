"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { linkedStudents } from "@/services/academic-model";
import {
  getAcademicSnapshot,
  updateAcademicState,
} from "@/services/academic-store";
import { localCalendarDate } from "@/services/assignment-model";
import {
  auditAreas,
  auditCsvRows,
  type AuditArea,
} from "@/services/audit-model";
import { logAudit, useAuditState } from "@/services/audit-store";
import { useFeeState } from "@/services/fee-store";
import {
  buildXlsx,
  importTemplates,
  parseCsv,
  parseXlsx,
  planImport,
  toCsv,
  type ImportKind,
  type ImportRow,
} from "@/services/import-model";
import { useLearningState, useNow } from "@/services/learning-store";
import { localDateTime } from "@/services/learning-model";
import {
  anonymizeStudent,
  buildExport,
  consentOverview,
  consentPurposes,
  consentVersion,
  currentConsent,
  requestConsents,
  requestData,
  resolveRequest,
  respondConsent,
  withdrawConsent,
  type ConsentStatus,
  type DataRequest,
  type PurposeKey,
} from "@/services/privacy-model";
import { updatePrivacyState, usePrivacyState } from "@/services/privacy-store";
import type { SchoolId } from "@/types/demo";
import { BrandingEditor } from "../../brand/school-brand";
import { useDemo } from "../demo-context";
import { EmptyState, StatCards } from "../dashboard-widgets";
import { downloadFile, notify } from "../download";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { formatDate, formatDateTime } from "../format";
import { SectionCard } from "../page-header";

const today = () => localCalendarDate(new Date());

function useMessages() {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const run = (action: () => void, message: string) => {
    setError("");
    setNotice("");
    try {
      action();
      setNotice(message);
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  };
  const messages = (
    <>
      <p role="status" className="form-notice">
        {notice}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
  return { run, messages, setNotice, setError };
}

/* ======================= Branding ======================= */

export function SchoolBrandingPage() {
  const { schoolId, role } = useDemo();
  return (
    <BrandingEditor
      key={schoolId}
      school={schoolId}
      role={role}
      actorSchool={schoolId}
    />
  );
}

export function PlatformBranding() {
  const { schools, schoolId } = useDemo();
  const [school, setSchool] = useState<SchoolId>(schoolId);
  return (
    <>
      <div className="filter-bar">
        <label>
          School
          <select
            value={school}
            onChange={(event) => setSchool(event.target.value as SchoolId)}
          >
            {schools.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BrandingEditor
        key={school}
        school={school}
        role="super-admin"
        actorSchool={schoolId}
      />
    </>
  );
}

/* ======================= Bulk import ======================= */

type Preview = {
  kind: ImportKind;
  file: string;
  table: string[][];
  rows: ImportRow[];
  imported: number;
};

export function BulkImport() {
  const { schoolId } = useDemo();
  const [kind, setKind] = useState<ImportKind>("students");
  const [preview, setPreview] = useState<Preview>();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { run, messages, setError, setNotice } = useMessages();
  const template = importTemplates[kind];

  async function load(file: File | undefined) {
    setNotice("");
    setError("");
    setPreview(undefined);
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("The file must be under 5 MB.");
      const table = /\.xlsx$/i.test(file.name)
        ? await parseXlsx(new Uint8Array(await file.arrayBuffer()))
        : /\.csv$/i.test(file.name)
          ? parseCsv(await file.text())
          : (() => {
              throw new Error(
                "Upload a .csv or .xlsx file. Older .xls files: save as .xlsx first.",
              );
            })();
      const plan = planImport(
        getAcademicSnapshot(),
        schoolId,
        kind,
        table,
        () => crypto.randomUUID(),
      );
      setPreview({
        kind,
        file: file.name,
        table,
        rows: plan.rows,
        imported: plan.imported,
      });
      setErrorsOnly(false);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function commit() {
    if (!preview) return;
    let result: ReturnType<typeof planImport> | undefined;
    const ok = run(() => {
      updateAcademicState((state) => {
        result = planImport(state, schoolId, preview.kind, preview.table, () =>
          crypto.randomUUID(),
        );
        if (!result.imported) throw new Error("No valid rows to import.");
        return result.next;
      });
    }, "");
    if (!ok || !result) return;
    const skipped = result.rows.length - result.imported;
    logAudit(
      schoolId,
      "Import",
      "Imported " + importTemplates[preview.kind].label.toLowerCase(),
      result.imported +
        " rows from " +
        preview.file +
        (skipped ? " · " + skipped + " skipped" : ""),
    );
    setNotice(
      "Imported " +
        result.imported +
        " rows" +
        (skipped ? ". " + skipped + " rows with errors were skipped." : "."),
    );
    setPreview(undefined);
  }

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void load(event.dataTransfer.files[0]);
  };
  const rows = preview
    ? preview.rows.filter((row) => !errorsOnly || !row.ok)
    : [];
  const errors = preview ? preview.rows.length - preview.imported : 0;
  const keyColumns = template.columns.slice(0, 4);

  return (
    <>
      <nav className="segmented-tabs" aria-label="What to import">
        {(Object.keys(importTemplates) as ImportKind[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={kind === key}
            onClick={() => {
              setKind(key);
              setPreview(undefined);
              setNotice("");
              setError("");
            }}
          >
            {importTemplates[key].label}
          </button>
        ))}
      </nav>
      <div className="dashboard-grid feature-grid">
        <SectionCard
          title={"Upload " + template.label.toLowerCase()}
          description="Every row is checked before anything is saved. Valid rows import; rows with problems are listed so you can fix them."
        >
          <div
            className={
              "dropzone import-drop" + (dragging ? " is-dragging" : "")
            }
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <FileUp size={24} aria-hidden="true" />
            <strong>Drop a .xlsx or .csv file here</strong>
            <span>Up to 1,000 rows and 5 MB</span>
            <button
              type="button"
              className="button button-outline"
              onClick={() => input.current?.click()}
            >
              Choose file
            </button>
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              aria-label="Choose a file to import"
              onChange={(event) => {
                void load(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {messages}
        </SectionCard>
        <SectionCard
          title="Template"
          description="Use these column headings. Order doesn't matter."
        >
          <ul className="column-list">
            {template.columns.map((column) => (
              <li key={column}>
                {column}
                {template.required.includes(column) ? (
                  <span className="pill pill-muted">Required</span>
                ) : (
                  <span className="field-hint">Optional</span>
                )}
              </li>
            ))}
          </ul>
          {kind === "students" && (
            <p className="field-hint">
              Class and Section must match an active section, for example
              &quot;Grade 8&quot; and &quot;A&quot;. A guardian with a matching
              email is linked instead of duplicated.
            </p>
          )}
          <div className="card-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() =>
                downloadFile(
                  kind + "-template.xlsx",
                  buildXlsx(
                    [template.columns, ...template.sample],
                    template.label,
                  ) as BlobPart,
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
              }
            >
              <FileSpreadsheet size={15} aria-hidden="true" />
              Excel template
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={() =>
                downloadFile(
                  kind + "-template.csv",
                  "﻿" + toCsv([template.columns, ...template.sample]),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={15} aria-hidden="true" />
              CSV template
            </button>
          </div>
        </SectionCard>
      </div>
      {preview && (
        <SectionCard
          title={"Preview · " + preview.file}
          description={
            preview.imported +
            " ready to import · " +
            errors +
            (errors === 1 ? " row has" : " rows have") +
            " problems"
          }
          actions={
            <div className="card-actions">
              {errors > 0 && (
                <>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={errorsOnly}
                      onChange={(event) => setErrorsOnly(event.target.checked)}
                    />
                    Problems only
                  </label>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() =>
                      downloadFile(
                        "import-problems.csv",
                        "﻿" +
                          toCsv([
                            ["Line", ...template.columns, "Problem"],
                            ...preview.rows
                              .filter((row) => !row.ok)
                              .map((row) => [
                                String(row.line),
                                ...template.columns.map(
                                  (column) => row.values[column],
                                ),
                                row.message,
                              ]),
                          ]),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    <Download size={15} aria-hidden="true" />
                    Problem report
                  </button>
                </>
              )}
              <button
                type="button"
                className="button button-outline"
                onClick={() => setPreview(undefined)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!preview.imported}
                onClick={commit}
              >
                Import {preview.imported}{" "}
                {preview.imported === 1 ? "row" : "rows"}
              </button>
            </div>
          }
          className="page-section"
        >
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  {keyColumns.map((column) => (
                    <th scope="col" key={column}>
                      {column}
                    </th>
                  ))}
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className={row.ok ? "" : "row-error"}>
                    <td>{row.line}</td>
                    {keyColumns.map((column) => (
                      <td key={column}>{row.values[column] || "—"}</td>
                    ))}
                    <td>
                      <span
                        className={
                          "result-cell " + (row.ok ? "is-ok" : "is-bad")
                        }
                      >
                        {row.ok ? (
                          <CircleCheck size={15} aria-label="Ready" />
                        ) : (
                          <CircleAlert size={15} aria-label="Problem" />
                        )}
                        {row.message}
                      </span>
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

/* ======================= Data & privacy (school admin) ======================= */

const consentPill: Record<ConsentStatus | "Not requested", string> = {
  Granted: "pill-success",
  Pending: "pill-warning",
  Declined: "pill-danger",
  Withdrawn: "pill-danger",
  "Not requested": "pill-muted",
};

export function PrivacyAdmin() {
  const [tab, setTab] = useState<"consent" | "requests">("consent");
  return (
    <>
      <nav className="segmented-tabs" aria-label="Data and privacy">
        <button
          type="button"
          aria-pressed={tab === "consent"}
          onClick={() => setTab("consent")}
        >
          Parental consent
        </button>
        <button
          type="button"
          aria-pressed={tab === "requests"}
          onClick={() => setTab("requests")}
        >
          Data requests
        </button>
      </nav>
      {tab === "consent" ? <ConsentAdmin /> : <RequestsAdmin />}
    </>
  );
}

function ConsentAdmin() {
  const { records, actor, schoolId } = useDemo();
  const privacy = usePrivacyState().schools[schoolId];
  const [selected, setSelected] = useState<string[]>([]);
  const { run, messages } = useMessages();
  const rows = consentOverview(privacy, records);
  const count = (status: string) =>
    rows.filter((row) => row.status === status).length;
  const guardianName = (id?: string) =>
    records.guardians.find((item) => item.id === id)?.name ??
    "No guardian linked";

  function send(students: string[]) {
    let created: { guardian: string; id: string; student: string }[] = [];
    const ok = run(() => {
      updatePrivacyState((state) => {
        const result = requestConsents(
          state,
          records,
          actor,
          students,
          today(),
          () => crypto.randomUUID(),
        );
        created = result.created;
        return result.state;
      });
    }, "");
    if (!ok) return;
    notify(
      schoolId,
      created.map((item) => ({
        recipientId: item.guardian,
        recipientRole: "parent" as const,
        kind: "approval" as const,
        title: "Consent requested",
        body:
          "The school is asking for your consent to use " +
          (records.students.find((row) => row.id === item.student)?.name ??
            "your child") +
          "'s data. Review and respond.",
        href: "/demo/parent/privacy",
        contextId: item.id,
        dedupeKey: "consent:" + item.id,
      })),
    );
    logAudit(
      schoolId,
      "Privacy",
      "Requested parental consent",
      created.length + " students · version " + consentVersion,
    );
    setSelected([]);
    run(
      () => undefined,
      "Consent requests sent to " + created.length + " guardians.",
    );
  }

  const missing = rows
    .filter((row) => row.status !== "Granted" && row.status !== "Pending")
    .map((row) => row.student.id);

  return (
    <>
      <StatCards
        stats={[
          {
            label: "Granted",
            value: String(count("Granted")),
            note: "Consent on record",
            icon: "classes",
          },
          {
            label: "Pending",
            value: String(count("Pending")),
            note: "Awaiting parents",
            icon: "calendar",
          },
          {
            label: "Declined or withdrawn",
            value: String(count("Declined") + count("Withdrawn")),
            note: "Needs follow-up",
            icon: "tasks",
          },
          {
            label: "Not requested",
            value: String(count("Not requested")),
            note: "No request sent yet",
            icon: "students",
          },
        ]}
      />
      <SectionCard
        title="Consent by student"
        description={
          "Consent form version " +
          consentVersion +
          ". Requests go to each student's primary guardian."
        }
        className="page-section"
        actions={
          <div className="card-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={!selected.length}
              onClick={() => send(selected)}
            >
              <Send size={15} aria-hidden="true" />
              Request from selected ({selected.length})
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!missing.length}
              onClick={() => send(missing)}
            >
              <Send size={15} aria-hidden="true" />
              Request from all without consent ({missing.length})
            </button>
          </div>
        }
      >
        {messages}
        {rows.length ? (
          <div className="table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Select all students"
                      checked={selected.length === rows.length}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? rows.map((row) => row.student.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th scope="col">Student</th>
                  <th scope="col">Guardian</th>
                  <th scope="col">Status</th>
                  <th scope="col">Allowed uses</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, consent, status }) => (
                  <tr key={student.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Select " + student.name}
                        checked={selected.includes(student.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, student.id]
                              : current.filter((id) => id !== student.id),
                          )
                        }
                      />
                    </td>
                    <th scope="row">
                      {student.name}
                      <small>{student.code}</small>
                    </th>
                    <td>
                      {guardianName(
                        consent?.guardian ??
                          (
                            records.links.find(
                              (item) =>
                                item.student === student.id &&
                                item.primary === "Yes",
                            ) ??
                            records.links.find(
                              (item) => item.student === student.id,
                            )
                          )?.guardian,
                      )}
                    </td>
                    <td>
                      <span className={"pill " + consentPill[status]}>
                        {status}
                      </span>
                    </td>
                    <td>
                      {consent?.status === "Granted" ? (
                        <span className="tag-row tight">
                          {consentPurposes
                            .filter((item) => consent.purposes[item.key])
                            .map((item) => (
                              <span key={item.key} className="pill pill-muted">
                                {item.label}
                              </span>
                            ))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {consent
                        ? formatDate(consent.respondedOn || consent.requestedOn)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No enrolled students.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}

function RequestsAdmin() {
  const { records, actor, schoolId } = useDemo();
  const privacy = usePrivacyState().schools[schoolId];
  const learning = useLearningState().schools[schoolId];
  const fees = useFeeState().schools[schoolId];
  const [form, setForm] = useState<FormConfig>();
  const { run, messages } = useMessages();
  const requests = [...privacy.requests].sort((a, b) =>
    b.requestedOn.localeCompare(a.requestedOn),
  );
  const name = (id: string) =>
    records.students.find((item) => item.id === id)?.name ??
    records.guardians.find((item) => item.id === id)?.name ??
    "—";

  const tell = (request: DataRequest, title: string, body: string) =>
    notify(schoolId, [
      {
        recipientId: request.guardian,
        recipientRole: "parent",
        kind: "approval",
        title,
        body,
        href: "/demo/parent/privacy",
        contextId: request.id,
        dedupeKey: "data-request:" + request.id + ":" + title,
      },
    ]);

  function exportData(request: DataRequest) {
    const data = buildExport(
      records,
      learning,
      fees,
      privacy,
      request.student,
      new Date().toISOString(),
    );
    downloadFile(
      "student-data-" +
        (records.students.find((item) => item.id === request.student)?.code ??
          "export") +
        ".json",
      JSON.stringify(data, null, 2),
      "application/json",
    );
  }

  function complete(request: DataRequest) {
    if (request.kind === "Deletion") {
      if (
        !confirmAction(
          "Erase " +
            name(request.student) +
            "'s identity? Their name, guardian links and enrollments are removed. Anonymised academic records are kept. This can't be undone (except by Reset Demo Data).",
        )
      )
        return;
      const ok = run(() => {
        updatePrivacyState((state) =>
          resolveRequest(state, actor, request.id, "Completed", "", today()),
        );
        updateAcademicState((state) =>
          anonymizeStudent(state, schoolId, request.student),
        );
      }, "Student data erased.");
      if (!ok) return;
      logAudit(
        schoolId,
        "Privacy",
        "Completed deletion request",
        "Student identity erased · requested " + request.requestedOn,
      );
      tell(
        request,
        "Deletion request completed",
        "Your child's personal data has been erased.",
      );
      return;
    }
    const ok = run(
      () =>
        updatePrivacyState((state) =>
          resolveRequest(state, actor, request.id, "Completed", "", today()),
        ),
      "Export marked complete. The parent can now download it.",
    );
    if (!ok) return;
    logAudit(
      schoolId,
      "Privacy",
      "Completed export request",
      name(request.student),
    );
    tell(
      request,
      "Your data export is ready",
      "Download a copy of your child's data from Consent & Privacy.",
    );
  }

  const rejectForm = (request: DataRequest): FormConfig => ({
    title: "Reject " + request.kind.toLowerCase() + " request",
    description: "The parent will see this reason.",
    fields: [{ name: "note", label: "Reason", type: "textarea" }],
    submitLabel: "Reject request",
    onSubmit: (fields) => {
      const note = String(fields.get("note"));
      updatePrivacyState((state) =>
        resolveRequest(state, actor, request.id, "Rejected", note, today()),
      );
      logAudit(
        schoolId,
        "Privacy",
        "Rejected " + request.kind.toLowerCase() + " request",
        name(request.student) + " · " + note,
      );
      tell(request, "Data request rejected", note);
    },
  });

  return (
    <SectionCard
      title="Data requests from parents"
      description="Exports give parents a copy of everything held about their child. Deletions erase the child's identity and keep anonymised records the school must retain."
    >
      {messages}
      {requests.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Requested by</th>
                <th scope="col">Type</th>
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <th scope="row">{name(request.student)}</th>
                  <td>{name(request.guardian)}</td>
                  <td>
                    {request.kind === "Export" ? "Copy of data" : "Deletion"}
                  </td>
                  <td>{formatDate(request.requestedOn)}</td>
                  <td>
                    <span
                      className={
                        "pill " +
                        (request.status === "Completed"
                          ? "pill-success"
                          : request.status === "Rejected"
                            ? "pill-danger"
                            : "pill-warning")
                      }
                    >
                      {request.status}
                    </span>
                    {request.note && (
                      <small className="cell-note">{request.note}</small>
                    )}
                  </td>
                  <td>
                    <span className="card-actions">
                      {request.kind === "Export" && request.student && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => exportData(request)}
                        >
                          Download
                        </button>
                      )}
                      {request.status === "Pending" && (
                        <>
                          <button
                            type="button"
                            className={
                              "button " +
                              (request.kind === "Deletion"
                                ? "button-danger"
                                : "button-primary")
                            }
                            onClick={() => complete(request)}
                          >
                            {request.kind === "Deletion" ? (
                              <>
                                <Trash2 size={15} aria-hidden="true" />
                                Approve and erase
                              </>
                            ) : (
                              "Mark complete"
                            )}
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setForm(rejectForm(request))}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No data requests from parents yet.</EmptyState>
      )}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </SectionCard>
  );
}

/* ======================= Consent & privacy (parent) ======================= */

export function ParentPrivacy() {
  const { records, actor, schoolId, data } = useDemo();
  const privacy = usePrivacyState().schools[schoolId];
  const learning = useLearningState().schools[schoolId];
  const fees = useFeeState().schools[schoolId];
  const [choices, setChoices] =
    useState<Partial<Record<PurposeKey, boolean>>>();
  const { run, messages } = useMessages();
  const child = data.child;
  if (!child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  if (
    !linkedStudents(records, actor.person).some((item) => item.id === child.id)
  )
    return <EmptyState>This child is not linked to your account.</EmptyState>;
  const consent = currentConsent(privacy, child.id);
  const purposes = choices ?? consent?.purposes ?? {};
  const requests = privacy.requests
    .filter((item) => item.student === child.id)
    .sort((a, b) => b.requestedOn.localeCompare(a.requestedOn));
  const by = data.person.name;
  const editable =
    consent && (consent.status === "Pending" || consent.status === "Granted");

  const respond = (grant: boolean) => {
    if (!consent) return;
    const ok = run(
      () =>
        updatePrivacyState((state) =>
          respondConsent(
            state,
            records,
            actor,
            consent.id,
            { ...purposes, records: true },
            grant,
            today(),
            by,
          ),
        ),
      grant
        ? "Thank you. Your consent choices are saved."
        : "You declined. The school will contact you.",
    );
    if (ok) {
      setChoices(undefined);
      logAudit(
        schoolId,
        "Privacy",
        grant ? "Consent granted" : "Consent declined",
        child.name + " · version " + consent.version,
      );
    }
  };

  const ask = (kind: "Export" | "Deletion") => {
    if (
      kind === "Deletion" &&
      !confirmAction(
        "Request deletion of " +
          child.name +
          "'s personal data? The school will review it. Records the school must keep by law are anonymised rather than deleted.",
      )
    )
      return;
    const ok = run(
      () =>
        updatePrivacyState((state) =>
          requestData(state, records, actor, kind, today(), () =>
            crypto.randomUUID(),
          ),
        ),
      kind === "Export"
        ? "Request sent. You'll be notified when the copy is ready."
        : "Deletion request sent to the school.",
    );
    if (ok)
      logAudit(
        schoolId,
        "Privacy",
        "Requested " + (kind === "Export" ? "data copy" : "data deletion"),
        child.name,
      );
  };

  return (
    <>
      {messages}
      <SectionCard
        title={"Consent for " + child.name}
        description={
          consent
            ? "Form version " +
              consent.version +
              " · requested " +
              formatDate(consent.requestedOn)
            : "The school hasn't asked for consent yet."
        }
        actions={
          consent ? (
            <span className={"pill " + consentPill[consent.status]}>
              {consent.status}
            </span>
          ) : undefined
        }
      >
        {consent ? (
          <>
            <fieldset className="purpose-list" disabled={!editable}>
              <legend className="sr-only">
                How the school may use your child&apos;s data
              </legend>
              {consentPurposes.map((item) => (
                <label key={item.key} className="purpose-row">
                  <input
                    type="checkbox"
                    checked={
                      item.required
                        ? editable
                          ? true
                          : !!purposes[item.key]
                        : !!purposes[item.key]
                    }
                    disabled={item.required}
                    onChange={(event) =>
                      setChoices({
                        ...purposes,
                        [item.key]: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>
                      {item.label}
                      {item.required && (
                        <span className="pill pill-muted">Required</span>
                      )}
                    </strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="card-actions">
              {consent.status === "Pending" && (
                <>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => respond(true)}
                  >
                    <ShieldCheck size={15} aria-hidden="true" />
                    Give consent
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => respond(false)}
                  >
                    Decline
                  </button>
                </>
              )}
              {consent.status === "Granted" && (
                <>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!choices}
                    onClick={() => respond(true)}
                  >
                    Save choices
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      if (
                        !confirmAction(
                          "Withdraw consent? The school will contact you about next steps.",
                        )
                      )
                        return;
                      const ok = run(
                        () =>
                          updatePrivacyState((state) =>
                            withdrawConsent(
                              state,
                              records,
                              actor,
                              consent.id,
                              today(),
                              by,
                            ),
                          ),
                        "Consent withdrawn.",
                      );
                      if (ok)
                        logAudit(
                          schoolId,
                          "Privacy",
                          "Consent withdrawn",
                          child.name,
                        );
                    }}
                  >
                    Withdraw consent
                  </button>
                </>
              )}
              {(consent.status === "Declined" ||
                consent.status === "Withdrawn") && (
                <p className="field-hint">
                  To give consent again, ask the school office to send a new
                  request.
                </p>
              )}
            </div>
            <details className="history">
              <summary>History</summary>
              <ol>
                {consent.history.map((item, index) => (
                  <li key={index}>
                    {formatDate(item.at)} · {item.status} · {item.by}
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <EmptyState>
            You&apos;ll be notified when the school sends a consent form.
          </EmptyState>
        )}
      </SectionCard>
      <SectionCard
        title="Your child's data"
        description="Ask for a copy of everything the school holds about your child, or ask for it to be deleted."
        className="page-section"
        actions={
          <div className="card-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => ask("Export")}
            >
              <Download size={15} aria-hidden="true" />
              Request a copy
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={() => ask("Deletion")}
            >
              <Trash2 size={15} aria-hidden="true" />
              Request deletion
            </button>
          </div>
        }
      >
        {requests.length ? (
          <ul className="stack-list">
            {requests.map((request) => (
              <li key={request.id} className="due-row">
                <div>
                  <strong>
                    {request.kind === "Export" ? "Copy of data" : "Deletion"} ·{" "}
                    {request.status}
                  </strong>
                  <span>
                    Requested {formatDate(request.requestedOn)}
                    {request.resolvedOn &&
                      " · resolved " + formatDate(request.resolvedOn)}
                    {request.note && " · " + request.note}
                  </span>
                </div>
                {request.kind === "Export" &&
                  request.status === "Completed" && (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        downloadFile(
                          "my-child-data.json",
                          JSON.stringify(
                            buildExport(
                              records,
                              learning,
                              fees,
                              privacy,
                              child.id,
                              new Date().toISOString(),
                            ),
                            null,
                            2,
                          ),
                          "application/json",
                        )
                      }
                    >
                      <Download size={15} aria-hidden="true" />
                      Download copy
                    </button>
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No requests yet.</EmptyState>
        )}
      </SectionCard>
    </>
  );
}

/* ======================= Audit log ======================= */

const pageSize = 50;

export function AuditLog() {
  const { schoolId } = useDemo();
  const { entries } = useAuditState();
  const now = useNow(60_000);
  const [area, setArea] = useState<"" | AuditArea>("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(pageSize);
  if (!now) return <p className="field-hint">Loading audit log…</p>;
  const local = (iso: string) => localDateTime(new Date(iso));
  const term = query.trim().toLowerCase();
  const rows = entries.filter(
    (entry) =>
      entry.school === schoolId &&
      (!area || entry.area === area) &&
      (!from || local(entry.at).slice(0, 10) >= from) &&
      (!to || local(entry.at).slice(0, 10) <= to) &&
      (entry.actorName + " " + entry.action + " " + entry.detail)
        .toLowerCase()
        .includes(term),
  );
  const counts = (name: AuditArea) =>
    entries.filter((entry) => entry.school === schoolId && entry.area === name)
      .length;
  return (
    <SectionCard
      title={rows.length + " entries"}
      description="Changes to marks, fees, attendance, records and access in this school. Entries can't be edited or deleted."
      actions={
        <button
          type="button"
          className="button button-outline"
          disabled={!rows.length}
          onClick={() =>
            downloadFile(
              "audit-log-" + localCalendarDate(now) + ".csv",
              "﻿" + toCsv(auditCsvRows(rows)),
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={15} aria-hidden="true" />
          Export CSV
        </button>
      }
    >
      <div className="filter-bar">
        <label>
          Area
          <select
            value={area}
            onChange={(event) => setArea(event.target.value as AuditArea | "")}
          >
            <option value="">All areas</option>
            {auditAreas.map((item) => (
              <option key={item} value={item}>
                {item} ({counts(item)})
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="inline-search">
          <span className="sr-only">Search the log</span>
          <input
            type="search"
            placeholder="Search user, action or details"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {rows.length ? (
        <>
          <div className="table-wrap">
            <table className="pro-table audit-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Area</th>
                  <th scope="col">What changed</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap">
                      {formatDateTime(local(entry.at))}
                    </td>
                    <td>
                      {entry.actorName}
                      <small className="cell-note">
                        {entry.actorRole.replace("-", " ")}
                      </small>
                    </td>
                    <td>
                      <span className="pill pill-muted">{entry.area}</span>
                    </td>
                    <th scope="row">
                      {entry.action}
                      <small>{entry.detail}</small>
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setLimit(limit + pageSize)}
            >
              Show {Math.min(pageSize, rows.length - limit)} more
            </button>
          )}
        </>
      ) : (
        <EmptyState>No entries match these filters.</EmptyState>
      )}
      <p className="field-hint">
        Demo: the log is kept in this browser. In production it is stored on the
        server as an append-only record.
      </p>
    </SectionCard>
  );
}

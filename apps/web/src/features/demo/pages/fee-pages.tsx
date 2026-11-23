"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  Ban,
  CreditCard,
  KeyRound,
  Pencil,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { localCalendarDate } from "@/services/assignment-model";
import { sectionLabel } from "@/services/insights";
import { currentEnrollment } from "@/services/academic-model";
import {
  cancelInvoice,
  eligibleStudents,
  feeTotals,
  generateInvoices,
  invoiceSummary,
  invoicesFor,
  offlineMethods,
  payOnline,
  recordPayment,
  reminderChannels,
  removeFeeItem,
  saveFeeItem,
  saveGateway,
  sendReminders,
  type FeeItem,
  type FeeSchool,
  type Invoice,
  type InvoiceStatus,
  type Payment,
} from "@/services/fee-model";
import {
  formatRupees,
  updateFeeState,
  useFeeState,
} from "@/services/fee-store";
import { useNow } from "@/services/learning-store";
import { useDemo } from "../demo-context";
import { EmptyState, Meter, StatCards } from "../dashboard-widgets";
import { confirmAction, FormDialog, type FormConfig } from "../form-dialog";
import { formatDate } from "../format";
import { SectionCard } from "../page-header";

const statusPill: Record<InvoiceStatus, string> = {
  Paid: "pill-success",
  "Partly paid": "pill-warning",
  Unpaid: "pill-muted",
  Overdue: "pill-danger",
  Cancelled: "pill-muted",
};

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
  return { run, messages, setNotice };
}

function useToday() {
  const now = useNow(60_000);
  return now ? localCalendarDate(now) : undefined;
}

function Loading() {
  return <p className="field-hint">Loading fee records…</p>;
}

/* ---------- Receipt ---------- */

function ReceiptDialog({
  payment,
  fees,
  onClose,
}: {
  payment?: Payment;
  fees: FeeSchool;
  onClose: () => void;
}) {
  const { records, school } = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (payment && !dialog.current?.open) dialog.current?.showModal();
  }, [payment]);
  const invoice = fees.invoices.find((item) => item.id === payment?.invoice);
  const fee = fees.structure.find((item) => item.id === invoice?.fee);
  const student = records.students.find((item) => item.id === invoice?.student);
  const enrollment = student && currentEnrollment(records, student.id);
  const close = () => {
    dialog.current?.close();
  };
  return (
    <dialog
      ref={dialog}
      className="search-dialog academic-dialog receipt-dialog"
      aria-labelledby="receipt-title"
      onClose={onClose}
    >
      {payment && invoice && (
        <>
          <div className="print-area receipt">
            <div className="receipt-head">
              <div>
                <strong>{school.name}</strong>
                <span>{school.location}</span>
              </div>
              <div>
                <h2 id="receipt-title">Fee receipt</h2>
                <span>{payment.receipt}</span>
              </div>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Student</dt>
                <dd>
                  {student?.name ?? "—"} · {student?.code}
                </dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>
                  {enrollment ? sectionLabel(records, enrollment.section) : "—"}
                </dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>
                  {fee?.name ?? "—"} · {invoice.number}
                </dd>
              </div>
              <div>
                <dt>Paid on</dt>
                <dd>{formatDate(payment.paidOn)}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>
                  {payment.method} · {payment.reference}
                </dd>
              </div>
              <div>
                <dt>Razorpay payment ID</dt>
                <dd>{payment.gateway.razorpayPaymentId || "—"}</dd>
              </div>
              <div className="receipt-total">
                <dt>Amount received</dt>
                <dd>{formatRupees(payment.amount)}</dd>
              </div>
            </dl>
            {payment.status === "Simulated" && (
              <p className="field-hint">
                Demo payment: no money was charged. Razorpay is not connected
                yet.
              </p>
            )}
          </div>
          <div className="academic-toolbar no-print">
            <button
              type="button"
              className="button button-outline"
              onClick={close}
            >
              Close
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.print()}
            >
              <Printer size={15} aria-hidden="true" />
              Print / save PDF
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

/* ======================= School Admin ======================= */

const adminTabs = [
  ["overview", "Overview"],
  ["structure", "Fee structure"],
  ["invoices", "Invoices"],
  ["payments", "Payments"],
  ["gateway", "Payment gateway"],
] as const;
type AdminTab = (typeof adminTabs)[number][0];

export function AdminFees() {
  const [tab, setTab] = useState<AdminTab>("overview");
  return (
    <>
      <nav className="segmented-tabs" aria-label="Fee management">
        {adminTabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" ? (
        <FeeOverview onOpen={setTab} />
      ) : tab === "structure" ? (
        <FeeStructure />
      ) : tab === "invoices" ? (
        <Invoices />
      ) : tab === "payments" ? (
        <Payments />
      ) : (
        <GatewaySettingsPanel />
      )}
    </>
  );
}

function studentLabel(
  records: ReturnType<typeof useDemo>["records"],
  id: string,
) {
  const student = records.students.find((item) => item.id === id);
  return student ? student.name + " · " + student.code : "—";
}

function FeeOverview({ onOpen }: { onOpen: (tab: AdminTab) => void }) {
  const { records, actor } = useDemo();
  const fees = useFeeState().schools[actor.school];
  const today = useToday();
  const [channel, setChannel] = useState<string>("WhatsApp");
  const { run, messages } = useMessages();
  if (!today) return <Loading />;
  const totals = feeTotals(fees, fees.invoices, today);
  const dues = totals.summaries
    .filter((item) => item.balance > 0)
    .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due));
  const overdue = dues.filter((item) => item.status === "Overdue");
  const remind = (ids: string[], label: string) =>
    run(
      () =>
        updateFeeState((state) =>
          sendReminders(state, actor, ids, channel, today, () =>
            crypto.randomUUID(),
          ),
        ),
      channel + " reminder recorded for " + label + ".",
    );
  return (
    <>
      <StatCards
        stats={[
          {
            label: "Billed",
            value: formatRupees(totals.billed),
            note:
              fees.invoices.filter((item) => !item.cancelled).length +
              " invoices",
            icon: "tasks",
          },
          {
            label: "Collected",
            value: formatRupees(totals.collected),
            note: (totals.rate ?? 0) + "% of billed",
            icon: "attendance",
          },
          {
            label: "Outstanding",
            value: formatRupees(totals.outstanding),
            note: dues.length + " invoices with a balance",
            icon: "calendar",
          },
          {
            label: "Overdue",
            value: formatRupees(totals.overdue),
            note: overdue.length + " invoices past due",
            icon: "classes",
          },
        ]}
      />
      <div className="dashboard-grid feature-grid">
        <SectionCard
          title="Dues"
          description="Invoices with a balance, oldest due date first."
          actions={
            <div className="card-actions">
              <label className="inline-label">
                <span className="sr-only">Reminder channel</span>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                >
                  {reminderChannels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-outline"
                disabled={!overdue.length}
                onClick={() =>
                  remind(
                    overdue.map((item) => item.invoice.id),
                    overdue.length + " overdue invoices",
                  )
                }
              >
                <BellRing size={15} aria-hidden="true" />
                Remind all overdue
              </button>
            </div>
          }
        >
          {messages}
          {dues.length ? (
            <ul className="stack-list">
              {dues.map(({ invoice, balance, status }) => (
                <li key={invoice.id} className="due-row">
                  <div>
                    <strong>{studentLabel(records, invoice.student)}</strong>
                    <span>
                      {
                        fees.structure.find((item) => item.id === invoice.fee)
                          ?.name
                      }{" "}
                      · {invoice.number} · due {formatDate(invoice.due)}
                    </span>
                  </div>
                  <span className="due-amount">{formatRupees(balance)}</span>
                  <span className={"pill " + statusPill[status]}>{status}</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => remind([invoice.id], invoice.number)}
                  >
                    Remind
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No outstanding fees. Everything is paid.</EmptyState>
          )}
        </SectionCard>
        <SectionCard
          title="Collection"
          description="Collected against billed, by fee."
          actions={
            <button
              type="button"
              className="text-button"
              onClick={() => onOpen("structure")}
            >
              Fee structure
            </button>
          }
        >
          <p className="usage-inline">
            {totals.rate ?? 0}% collected overall
            <Meter
              value={totals.rate}
              label={(totals.rate ?? 0) + "% collected"}
            />
          </p>
          <ul className="usage-list">
            {fees.structure.map((item) => {
              const own = feeTotals(
                fees,
                fees.invoices.filter((invoice) => invoice.fee === item.id),
                today,
              );
              if (!own.billed) return null;
              return (
                <li key={item.id}>
                  <span>
                    {item.name} · {item.grade}
                    <strong>
                      {formatRupees(own.collected)} / {formatRupees(own.billed)}
                    </strong>
                  </span>
                  <Meter
                    value={own.rate}
                    label={(own.rate ?? 0) + "% collected"}
                  />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

function FeeStructure() {
  const { records, actor } = useDemo();
  const fees = useFeeState().schools[actor.school];
  const today = useToday();
  const [form, setForm] = useState<FormConfig>();
  const { run, messages, setNotice } = useMessages();
  const years = records.years.filter((item) => item.status !== "Archived");
  const activeYear = records.years.find((item) => item.status === "Active");
  const grades = [
    ...new Set(
      records.sections
        .filter((item) => years.some((year) => year.id === item.year))
        .map((item) => item.grade),
    ),
  ];
  const feeForm = (item?: FeeItem): FormConfig => ({
    title: item ? "Edit fee" : "Add fee",
    description:
      "Each fee is billed to every enrolled student in the chosen class.",
    fields: [
      { name: "name", label: "Fee name" },
      {
        name: "grade",
        label: "Class",
        type: "select",
        options: [
          { value: "All", label: "All classes" },
          ...grades.map((grade) => ({ value: grade, label: grade })),
        ],
      },
      {
        name: "year",
        label: "Academic year",
        type: "select",
        options: years.map((year) => ({ value: year.id, label: year.name })),
      },
      { name: "amount", label: "Amount (₹)", type: "number", min: 1 },
      { name: "due", label: "Due date", type: "date" },
    ],
    values: {
      name: item?.name ?? "",
      grade: item?.grade ?? grades[0] ?? "All",
      year: item?.year ?? activeYear?.id ?? "",
      amount: item ? String(item.amount) : "",
      due: item?.due ?? "",
    },
    onSubmit: (fields) => {
      updateFeeState((state) =>
        saveFeeItem(state, records, actor, {
          id: item?.id ?? crypto.randomUUID(),
          name: String(fields.get("name")),
          grade: String(fields.get("grade")),
          year: String(fields.get("year")),
          amount: Number(fields.get("amount")),
          due: String(fields.get("due")),
        }),
      );
      setNotice("Fee saved.");
    },
  });
  if (!today) return <Loading />;
  return (
    <SectionCard
      title="Fee structure"
      description="Charges per class for each academic year."
      actions={
        <button
          type="button"
          className="button button-primary"
          onClick={() => setForm(feeForm())}
        >
          <Plus size={16} aria-hidden="true" />
          Add fee
        </button>
      }
    >
      {messages}
      {fees.structure.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Fee</th>
                <th scope="col">Class</th>
                <th scope="col">Amount</th>
                <th scope="col">Due</th>
                <th scope="col">Invoiced</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...fees.structure]
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((item) => {
                  const eligible = eligibleStudents(records, item);
                  const billed = fees.invoices.filter(
                    (invoice) => invoice.fee === item.id && !invoice.cancelled,
                  );
                  const pending = eligible.filter(
                    (student) =>
                      !billed.some((invoice) => invoice.student === student.id),
                  ).length;
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        {item.name}
                        <small>
                          {records.years.find((year) => year.id === item.year)
                            ?.name ?? "—"}
                        </small>
                      </th>
                      <td>
                        {item.grade === "All" ? "All classes" : item.grade}
                      </td>
                      <td>{formatRupees(item.amount)}</td>
                      <td>{formatDate(item.due)}</td>
                      <td>
                        {billed.length}/{eligible.length} students
                      </td>
                      <td>
                        <span className="card-actions">
                          {pending > 0 && (
                            <button
                              type="button"
                              className="button button-outline"
                              onClick={() =>
                                confirmAction(
                                  "Create " +
                                    pending +
                                    " invoices of " +
                                    formatRupees(item.amount) +
                                    " for " +
                                    item.name +
                                    "?",
                                ) &&
                                run(
                                  () =>
                                    updateFeeState((state) =>
                                      generateInvoices(
                                        state,
                                        records,
                                        actor,
                                        item.id,
                                        today,
                                      ),
                                    ),
                                  pending + " invoices created.",
                                )
                              }
                            >
                              <Receipt size={15} aria-hidden="true" />
                              Generate {pending}
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-button small"
                            aria-label={"Edit " + item.name}
                            title="Edit fee"
                            onClick={() => setForm(feeForm(item))}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button small"
                            aria-label={"Remove " + item.name}
                            title="Remove fee"
                            onClick={() =>
                              confirmAction("Remove " + item.name + "?") &&
                              run(
                                () =>
                                  updateFeeState((state) =>
                                    removeFeeItem(state, actor, item.id),
                                  ),
                                "Fee removed.",
                              )
                            }
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No fees yet. Add the first fee for a class.</EmptyState>
      )}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </SectionCard>
  );
}

function Invoices() {
  const { records, actor } = useDemo();
  const fees = useFeeState().schools[actor.school];
  const today = useToday();
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const { run, messages, setNotice } = useMessages();
  if (!today) return <Loading />;
  const gradeOf = (student: string) => {
    const enrollment = currentEnrollment(records, student);
    return records.sections.find((item) => item.id === enrollment?.section)
      ?.grade;
  };
  const grades = [...new Set(records.sections.map((item) => item.grade))];
  const term = query.trim().toLowerCase();
  const rows = fees.invoices
    .map((invoice) => ({ invoice, ...invoiceSummary(fees, invoice, today) }))
    .filter(
      ({ invoice, status: current }) =>
        (!status || current === status) &&
        (!grade || gradeOf(invoice.student) === grade) &&
        (invoice.number + " " + studentLabel(records, invoice.student))
          .toLowerCase()
          .includes(term),
    )
    .sort((a, b) => b.invoice.number.localeCompare(a.invoice.number));

  const paymentForm = (invoice: Invoice, balance: number): FormConfig => ({
    title: "Record payment · " + invoice.number,
    description:
      studentLabel(records, invoice.student) +
      " · balance " +
      formatRupees(balance) +
      ". Online payments are taken by parents through the gateway.",
    fields: [
      {
        name: "amount",
        label: "Amount (₹)",
        type: "number",
        min: 1,
        max: balance,
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        options: offlineMethods.map((item) => ({ value: item, label: item })),
      },
      { name: "paidOn", label: "Paid on", type: "date" },
      {
        name: "reference",
        label: "Reference",
        required: false,
        hint: "Cheque number, transfer or UPI reference. Optional for cash.",
      },
    ],
    values: {
      amount: String(balance),
      method: "Cash",
      paidOn: today,
      reference: "",
    },
    submitLabel: "Record payment",
    onSubmit: (fields) => {
      updateFeeState((state) =>
        recordPayment(
          state,
          actor,
          invoice.id,
          {
            amount: Number(fields.get("amount")),
            method: String(fields.get("method")),
            paidOn: String(fields.get("paidOn")),
            reference: String(fields.get("reference") ?? ""),
          },
          today,
        ),
      );
      setNotice("Payment recorded. A receipt is available under Payments.");
    },
  });

  return (
    <SectionCard
      title={rows.length + " invoices"}
      description="Record front-office payments, send reminders or cancel unpaid invoices."
    >
      <div className="filter-bar">
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {Object.keys(statusPill).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Class
          <select
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <option value="">All classes</option>
            {grades.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="inline-search">
          <span className="sr-only">Search invoices</span>
          <input
            type="search"
            placeholder="Search student or invoice number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {messages}
      {rows.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Student</th>
                <th scope="col">Amount</th>
                <th scope="col">Paid</th>
                <th scope="col">Balance</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ invoice, paid, balance, status: current }) => {
                const reminders = fees.reminders.filter(
                  (item) => item.invoice === invoice.id,
                );
                return (
                  <tr key={invoice.id}>
                    <th scope="row">
                      {invoice.number}
                      <small>
                        {
                          fees.structure.find((item) => item.id === invoice.fee)
                            ?.name
                        }
                      </small>
                    </th>
                    <td>{studentLabel(records, invoice.student)}</td>
                    <td>{formatRupees(invoice.amount)}</td>
                    <td>{formatRupees(paid)}</td>
                    <td>{formatRupees(balance)}</td>
                    <td>
                      {formatDate(invoice.due)}
                      {reminders.length > 0 && (
                        <small className="cell-note">
                          {reminders.length} reminder
                          {reminders.length === 1 ? "" : "s"} sent
                        </small>
                      )}
                    </td>
                    <td>
                      <span className={"pill " + statusPill[current]}>
                        {current}
                      </span>
                    </td>
                    <td>
                      <span className="card-actions">
                        {balance > 0 && (
                          <>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                setForm(paymentForm(invoice, balance))
                              }
                            >
                              Record payment
                            </button>
                            <button
                              type="button"
                              className="icon-button small"
                              aria-label={
                                "Send in-app reminder for " + invoice.number
                              }
                              title="Send in-app reminder"
                              onClick={() =>
                                run(
                                  () =>
                                    updateFeeState((state) =>
                                      sendReminders(
                                        state,
                                        actor,
                                        [invoice.id],
                                        "In-app",
                                        today,
                                        () => crypto.randomUUID(),
                                      ),
                                    ),
                                  "Reminder sent for " + invoice.number + ".",
                                )
                              }
                            >
                              <BellRing size={15} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {!paid && !invoice.cancelled && (
                          <button
                            type="button"
                            className="icon-button small"
                            aria-label={"Cancel " + invoice.number}
                            title="Cancel invoice"
                            onClick={() =>
                              confirmAction("Cancel " + invoice.number + "?") &&
                              run(
                                () =>
                                  updateFeeState((state) =>
                                    cancelInvoice(state, actor, invoice.id),
                                  ),
                                invoice.number + " cancelled.",
                              )
                            }
                          >
                            <Ban size={15} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No invoices match these filters.</EmptyState>
      )}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
    </SectionCard>
  );
}

function Payments() {
  const { records, actor } = useDemo();
  const fees = useFeeState().schools[actor.school];
  const [receipt, setReceipt] = useState<Payment>();
  const payments = [...fees.payments].sort((a, b) =>
    b.receipt.localeCompare(a.receipt),
  );
  return (
    <SectionCard
      title={payments.length + " payments"}
      description="Razorpay columns fill in automatically once online payments are connected."
    >
      {payments.length ? (
        <div className="table-wrap">
          <table className="pro-table">
            <thead>
              <tr>
                <th scope="col">Receipt</th>
                <th scope="col">Student</th>
                <th scope="col">Paid on</th>
                <th scope="col">Method</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Razorpay order ID</th>
                <th scope="col">Razorpay payment ID</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const invoice = fees.invoices.find(
                  (item) => item.id === payment.invoice,
                );
                return (
                  <tr key={payment.id}>
                    <th scope="row">
                      {payment.receipt}
                      <small>{invoice?.number}</small>
                    </th>
                    <td>
                      {invoice ? studentLabel(records, invoice.student) : "—"}
                    </td>
                    <td>{formatDate(payment.paidOn)}</td>
                    <td>
                      {payment.method}
                      <small className="cell-note">{payment.reference}</small>
                    </td>
                    <td>{formatRupees(payment.amount)}</td>
                    <td>
                      <span
                        className={
                          "pill " +
                          (payment.status === "Simulated"
                            ? "pill-preview"
                            : "pill-success")
                        }
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="mono">
                      {payment.gateway.razorpayOrderId || "—"}
                    </td>
                    <td className="mono">
                      {payment.gateway.razorpayPaymentId || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setReceipt(payment)}
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No payments yet.</EmptyState>
      )}
      <ReceiptDialog
        payment={receipt}
        fees={fees}
        onClose={() => setReceipt(undefined)}
      />
    </SectionCard>
  );
}

function GatewaySettingsPanel() {
  const { actor } = useDemo();
  const gateway = useFeeState().schools[actor.school].gateway;
  const { run, messages } = useMessages();
  const connected = gateway.enabled && gateway.keyId;
  return (
    <div className="dashboard-grid">
      <SectionCard
        title="Razorpay"
        description="Online fee payments for parents."
        actions={
          <span
            className={"pill " + (connected ? "pill-success" : "pill-muted")}
          >
            {connected
              ? "Enabled · " + gateway.mode + " mode"
              : "Not connected"}
          </span>
        }
      >
        <form
          className="gateway-form"
          key={gateway.keyId + gateway.mode + gateway.enabled}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            run(
              () =>
                updateFeeState((state) =>
                  saveGateway(state, actor, {
                    provider: "razorpay",
                    enabled: fields.get("enabled") === "on",
                    mode: fields.get("mode") === "live" ? "live" : "test",
                    keyId: String(fields.get("keyId") ?? ""),
                  }),
                ),
              "Gateway settings saved.",
            );
          }}
        >
          <label>
            Mode
            <select name="mode" defaultValue={gateway.mode}>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label>
            Key ID
            <input
              name="keyId"
              defaultValue={gateway.keyId}
              placeholder="rzp_test_xxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-hint">
              The public key from Razorpay Dashboard → Settings → API Keys.
              Leave blank until you have it.
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={gateway.enabled}
            />
            Accept online payments
          </label>
          {messages}
          <button type="submit" className="button button-primary">
            <KeyRound size={15} aria-hidden="true" />
            Save settings
          </button>
        </form>
      </SectionCard>
      <SectionCard
        title="Server-side credentials"
        description="Secrets never go in the browser. Add them to the API's environment file."
      >
        <ul className="env-list">
          {[
            ["RAZORPAY_KEY_ID", "Public key ID (same value as above)"],
            [
              "RAZORPAY_KEY_SECRET",
              "Secret key: used to create orders and verify signatures",
            ],
            ["RAZORPAY_WEBHOOK_SECRET", "Verifies webhook calls from Razorpay"],
          ].map(([name, purpose]) => (
            <li key={name}>
              <code>{name}</code>
              <span>{purpose}</span>
              <span className="pill pill-muted">Not set</span>
            </li>
          ))}
        </ul>
        <p className="field-hint">
          File: <code>apps/api/.env.local</code> (template in{" "}
          <code>apps/api/.env.example</code>).
        </p>
        <h3 className="subheading">
          <ShieldCheck size={16} aria-hidden="true" />
          Integration checklist
        </h3>
        <ol className="steps">
          <li>The API creates a Razorpay order for the invoice balance.</li>
          <li>
            The parent pays in Razorpay Checkout using the Key ID and order ID.
          </li>
          <li>The API verifies the payment signature with the key secret.</li>
          <li>
            A <code>payment.captured</code> webhook marks the payment Captured
            and fills the Razorpay columns.
          </li>
        </ol>
        <p className="field-hint">
          Until then, parent payments are simulated and marked as such.
        </p>
      </SectionCard>
    </div>
  );
}

/* ======================= Parent ======================= */

export function ParentFees() {
  const { records, actor, data } = useDemo();
  const fees = useFeeState().schools[actor.school];
  const today = useToday();
  const [receipt, setReceipt] = useState<Payment>();
  const [paying, setPaying] = useState<{ invoice: Invoice; balance: number }>();
  const dialog = useRef<HTMLDialogElement>(null);
  const { run, messages } = useMessages();
  if (!data.child)
    return (
      <EmptyState>
        No children are linked to this parent in the selected school.
      </EmptyState>
    );
  if (!today) return <Loading />;
  const invoices = invoicesFor(fees, records, actor).filter(
    (item) => !item.cancelled,
  );
  const totals = feeTotals(fees, invoices, today);
  const next = totals.summaries
    .filter((item) => item.balance > 0)
    .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due))[0];
  const payments = fees.payments
    .filter((item) => invoices.some((invoice) => invoice.id === item.invoice))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const reminders = fees.reminders
    .filter((item) => invoices.some((invoice) => invoice.id === item.invoice))
    .sort((a, b) => b.sentOn.localeCompare(a.sentOn));
  const feeName = (invoice?: Invoice) =>
    fees.structure.find((item) => item.id === invoice?.fee)?.name ?? "Fee";
  const gatewayReady = fees.gateway.enabled && fees.gateway.keyId;

  return (
    <>
      <div className="kpi-strip">
        <div>
          <span>Total fees</span>
          <strong>{formatRupees(totals.billed)}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>{formatRupees(totals.collected)}</strong>
        </div>
        <div>
          <span>Balance due</span>
          <strong>{formatRupees(totals.outstanding)}</strong>
        </div>
        <div>
          <span>Next due</span>
          <strong className="kpi-text">
            {next ? formatDate(next.invoice.due) : "Nothing due"}
          </strong>
        </div>
      </div>
      <div className="preview-notice dash-card" role="note">
        <CreditCard size={20} aria-hidden="true" />
        <div>
          <h2>Online payments are in demo mode</h2>
          <p>
            {gatewayReady
              ? "The school has added its Razorpay key, but payments stay simulated until the payment server is connected. No money is charged."
              : "Razorpay is not connected yet, so “Pay now” records a simulated payment. No money is charged."}
          </p>
        </div>
      </div>
      {messages}
      <SectionCard
        title={data.child.name + "'s fees"}
        description="Invoices issued by the school for this academic year."
      >
        {totals.summaries.length ? (
          <ul className="test-rows">
            {totals.summaries
              .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due))
              .map(({ invoice, paid, balance, status }) => (
                <li key={invoice.id}>
                  <div>
                    <strong>{feeName(invoice)}</strong>
                    <span>
                      {invoice.number} · due {formatDate(invoice.due)} ·{" "}
                      {formatRupees(invoice.amount)}
                      {paid > 0 &&
                        balance > 0 &&
                        " · paid " + formatRupees(paid)}
                    </span>
                  </div>
                  <span className={"pill " + statusPill[status]}>{status}</span>
                  {balance > 0 ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        setPaying({ invoice, balance });
                        dialog.current?.showModal();
                      }}
                    >
                      Pay {formatRupees(balance)}
                    </button>
                  ) : (
                    <span className="score-chip">Paid in full</span>
                  )}
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState>No fees have been invoiced yet.</EmptyState>
        )}
      </SectionCard>
      <div className="dashboard-grid">
        <SectionCard
          title="Receipts"
          description="Download a receipt for any payment."
        >
          {payments.length ? (
            <ul className="stack-list">
              {payments.map((payment) => {
                const invoice = fees.invoices.find(
                  (item) => item.id === payment.invoice,
                );
                return (
                  <li key={payment.id} className="due-row">
                    <div>
                      <strong>
                        {formatRupees(payment.amount)} · {feeName(invoice)}
                      </strong>
                      <span>
                        {payment.receipt} · {formatDate(payment.paidOn)} ·{" "}
                        {payment.method}
                        {payment.status === "Simulated" && " (demo)"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setReceipt(payment)}
                    >
                      Receipt
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>No payments yet.</EmptyState>
          )}
        </SectionCard>
        <SectionCard
          title="Reminders"
          description="Fee reminders from the school."
        >
          {reminders.length ? (
            <ul className="stack-list">
              {reminders.map((item) => {
                const invoice = fees.invoices.find(
                  (row) => row.id === item.invoice,
                );
                return (
                  <li key={item.id}>
                    <strong>
                      {feeName(invoice)} due{" "}
                      {invoice && formatDate(invoice.due)}
                    </strong>
                    <span>
                      Sent {formatDate(item.sentOn)} by {item.channel}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>No reminders.</EmptyState>
          )}
        </SectionCard>
      </div>
      <dialog
        ref={dialog}
        className="search-dialog academic-dialog"
        aria-labelledby="pay-title"
        onClose={() => setPaying(undefined)}
      >
        {paying && (
          <>
            <h2 id="pay-title">Pay {formatRupees(paying.balance)}</h2>
            <dl className="detail-list">
              <div>
                <dt>Fee</dt>
                <dd>{feeName(paying.invoice)}</dd>
              </div>
              <div>
                <dt>Invoice</dt>
                <dd>{paying.invoice.number}</dd>
              </div>
              <div>
                <dt>Student</dt>
                <dd>{data.child.name}</dd>
              </div>
              <div>
                <dt>Payment method</dt>
                <dd>Razorpay Checkout (demo)</dd>
              </div>
            </dl>
            <p className="field-hint">
              This is a simulated payment for the demo. No card, UPI or bank
              details are collected and no money is charged.
            </p>
            <div className="academic-toolbar">
              <button
                type="button"
                className="button button-outline"
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const invoice = paying.invoice;
                  const ok = run(
                    () =>
                      updateFeeState((state) =>
                        payOnline(state, records, actor, invoice.id, today),
                      ),
                    "Payment recorded (demo). Your receipt is ready below.",
                  );
                  if (ok) dialog.current?.close();
                }}
              >
                Confirm demo payment
              </button>
            </div>
          </>
        )}
      </dialog>
      <ReceiptDialog
        payment={receipt}
        fees={fees}
        onClose={() => setReceipt(undefined)}
      />
    </>
  );
}

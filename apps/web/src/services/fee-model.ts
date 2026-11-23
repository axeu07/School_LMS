import { academicRecords } from "@/mocks/academics";
import type { SchoolId } from "@/types/demo";
import {
  currentEnrollment,
  linkedStudents,
  requireRule,
  validDate,
  type AcademicSchool,
} from "./academic-model";
import type { AssignmentActor } from "./assignment-model";

/* ---------- Types ---------- */

/** One charge in the fee structure, billed to every student in a grade. */
export type FeeItem = {
  id: string;
  year: string;
  /** A class / grade label from Classes & Sections, or "All". */
  grade: string;
  name: string;
  /** Whole rupees. */
  amount: number;
  due: string;
};
export type Invoice = {
  id: string;
  number: string;
  student: string;
  fee: string;
  amount: number;
  issued: string;
  due: string;
  cancelled: boolean;
};
export const offlineMethods = [
  "Cash",
  "Cheque",
  "Bank transfer",
  "UPI",
] as const;
export type PaymentMethod = (typeof offlineMethods)[number] | "Online";
/**
 * Razorpay columns stay blank until the gateway is connected on the backend.
 * They will hold the order ID, payment ID and signature Razorpay returns.
 */
export type GatewayColumns = {
  provider: "" | "razorpay";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};
export type Payment = {
  id: string;
  receipt: string;
  invoice: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  reference: string;
  /** "Simulated" marks demo online payments that never reached a gateway. */
  status: "Recorded" | "Simulated" | "Captured";
  gateway: GatewayColumns;
};
export const reminderChannels = ["In-app", "Email", "SMS", "WhatsApp"] as const;
export type ReminderChannel = (typeof reminderChannels)[number];
export type Reminder = {
  id: string;
  invoice: string;
  sentOn: string;
  channel: ReminderChannel;
};
/**
 * Browser-safe gateway settings. Only the public Key ID belongs here; the key
 * secret and webhook secret live in the API's environment, never the browser.
 */
export type GatewaySettings = {
  provider: "razorpay";
  enabled: boolean;
  mode: "test" | "live";
  keyId: string;
};
export type FeeSchool = {
  structure: FeeItem[];
  invoices: Invoice[];
  payments: Payment[];
  reminders: Reminder[];
  gateway: GatewaySettings;
  counters: { invoice: number; receipt: number };
};
export type FeeState = { version: 1; schools: Record<SchoolId, FeeSchool> };

export const blankGateway: GatewayColumns = {
  provider: "",
  razorpayOrderId: "",
  razorpayPaymentId: "",
  razorpaySignature: "",
};

/* ---------- Seed ---------- */

const code = (school: SchoolId) =>
  ({ westfield: "WA", harborview: "HI", cedar: "CG" })[school];
const invoiceNumber = (school: SchoolId, n: number) =>
  "INV-" + code(school) + "-" + String(n).padStart(4, "0");
const receiptNumber = (school: SchoolId, n: number) =>
  "RCPT-" + code(school) + "-" + String(n).padStart(4, "0");

function seedSchool(prefix: SchoolId, offset: number): FeeSchool {
  const source = academicRecords.find((item) => item.schoolId === prefix)!;
  const year = prefix + "-year";
  const grades = source.classes.map((item) => item.label.split(" · ")[0]);
  const tuition = [42_000, 38_000].map((value) => value - offset * 1_000);
  const structure: FeeItem[] = [
    ...grades.flatMap((grade, index) => [
      {
        id: prefix + "-fee-dev-" + index,
        year,
        grade,
        name: "Annual development fee",
        amount: 8_500,
        due: "2026-06-30",
      },
      {
        id: prefix + "-fee-t1-" + index,
        year,
        grade,
        name: "Tuition · Term 1",
        amount: tuition[index],
        due: "2026-07-10",
      },
      {
        id: prefix + "-fee-t2-" + index,
        year,
        grade,
        name: "Tuition · Term 2",
        amount: tuition[index],
        due: "2026-11-10",
      },
    ]),
    {
      id: prefix + "-fee-exam",
      year,
      grade: "All",
      name: "Examination fee",
      amount: 1_500,
      due: "2026-12-05",
    },
  ];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  let invoiceCount = 0;
  let receiptCount = 0;
  const bill = (student: string, fee: FeeItem) => {
    invoiceCount += 1;
    const invoice: Invoice = {
      id: prefix + "-inv-" + invoiceCount,
      number: invoiceNumber(prefix, invoiceCount),
      student,
      fee: fee.id,
      amount: fee.amount,
      issued: "2026-06-01",
      due: fee.due,
      cancelled: false,
    };
    invoices.push(invoice);
    return invoice;
  };
  const pay = (
    invoice: Invoice,
    amount: number,
    method: PaymentMethod,
    paidOn: string,
    reference: string,
  ) => {
    receiptCount += 1;
    payments.push({
      id: prefix + "-pay-" + receiptCount,
      receipt: receiptNumber(prefix, receiptCount),
      invoice: invoice.id,
      amount,
      method,
      paidOn,
      reference,
      status: method === "Online" ? "Simulated" : "Recorded",
      gateway: blankGateway,
    });
  };
  source.learners.forEach((learner, index) => {
    const own = (kind: string) =>
      structure.find(
        (item) => item.id === prefix + "-fee-" + kind + "-" + index,
      )!;
    const development = bill(learner.id, own("dev"));
    const term1 = bill(learner.id, own("t1"));
    const term2 = bill(learner.id, own("t2"));
    pay(development, development.amount, "Cash", "2026-06-24", "Front office");
    pay(
      term1,
      term1.amount,
      index ? "Bank transfer" : "Online",
      "2026-07-08",
      index ? "NEFT 7718203" : "Demo checkout",
    );
    // Student 0 has part-paid Term 2; student 1 has not paid it yet.
    if (index === 0) pay(term2, 20_000, "UPI", "2026-11-05", "UPI ref 552019");
  });
  return {
    structure,
    invoices,
    payments,
    reminders: [
      {
        id: prefix + "-reminder-0",
        invoice: invoices.find((item) => item.fee === prefix + "-fee-t2-1")!.id,
        sentOn: "2026-11-15",
        channel: "WhatsApp",
      },
    ],
    gateway: { provider: "razorpay", enabled: false, mode: "test", keyId: "" },
    counters: { invoice: invoiceCount, receipt: receiptCount },
  };
}

export const feeSeed: FeeState = {
  version: 1,
  schools: {
    westfield: seedSchool("westfield", 0),
    harborview: seedSchool("harborview", 4),
    cedar: seedSchool("cedar", 9),
  },
};

const isString = (value: unknown) => typeof value === "string";
const isAmount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function decodeFeeState(raw: string | null): FeeState {
  if (!raw) return feeSeed;
  try {
    const data = JSON.parse(raw) as FeeState;
    if (data?.version !== 1 || !data.schools) return feeSeed;
    const valid = Object.keys(feeSeed.schools).every((id) => {
      const school = data.schools[id as SchoolId];
      return (
        !!school &&
        Array.isArray(school.structure) &&
        school.structure.every(
          (row) =>
            [row.id, row.year, row.grade, row.name, row.due].every(isString) &&
            isAmount(row.amount),
        ) &&
        Array.isArray(school.invoices) &&
        school.invoices.every(
          (row) =>
            [
              row.id,
              row.number,
              row.student,
              row.fee,
              row.issued,
              row.due,
            ].every(isString) &&
            isAmount(row.amount) &&
            typeof row.cancelled === "boolean",
        ) &&
        Array.isArray(school.payments) &&
        school.payments.every(
          (row) =>
            [row.id, row.receipt, row.invoice, row.paidOn, row.reference].every(
              isString,
            ) &&
            isAmount(row.amount) &&
            [...offlineMethods, "Online"].includes(row.method) &&
            ["Recorded", "Simulated", "Captured"].includes(row.status) &&
            !!row.gateway &&
            [
              row.gateway.provider,
              row.gateway.razorpayOrderId,
              row.gateway.razorpayPaymentId,
              row.gateway.razorpaySignature,
            ].every(isString),
        ) &&
        Array.isArray(school.reminders) &&
        school.reminders.every(
          (row) =>
            [row.id, row.invoice, row.sentOn].every(isString) &&
            reminderChannels.includes(row.channel),
        ) &&
        !!school.gateway &&
        isString(school.gateway.keyId) &&
        typeof school.gateway.enabled === "boolean" &&
        ["test", "live"].includes(school.gateway.mode) &&
        !!school.counters &&
        isAmount(school.counters.invoice) &&
        isAmount(school.counters.receipt)
      );
    });
    return valid ? data : feeSeed;
  } catch {
    return feeSeed;
  }
}

/* ---------- Queries ---------- */

export type InvoiceStatus =
  "Paid" | "Partly paid" | "Unpaid" | "Overdue" | "Cancelled";

export function invoiceSummary(
  fees: FeeSchool,
  invoice: Invoice,
  today: string,
) {
  const paid = fees.payments
    .filter((item) => item.invoice === invoice.id)
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = invoice.cancelled ? 0 : Math.max(0, invoice.amount - paid);
  const status: InvoiceStatus = invoice.cancelled
    ? "Cancelled"
    : balance === 0
      ? "Paid"
      : invoice.due < today
        ? "Overdue"
        : paid > 0
          ? "Partly paid"
          : "Unpaid";
  return { paid, balance, status };
}

/** Invoices the actor may see: all for admins, a linked child's for parents. */
export function invoicesFor(
  fees: FeeSchool,
  school: AcademicSchool,
  actor: AssignmentActor,
) {
  if (actor.role === "school-admin") return fees.invoices;
  const student =
    actor.role === "parent"
      ? linkedStudents(school, actor.person).find(
          (item) => item.id === actor.child,
        )?.id
      : actor.role === "student"
        ? actor.person
        : undefined;
  return fees.invoices.filter((item) => item.student === student);
}

export function feeTotals(fees: FeeSchool, invoices: Invoice[], today: string) {
  const live = invoices.filter((item) => !item.cancelled);
  const summaries = live.map((item) => ({
    invoice: item,
    ...invoiceSummary(fees, item, today),
  }));
  const billed = live.reduce((sum, item) => sum + item.amount, 0);
  const collected = summaries.reduce((sum, item) => sum + item.paid, 0);
  return {
    billed,
    collected,
    outstanding: billed - collected,
    overdue: summaries
      .filter((item) => item.status === "Overdue")
      .reduce((sum, item) => sum + item.balance, 0),
    rate: billed ? Math.round((100 * collected) / billed) : undefined,
    summaries,
  };
}

/** Students in a fee item's grade with a current enrollment in its year. */
export function eligibleStudents(school: AcademicSchool, item: FeeItem) {
  return school.students.filter((student) => {
    const enrollment = currentEnrollment(school, student.id);
    const section = school.sections.find(
      (group) => group.id === enrollment?.section,
    );
    return (
      section?.year === item.year &&
      (item.grade === "All" || section.grade === item.grade)
    );
  });
}

/* ---------- Rules ---------- */

function requireAdmin(actor: AssignmentActor) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can manage fees.",
  );
}

function replace(
  state: FeeState,
  actor: AssignmentActor,
  fees: FeeSchool,
): FeeState {
  return { ...state, schools: { ...state.schools, [actor.school]: fees } };
}

export function saveFeeItem(
  state: FeeState,
  school: AcademicSchool,
  actor: AssignmentActor,
  value: FeeItem,
) {
  requireAdmin(actor);
  const fees = state.schools[actor.school];
  const name = value.name.trim();
  requireRule(name, "Enter a fee name.");
  requireRule(
    Number.isInteger(value.amount) &&
      value.amount > 0 &&
      value.amount <= 10_000_000,
    "Enter an amount in whole rupees.",
  );
  const year = school.years.find((item) => item.id === value.year);
  requireRule(
    year && year.status !== "Archived",
    "Choose an open academic year.",
  );
  requireRule(
    value.grade === "All" ||
      school.sections.some(
        (item) => item.year === value.year && item.grade === value.grade,
      ),
    "Choose a class that has sections in this academic year.",
  );
  requireRule(
    validDate(value.due) && value.due >= year.start && value.due <= year.end,
    "Choose a due date within the academic year.",
  );
  requireRule(
    !fees.structure.some(
      (item) =>
        item.id !== value.id &&
        item.year === value.year &&
        item.grade === value.grade &&
        item.name.toLowerCase() === name.toLowerCase(),
    ),
    "This class already has a fee with that name.",
  );
  const existing = fees.structure.find((item) => item.id === value.id);
  const invoiced = fees.invoices.some((item) => item.fee === value.id);
  requireRule(
    !invoiced ||
      (existing!.amount === value.amount &&
        existing!.grade === value.grade &&
        existing!.year === value.year),
    "Invoices exist for this fee, so its amount, class and year are locked.",
  );
  const item = { ...value, name };
  return replace(state, actor, {
    ...fees,
    structure: existing
      ? fees.structure.map((row) => (row.id === value.id ? item : row))
      : [...fees.structure, item],
  });
}

export function removeFeeItem(
  state: FeeState,
  actor: AssignmentActor,
  id: string,
) {
  requireAdmin(actor);
  const fees = state.schools[actor.school];
  requireRule(
    !fees.invoices.some((item) => item.fee === id),
    "Invoices exist for this fee. Cancel them first.",
  );
  return replace(state, actor, {
    ...fees,
    structure: fees.structure.filter((item) => item.id !== id),
  });
}

/** Bills every eligible student who doesn't already have an invoice for the fee. */
export function generateInvoices(
  state: FeeState,
  school: AcademicSchool,
  actor: AssignmentActor,
  feeId: string,
  today: string,
) {
  requireAdmin(actor);
  const fees = state.schools[actor.school];
  const item = fees.structure.find((row) => row.id === feeId);
  requireRule(item, "Choose a fee from the structure.");
  const billed = new Set(
    fees.invoices
      .filter((row) => row.fee === feeId && !row.cancelled)
      .map((row) => row.student),
  );
  const students = eligibleStudents(school, item).filter(
    (student) => !billed.has(student.id),
  );
  requireRule(
    students.length,
    "Every eligible student already has an invoice for this fee.",
  );
  let counter = fees.counters.invoice;
  const invoices = students.map((student) => {
    counter += 1;
    return {
      id: actor.school + "-inv-" + counter,
      number: invoiceNumber(actor.school, counter),
      student: student.id,
      fee: item.id,
      amount: item.amount,
      issued: today,
      due: item.due,
      cancelled: false,
    };
  });
  return replace(state, actor, {
    ...fees,
    invoices: [...fees.invoices, ...invoices],
    counters: { ...fees.counters, invoice: counter },
  });
}

export function cancelInvoice(
  state: FeeState,
  actor: AssignmentActor,
  id: string,
) {
  requireAdmin(actor);
  const fees = state.schools[actor.school];
  requireRule(
    fees.invoices.some((item) => item.id === id),
    "This invoice is unavailable.",
  );
  requireRule(
    !fees.payments.some((item) => item.invoice === id),
    "This invoice has payments, so it can't be cancelled.",
  );
  return replace(state, actor, {
    ...fees,
    invoices: fees.invoices.map((item) =>
      item.id === id ? { ...item, cancelled: true } : item,
    ),
  });
}

function addPayment(
  state: FeeState,
  actor: AssignmentActor,
  invoice: Invoice,
  payment: Omit<Payment, "id" | "receipt">,
  today: string,
) {
  const fees = state.schools[actor.school];
  const { balance } = invoiceSummary(fees, invoice, today);
  requireRule(!invoice.cancelled, "This invoice is cancelled.");
  requireRule(balance > 0, "This invoice is already paid.");
  requireRule(
    Number.isInteger(payment.amount) &&
      payment.amount > 0 &&
      payment.amount <= balance,
    "Enter an amount between ₹1 and the balance due.",
  );
  const counter = fees.counters.receipt + 1;
  return replace(state, actor, {
    ...fees,
    payments: [
      ...fees.payments,
      {
        ...payment,
        id: actor.school + "-pay-" + counter,
        receipt: receiptNumber(actor.school, counter),
      },
    ],
    counters: { ...fees.counters, receipt: counter },
  });
}

/** Records a cash, cheque, bank transfer or UPI payment at the front office. */
export function recordPayment(
  state: FeeState,
  actor: AssignmentActor,
  invoiceId: string,
  value: {
    amount: number;
    method: string;
    paidOn: string;
    reference: string;
  },
  today: string,
) {
  requireAdmin(actor);
  const invoice = state.schools[actor.school].invoices.find(
    (item) => item.id === invoiceId,
  );
  requireRule(invoice, "This invoice is unavailable.");
  requireRule(
    (offlineMethods as readonly string[]).includes(value.method),
    "Choose how the payment was made.",
  );
  requireRule(
    validDate(value.paidOn) && value.paidOn <= today,
    "Enter a payment date up to today.",
  );
  requireRule(
    value.method === "Cash" || value.reference.trim(),
    "Enter the cheque, transfer or UPI reference.",
  );
  return addPayment(
    state,
    actor,
    invoice,
    {
      invoice: invoice.id,
      amount: value.amount,
      method: value.method as PaymentMethod,
      paidOn: value.paidOn,
      reference: value.reference.trim() || "Front office",
      status: "Recorded",
      gateway: blankGateway,
    },
    today,
  );
}

/**
 * A parent pays the full balance online. Until Razorpay is connected on the
 * backend this is a simulated payment with blank gateway columns.
 */
export function payOnline(
  state: FeeState,
  school: AcademicSchool,
  actor: AssignmentActor,
  invoiceId: string,
  today: string,
) {
  requireRule(actor.role === "parent", "Only a parent can pay fees online.");
  const fees = state.schools[actor.school];
  const invoice = invoicesFor(fees, school, actor).find(
    (item) => item.id === invoiceId,
  );
  requireRule(invoice, "This invoice is unavailable for your child.");
  const { balance } = invoiceSummary(fees, invoice, today);
  return addPayment(
    state,
    actor,
    invoice,
    {
      invoice: invoice.id,
      amount: balance,
      method: "Online",
      paidOn: today,
      reference: "Demo checkout",
      status: "Simulated",
      gateway: blankGateway,
    },
    today,
  );
}

export function sendReminders(
  state: FeeState,
  actor: AssignmentActor,
  invoiceIds: string[],
  channel: string,
  today: string,
  makeId: () => string,
) {
  requireAdmin(actor);
  requireRule(
    (reminderChannels as readonly string[]).includes(channel),
    "Choose a reminder channel.",
  );
  const fees = state.schools[actor.school];
  const due = fees.invoices.filter(
    (item) =>
      invoiceIds.includes(item.id) &&
      invoiceSummary(fees, item, today).balance > 0,
  );
  requireRule(due.length, "Choose invoices with a balance due.");
  return replace(state, actor, {
    ...fees,
    reminders: [
      ...fees.reminders,
      ...due.map((item) => ({
        id: makeId(),
        invoice: item.id,
        sentOn: today,
        channel: channel as ReminderChannel,
      })),
    ],
  });
}

export const razorpayKeyPattern = /^rzp_(test|live)_[A-Za-z0-9]{8,}$/;

export function saveGateway(
  state: FeeState,
  actor: AssignmentActor,
  value: GatewaySettings,
) {
  requireAdmin(actor);
  const keyId = value.keyId.trim();
  requireRule(
    !keyId || razorpayKeyPattern.test(keyId),
    "A Razorpay Key ID looks like rzp_test_… or rzp_live_….",
  );
  requireRule(
    !keyId || keyId.startsWith("rzp_" + value.mode + "_"),
    "The Key ID doesn't match the selected mode.",
  );
  requireRule(
    !value.enabled || keyId,
    "Add the Razorpay Key ID before enabling online payments.",
  );
  const fees = state.schools[actor.school];
  return replace(state, actor, {
    ...fees,
    gateway: { ...value, provider: "razorpay", keyId },
  });
}

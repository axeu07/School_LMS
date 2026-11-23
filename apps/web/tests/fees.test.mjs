import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(
        new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href,
        context,
      );
    }
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    ) {
      return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});

const { academicSeed } = await import("../src/services/academic-seed.ts");
const {
  feeSeed,
  decodeFeeState,
  invoiceSummary,
  invoicesFor,
  feeTotals,
  saveFeeItem,
  removeFeeItem,
  generateInvoices,
  cancelInvoice,
  recordPayment,
  payOnline,
  sendReminders,
  saveGateway,
} = await import("../src/services/fee-model.ts");

const school = academicSeed.schools.westfield;
const admin = {
  school: "westfield",
  role: "school-admin",
  person: "westfield-admin",
};
const teacher = {
  school: "westfield",
  role: "teacher",
  person: "westfield-teacher",
};
const parent = {
  school: "westfield",
  role: "parent",
  person: "westfield-parent",
  child: "westfield-student-0",
};
const today = "2026-11-23";
const fees = (state) => state.schools.westfield;
const invoiceFor = (state, fee, student = "westfield-student-0") =>
  fees(state).invoices.find(
    (item) => item.fee === fee && item.student === student,
  );

test("seed invoices show paid, part-paid and overdue balances", () => {
  const school0 = fees(feeSeed);
  const term2 = invoiceFor(feeSeed, "westfield-fee-t2-0");
  assert.deepEqual(invoiceSummary(school0, term2, today), {
    paid: 20000,
    balance: 22000,
    status: "Overdue",
  });
  assert.equal(
    invoiceSummary(school0, invoiceFor(feeSeed, "westfield-fee-dev-0"), today)
      .status,
    "Paid",
  );
  assert.equal(
    invoiceSummary(school0, term2, "2026-11-01").status,
    "Partly paid",
  );
  const totals = feeTotals(school0, school0.invoices, today);
  assert.equal(totals.billed, 8500 * 2 + 42000 * 2 + 38000 * 2);
  assert.equal(totals.outstanding, 22000 + 38000);
  assert.equal(totals.overdue, 60000);
  assert.ok(
    school0.payments.every(
      (item) =>
        item.gateway.razorpayOrderId === "" &&
        item.gateway.razorpayPaymentId === "" &&
        item.gateway.razorpaySignature === "",
    ),
    "Razorpay columns start blank",
  );
  assert.equal(school0.gateway.keyId, "");
  assert.deepEqual(decodeFeeState(JSON.stringify(feeSeed)), feeSeed);
  assert.equal(decodeFeeState("{"), feeSeed);
});

test("fee structure validates and locks invoiced amounts", () => {
  const item = {
    id: "fee-new",
    year: "westfield-year",
    grade: "Grade 8",
    name: "Sports fee",
    amount: 2500,
    due: "2027-01-15",
  };
  assert.throws(
    () => saveFeeItem(feeSeed, school, teacher, item),
    /administrator/,
  );
  assert.throws(
    () => saveFeeItem(feeSeed, school, admin, { ...item, grade: "Grade 12" }),
    /sections in this academic year/,
  );
  assert.throws(
    () => saveFeeItem(feeSeed, school, admin, { ...item, amount: 10.5 }),
    /whole rupees/,
  );
  assert.throws(
    () => saveFeeItem(feeSeed, school, admin, { ...item, due: "2028-01-01" }),
    /within the academic year/,
  );
  let state = saveFeeItem(feeSeed, school, admin, item);
  assert.throws(
    () =>
      saveFeeItem(state, school, admin, {
        ...item,
        id: "dup",
        name: "sports FEE",
      }),
    /already has a fee/,
  );
  assert.throws(
    () =>
      saveFeeItem(feeSeed, school, admin, {
        ...fees(feeSeed).structure[0],
        amount: 9000,
      }),
    /locked/,
  );
  assert.throws(
    () => removeFeeItem(feeSeed, admin, fees(feeSeed).structure[0].id),
    /Cancel them first/,
  );
  state = removeFeeItem(state, admin, "fee-new");
  assert.deepEqual(fees(state).structure, fees(feeSeed).structure);
});

test("invoices generate once per eligible student with sequential numbers", () => {
  let state = generateInvoices(
    feeSeed,
    school,
    admin,
    "westfield-fee-exam",
    today,
  );
  const created = fees(state).invoices.filter(
    (item) => item.fee === "westfield-fee-exam",
  );
  assert.equal(created.length, 2);
  assert.deepEqual(
    created.map((item) => item.number),
    ["INV-WA-0007", "INV-WA-0008"],
  );
  assert.throws(
    () => generateInvoices(state, school, admin, "westfield-fee-exam", today),
    /already has an invoice/,
  );
  state = cancelInvoice(state, admin, created[0].id);
  assert.equal(
    invoiceSummary(
      fees(state),
      fees(state).invoices.find((i) => i.id === created[0].id),
      today,
    ).status,
    "Cancelled",
  );
  assert.throws(
    () =>
      cancelInvoice(state, admin, invoiceFor(state, "westfield-fee-dev-0").id),
    /has payments/,
  );
  state = generateInvoices(state, school, admin, "westfield-fee-exam", today);
  assert.equal(fees(state).counters.invoice, 9);
});

test("front-office payments validate amounts, methods and references", () => {
  const term2 = invoiceFor(feeSeed, "westfield-fee-t2-0");
  const payment = {
    amount: 5000,
    method: "Cheque",
    paidOn: today,
    reference: "CHQ 88123",
  };
  assert.throws(
    () =>
      recordPayment(
        feeSeed,
        admin,
        term2.id,
        { ...payment, amount: 22001 },
        today,
      ),
    /balance due/,
  );
  assert.throws(
    () =>
      recordPayment(
        feeSeed,
        admin,
        term2.id,
        { ...payment, reference: " " },
        today,
      ),
    /reference/,
  );
  assert.throws(
    () =>
      recordPayment(
        feeSeed,
        admin,
        term2.id,
        { ...payment, method: "Online" },
        today,
      ),
    /how the payment/,
  );
  assert.throws(
    () =>
      recordPayment(
        feeSeed,
        admin,
        term2.id,
        { ...payment, paidOn: "2026-11-30" },
        today,
      ),
    /up to today/,
  );
  const state = recordPayment(feeSeed, admin, term2.id, payment, today);
  const added = fees(state).payments.at(-1);
  assert.equal(added.receipt, "RCPT-WA-0006");
  assert.equal(added.status, "Recorded");
  assert.equal(invoiceSummary(fees(state), term2, today).balance, 17000);
  assert.throws(
    () =>
      recordPayment(
        feeSeed,
        admin,
        invoiceFor(feeSeed, "westfield-fee-dev-0").id,
        payment,
        today,
      ),
    /already paid/,
  );
});

test("parents pay only their linked child's invoices, as simulated online payments", () => {
  const mine = invoicesFor(fees(feeSeed), school, parent);
  assert.ok(mine.every((item) => item.student === "westfield-student-0"));
  const other = invoiceFor(
    feeSeed,
    "westfield-fee-t2-1",
    "westfield-student-1",
  );
  assert.throws(
    () => payOnline(feeSeed, school, parent, other.id, today),
    /unavailable for your child/,
  );
  assert.throws(
    () => payOnline(feeSeed, school, admin, other.id, today),
    /Only a parent/,
  );
  const term2 = invoiceFor(feeSeed, "westfield-fee-t2-0");
  const state = payOnline(feeSeed, school, parent, term2.id, today);
  const added = fees(state).payments.at(-1);
  assert.equal(added.amount, 22000);
  assert.equal(added.status, "Simulated");
  assert.equal(added.gateway.razorpayPaymentId, "");
  assert.equal(invoiceSummary(fees(state), term2, today).status, "Paid");
});

test("reminders go only to invoices with a balance", () => {
  let n = 0;
  const id = () => "r" + ++n;
  const paid = invoiceFor(feeSeed, "westfield-fee-dev-0").id;
  const due = invoiceFor(feeSeed, "westfield-fee-t2-0").id;
  assert.throws(
    () => sendReminders(feeSeed, admin, [paid], "SMS", today, id),
    /balance due/,
  );
  const state = sendReminders(feeSeed, admin, [paid, due], "SMS", today, id);
  assert.deepEqual(fees(state).reminders.slice(-1), [
    { id: "r1", invoice: due, sentOn: today, channel: "SMS" },
  ]);
});

test("Razorpay settings keep only a public key ID and validate it", () => {
  const base = {
    provider: "razorpay",
    enabled: false,
    mode: "test",
    keyId: "",
  };
  assert.doesNotThrow(() => saveGateway(feeSeed, admin, base));
  assert.throws(
    () => saveGateway(feeSeed, admin, { ...base, enabled: true }),
    /before enabling/,
  );
  assert.throws(
    () => saveGateway(feeSeed, admin, { ...base, keyId: "secret123" }),
    /rzp_test_/,
  );
  assert.throws(
    () =>
      saveGateway(feeSeed, admin, { ...base, keyId: "rzp_live_ABCDEFGH12" }),
    /selected mode/,
  );
  const state = saveGateway(feeSeed, admin, {
    ...base,
    enabled: true,
    keyId: " rzp_test_ABCDEFGH12 ",
  });
  assert.equal(fees(state).gateway.keyId, "rzp_test_ABCDEFGH12");
  assert.equal(Object.keys(fees(state).gateway).includes("keySecret"), false);
  assert.throws(() => saveGateway(feeSeed, teacher, base), /administrator/);
});

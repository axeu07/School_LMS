import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const { saveAcademicRecord } =
  await import("../src/services/academic-model.ts");
const { sha256 } = await import("../src/services/hash.ts");
const branding = await import("../src/services/branding-model.ts");
const auth = await import("../src/services/auth-model.ts");
const importer = await import("../src/services/import-model.ts");
const privacy = await import("../src/services/privacy-model.ts");
const audit = await import("../src/services/audit-model.ts");
const { learningSeed } = await import("../src/services/learning-model.ts");
const { feeSeed, recordPayment } = await import("../src/services/fee-model.ts");

const admin = {
  school: "westfield",
  role: "school-admin",
  person: "westfield-admin",
};
const parent = {
  school: "westfield",
  role: "parent",
  person: "westfield-parent",
  child: "westfield-student-0",
};
const at = (value) => new Date(value);

test("sha256 matches Node's implementation", () => {
  for (const text of ["", "abc", "a".repeat(55), "b".repeat(64), "₹ नमस्ते"])
    assert.equal(sha256(text), createHash("sha256").update(text).digest("hex"));
});

test("branding validates colour contrast, codes, subdomains and logos", () => {
  const {
    brandingSeed,
    saveBranding,
    findSchool,
    contrastRatio,
    brandPalette,
  } = branding;
  const value = brandingSeed.schools.westfield;
  assert.ok(contrastRatio(value.primary, "#ffffff") >= 4.5);
  assert.throws(
    () =>
      saveBranding(brandingSeed, "teacher", "westfield", "westfield", value),
    /administrator/,
  );
  assert.throws(
    () =>
      saveBranding(brandingSeed, "school-admin", "cedar", "westfield", value),
    /administrator/,
  );
  assert.throws(
    () =>
      saveBranding(brandingSeed, "school-admin", "westfield", "westfield", {
        ...value,
        primary: "#ffd54f",
      }),
    /too light/,
  );
  assert.throws(
    () =>
      saveBranding(brandingSeed, "school-admin", "westfield", "westfield", {
        ...value,
        code: "HBV26",
      }),
    /already uses this code/,
  );
  assert.throws(
    () =>
      saveBranding(brandingSeed, "super-admin", "westfield", "westfield", {
        ...value,
        subdomain: "Bad Name",
      }),
    /subdomain/,
  );
  assert.throws(
    () =>
      saveBranding(brandingSeed, "school-admin", "westfield", "westfield", {
        ...value,
        logo: "javascript:alert(1)",
      }),
    /logo/,
  );
  const state = saveBranding(
    brandingSeed,
    "super-admin",
    "westfield",
    "westfield",
    {
      ...value,
      displayName: "  Westfield Academy Pune ",
      code: "wfa27",
      primary: "#0B5D3B",
      logo: "data:image/png;base64,iVBORw0KGgo=",
    },
  );
  assert.equal(state.schools.westfield.displayName, "Westfield Academy Pune");
  assert.equal(state.schools.westfield.code, "WFA27");
  assert.equal(state.schools.westfield.primary, "#0b5d3b");
  assert.equal(findSchool(state, " wfa27 "), "westfield");
  assert.equal(findSchool(state, "harborview.acadmaxis.example"), "harborview");
  assert.equal(findSchool(state, "nope"), undefined);
  assert.equal(brandPalette("#4937b8")["--primary"], "#4937b8");
  assert.equal(branding.decodeBrandingState("{"), brandingSeed);
});

test("password sign-in, lockout and inactive accounts", () => {
  const accounts = auth.accountsFor(academicSeed, "westfield");
  assert.deepEqual(accounts.map((item) => item.role).sort(), [
    "parent",
    "school-admin",
    "student",
    "student", // the Class 10 demo student
    "teacher",
  ]);
  const now = at("2026-11-23T10:00:00Z");
  let result = auth.signIn(
    auth.authSeed,
    accounts,
    "WESTFIELD.TEACHER@example.test",
    auth.demoPassword,
    now,
  );
  assert.equal(result.error, undefined);
  assert.equal(result.auth.session.role, "teacher");
  result = auth.signIn(auth.authSeed, accounts, "ST-1", auth.demoPassword, now);
  assert.equal(result.auth.session.role, "student");
  result = auth.signIn(
    auth.authSeed,
    accounts,
    "nobody@example.test",
    "x",
    now,
  );
  assert.equal(result.error, auth.signInError);
  let state = auth.authSeed;
  for (let i = 0; i < auth.lockAfterFailures; i++)
    state = auth.signIn(
      state,
      accounts,
      "westfield.admin@example.test",
      "wrong",
      now,
    ).auth;
  result = auth.signIn(
    state,
    accounts,
    "westfield.admin@example.test",
    auth.demoPassword,
    now,
  );
  assert.match(result.error, /Try again in 5 minutes/);
  result = auth.signIn(
    state,
    accounts,
    "westfield.admin@example.test",
    auth.demoPassword,
    at("2026-11-23T10:06:00Z"),
  );
  assert.equal(result.auth.session.role, "school-admin");
  assert.equal(result.auth.attempts["westfield:school-admin"], undefined);
  // Deactivating the teacher removes their sign-in immediately.
  const teacher = academicSeed.schools.westfield.teachers[0];
  const inactive = saveAcademicRecord(academicSeed, admin, "teachers", {
    ...teacher,
    status: "Inactive",
  });
  assert.equal(
    auth
      .accountsFor(inactive, "westfield")
      .some((item) => item.role === "teacher"),
    false,
  );
  assert.equal(
    auth.accountsFor(academicSeed, "platform")[0].role,
    "super-admin",
  );
});

test("parent OTP and password reset use expiring, hashed one-time codes", () => {
  const accounts = auth.accountsFor(academicSeed, "westfield");
  const now = at("2026-11-23T10:00:00Z");
  let state = auth.requestCode(
    auth.authSeed,
    accounts,
    "otp",
    "98200 11001",
    now,
    "123456",
  );
  assert.equal(state.outbox[0].channel, "SMS");
  assert.match(state.outbox[0].text, /123456/);
  assert.ok(
    !JSON.stringify(state.codes).includes("123456"),
    "codes are stored hashed",
  );
  assert.equal(
    auth.requestCode(
      state,
      accounts,
      "otp",
      "98200 11001",
      at("2026-11-23T10:00:10Z"),
      "999999",
    ),
    state,
  );
  assert.equal(
    auth.requestCode(
      auth.authSeed,
      accounts,
      "otp",
      "90000 00000",
      now,
      "111111",
    ),
    auth.authSeed,
  );
  let result = auth.verifyOtp(
    state,
    accounts,
    "+91 98200 11001",
    "000000",
    now,
  );
  assert.equal(result.error, "That code is incorrect.");
  result = auth.verifyOtp(
    result.auth,
    accounts,
    "+919820011001",
    "123456",
    now,
  );
  assert.equal(result.auth.session.role, "parent");
  assert.equal(result.auth.session.method, "otp");
  state = auth.requestCode(
    auth.authSeed,
    accounts,
    "otp",
    "9820011001",
    now,
    "222222",
  );
  assert.match(
    auth.verifyOtp(
      state,
      accounts,
      "9820011001",
      "222222",
      at("2026-11-23T10:11:00Z"),
    ).error,
    /expired/,
  );

  const email = "westfield.family@example.test";
  state = auth.requestCode(
    auth.authSeed,
    accounts,
    "reset",
    email,
    now,
    "654321",
  );
  assert.match(
    auth.resetPassword(state, accounts, email, "654321", "short1", now).error,
    /8 characters/,
  );
  assert.match(
    auth.resetPassword(state, accounts, email, "654321", "onlyletters", now)
      .error,
    /letters and numbers/,
  );
  result = auth.resetPassword(
    state,
    accounts,
    email,
    "654321",
    "NewPass2027",
    now,
  );
  assert.equal(result.error, undefined);
  assert.equal(
    auth.signIn(result.auth, accounts, email, auth.demoPassword, now).error,
    auth.signInError,
  );
  assert.equal(
    auth.signIn(result.auth, accounts, email, "NewPass2027", now).auth.session
      .role,
    "parent",
  );
  assert.equal(
    auth.requestCode(auth.authSeed, accounts, "reset", "ST-1", now, "1"),
    auth.authSeed,
  );
});

test("sessions time out after inactivity", () => {
  const accounts = auth.accountsFor(academicSeed, "westfield");
  const { auth: state } = auth.signIn(
    auth.authSeed,
    accounts,
    "ST-1",
    auth.demoPassword,
    at("2026-11-23T10:00:00Z"),
  );
  assert.equal(
    auth.sessionExpired(state.session, at("2026-11-23T10:14:00Z")),
    false,
  );
  assert.equal(
    auth.sessionExpired(state.session, at("2026-11-23T10:15:00Z")),
    true,
  );
  const touched = auth.touchSession(state, at("2026-11-23T10:14:00Z"));
  assert.equal(
    auth.sessionExpired(touched.session, at("2026-11-23T10:20:00Z")),
    false,
  );
  assert.equal(auth.signOut(touched).session, null);
  assert.equal(auth.decodeAuthState("[]"), auth.authSeed);
});

test("CSV and XLSX parsing round-trip", async () => {
  const { parseCsv, toCsv, buildXlsx, parseXlsx } = importer;
  const rows = [
    ["Name", "Note"],
    ["Asha, Rao", 'She said "hi"'],
    ["Line\nbreak", "₹ 1,500 & <ok>"],
  ];
  assert.deepEqual(parseCsv("﻿" + toCsv(rows) + "\r\n"), rows);
  assert.deepEqual(parseCsv("a,b\r\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.deepEqual(await parseXlsx(buildXlsx(rows)), rows);
  await assert.rejects(
    () => parseXlsx(new Uint8Array([1, 2, 3])),
    /valid Excel/,
  );
});

test("bulk import validates each row and applies only valid ones", () => {
  const { planImport } = importer;
  let n = 0;
  const id = () => "import-" + ++n;
  const table = [
    [
      "Student name",
      "Student number",
      "Class",
      "Section",
      "Guardian name",
      "Guardian email",
      "Relationship",
    ],
    [
      "Meera Iyer",
      "ST-101",
      "Grade 8",
      "a",
      "Lakshmi Iyer",
      "lakshmi@example.test",
      "parent",
    ],
    ["Duplicate Code", "ST-1", "Grade 8", "A", "", "", ""],
    ["No Section", "ST-102", "Grade 12", "Z", "", "", ""],
    ["Bad Guardian", "ST-103", "Grade 8", "A", "Pat Doe", "not-an-email", ""],
    ["", "", "", "", "", "", ""],
    [
      "Existing Family",
      "ST-104",
      "Grade 7",
      "B",
      "",
      "westfield.family@example.test",
      "Guardian",
    ],
  ];
  const plan = planImport(academicSeed, "westfield", "students", table, id);
  assert.deepEqual(
    plan.rows.map((row) => row.ok),
    [true, false, false, false, true],
  );
  assert.match(plan.rows[1].message, /already in use/);
  assert.match(plan.rows[2].message, /No active section Grade 12/);
  assert.match(plan.rows[3].message, /valid fictional email/);
  assert.match(plan.rows[4].message, /existing guardian/);
  assert.equal(plan.rows[4].line, 7);
  const school = plan.next.schools.westfield;
  assert.equal(
    school.students.length,
    academicSeed.schools.westfield.students.length + 2,
  );
  assert.ok(
    !school.students.some((item) => item.code === "ST-103"),
    "failed rows leave nothing behind",
  );
  assert.equal(
    school.guardians.filter((item) => item.email === "lakshmi@example.test")
      .length,
    1,
  );
  assert.equal(plan.next.schools.cedar, academicSeed.schools.cedar);
  assert.throws(
    () => planImport(academicSeed, "westfield", "students", [["Name"]], id),
    /Missing columns/,
  );
  assert.throws(
    () =>
      planImport(
        academicSeed,
        "westfield",
        "teachers",
        [["Name", "Email"]],
        id,
      ),
    /no rows/,
  );
  const teachers = planImport(
    academicSeed,
    "westfield",
    "teachers",
    [
      ["email", "NAME"],
      ["new.teacher@example.test", "New Teacher"],
      ["westfield.teacher@example.test", "Duplicate"],
    ],
    id,
  );
  assert.deepEqual(
    teachers.rows.map((row) => row.ok),
    [true, false],
  );
  const parents = planImport(
    academicSeed,
    "westfield",
    "parents",
    [
      [
        "Guardian name",
        "Guardian email",
        "Student number",
        "Relationship",
        "Primary contact",
      ],
      ["Ravi Chen", "ravi@example.test", "ST-1", "Grandparent", "No"],
      ["Ravi Chen", "ravi@example.test", "ST-1", "Grandparent", "No"],
      ["Nobody", "x@example.test", "ST-999", "", ""],
      ["Maybe", "m@example.test", "ST-2", "", "Perhaps"],
    ],
    id,
  );
  assert.deepEqual(
    parents.rows.map((row) => row.ok),
    [true, false, false, false],
  );
  assert.match(parents.rows[1].message, /already linked/);
});

test("consent requests, responses, withdrawal and data requests", () => {
  const school = academicSeed.schools.westfield;
  let n = 0;
  const id = () => "privacy-" + ++n;
  const seed = privacy.privacySeed;
  assert.throws(
    () =>
      privacy.requestConsents(
        seed,
        school,
        admin,
        ["westfield-student-0", "westfield-student-1"],
        "2026-11-23",
        id,
      ),
    /already has a pending or granted/,
  );
  const overview = privacy.consentOverview(seed.schools.westfield, school);
  // The Class 10 demo student has no consent request yet.
  assert.deepEqual(
    overview.map((row) => row.status),
    ["Granted", "Pending", "Not requested"],
  );
  assert.throws(
    () =>
      privacy.respondConsent(
        seed,
        school,
        parent,
        "westfield-consent-1",
        { media: true },
        true,
        "2026-11-23",
        "Jordan",
      ),
    /required/,
  );
  let state = privacy.respondConsent(
    seed,
    school,
    parent,
    "westfield-consent-1",
    { records: true, media: true },
    true,
    "2026-11-23",
    "Jordan Chen",
  );
  let record = state.schools.westfield.consents[1];
  assert.equal(record.status, "Granted");
  assert.deepEqual(record.purposes, {
    records: true,
    communication: false,
    media: true,
    ai: false,
    sharing: false,
  });
  state = privacy.withdrawConsent(
    state,
    school,
    parent,
    record.id,
    "2026-11-24",
    "Jordan Chen",
  );
  record = state.schools.westfield.consents[1];
  assert.equal(record.status, "Withdrawn");
  assert.equal(record.history.length, 3);
  const again = privacy.requestConsents(
    state,
    school,
    admin,
    ["westfield-student-1"],
    "2026-11-25",
    id,
  );
  assert.equal(again.created.length, 1);
  const stranger = { ...parent, person: "someone-else" };
  assert.throws(
    () =>
      privacy.respondConsent(
        seed,
        school,
        stranger,
        "westfield-consent-1",
        { records: true },
        true,
        "2026-11-23",
        "x",
      ),
    /unavailable/,
  );
  state = privacy.requestData(seed, school, parent, "Export", "2026-11-23", id);
  assert.throws(
    () =>
      privacy.requestData(state, school, parent, "Export", "2026-11-23", id),
    /already have a pending/,
  );
  const request = state.schools.westfield.requests[0];
  assert.throws(
    () =>
      privacy.resolveRequest(
        state,
        admin,
        request.id,
        "Rejected",
        " ",
        "2026-11-24",
      ),
    /Explain/,
  );
  state = privacy.resolveRequest(
    state,
    admin,
    request.id,
    "Completed",
    "",
    "2026-11-24",
  );
  assert.equal(state.schools.westfield.requests[0].status, "Completed");
  assert.throws(
    () =>
      privacy.resolveRequest(
        state,
        admin,
        request.id,
        "Completed",
        "",
        "2026-11-24",
      ),
    /no longer pending/,
  );
});

test("exports contain only the requested student's data; deletion anonymises", () => {
  const school = academicSeed.schools.westfield;
  const data = privacy.buildExport(
    school,
    learningSeed.schools.westfield,
    feeSeed.schools.westfield,
    privacy.privacySeed.schools.westfield,
    "westfield-student-0",
    "2026-11-23T10:00:00Z",
  );
  assert.equal(data.student.name, "Avery Chen");
  assert.ok(data.attendance.length > 0);
  assert.ok(data.fees.length === 3 && data.fees.every((row) => row.payments));
  assert.ok(data.onlineTests.length === 1 && data.onlineTests[0].correct === 5);
  assert.ok(
    !JSON.stringify(data).includes("Robin Chen"),
    "no other student's data",
  );
  const erased = privacy.anonymizeStudent(
    academicSeed,
    "westfield",
    "westfield-student-0",
  );
  const row = erased.schools.westfield.students.find(
    (item) => item.id === "westfield-student-0",
  );
  assert.equal(row.name, "Erased student");
  assert.ok(
    !erased.schools.westfield.links.some((item) => item.student === row.id),
  );
  assert.ok(
    erased.schools.westfield.enrollments
      .filter((item) => item.student === row.id)
      .every((item) => item.status === "Withdrawn"),
  );
  assert.equal(erased.schools.harborview, academicSeed.schools.harborview);
});

test("audit diffs describe attendance, marks, fees and records changes", () => {
  const {
    diffAcademic,
    diffFees,
    diffLearning,
    appendEntries,
    auditSeed,
    auditCsvRows,
  } = audit;
  const school = academicSeed.schools.westfield;
  const marked = {
    ...academicSeed,
    schools: {
      ...academicSeed.schools,
      westfield: {
        ...school,
        attendance: school.attendance.map((row, index) =>
          index === 0
            ? {
                ...row,
                marks: { ...row.marks, "westfield-student-0": "Absent" },
              }
            : row,
        ),
      },
    },
  };
  const attendance = diffAcademic(academicSeed, marked);
  assert.equal(attendance.length, 1);
  assert.equal(attendance[0].area, "Attendance");
  assert.equal(attendance[0].action, "Edited attendance");
  assert.match(attendance[0].detail, /Avery Chen: Present → Absent/);
  const records = diffAcademic(
    academicSeed,
    saveAcademicRecord(academicSeed, admin, "subjects", {
      id: "s-new",
      name: "Art",
      code: "ART",
    }),
  );
  assert.deepEqual(
    records.map((row) => row.action),
    ["Added subject"],
  );
  const paid = recordPayment(
    feeSeed,
    admin,
    feeSeed.schools.westfield.invoices.find(
      (item) => item.fee === "westfield-fee-t2-1",
    ).id,
    { amount: 5000, method: "Cash", paidOn: "2026-11-23", reference: "" },
    "2026-11-23",
  );
  const fees = diffFees(feeSeed, paid, (id) => academicSeed.schools[id]);
  assert.equal(fees[0].action, "Recorded payment");
  assert.match(fees[0].detail, /₹5,000 · Cash .* Robin Chen/);
  const learning = {
    ...learningSeed,
    schools: {
      ...learningSeed.schools,
      westfield: {
        ...learningSeed.schools.westfield,
        marks: learningSeed.schools.westfield.marks.map((row, index) =>
          index === 0 ? { ...row, marks: 44 } : row,
        ),
      },
    },
  };
  const marks = diffLearning(
    learningSeed,
    learning,
    (id) => academicSeed.schools[id],
  );
  assert.equal(marks[0].action, "Changed exam marks");
  assert.match(
    marks[0].detail,
    /Unit Test 1 · Mathematics · Avery Chen: 41 → 44/,
  );
  let n = 0;
  const log = appendEntries(
    auditSeed,
    [...attendance, ...fees],
    { role: "teacher", name: "Maya Patel" },
    at("2026-11-23T10:00:00Z"),
    () => "a" + ++n,
  );
  assert.equal(log.entries.length, auditSeed.entries.length + 2);
  assert.equal(log.entries[0].action, "Recorded payment");
  assert.equal(log.entries[1].actorName, "Maya Patel");
  assert.equal(auditCsvRows(log.entries)[0][0], "Time (UTC)");
});

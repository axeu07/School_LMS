import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { codeIn, startApi } from "./helpers.mjs";

// Uses the demo accounts from `npm run db:seed`. These tests only sign in and
// out; they don't change passwords or trigger lockouts on demo accounts.
let api;
let seeded = false;

before(async () => {
  api = await startApi();
  seeded = Boolean(
    await api.db.school.findUnique({ where: { code: "WFA26" } }),
  );
});
after(async () => {
  await api?.app.close();
});

const password = "Demo@1234";

test("school branding is public by code", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const found = await api.call("/schools/by-code/wfa26");
  assert.equal(found.status, 200);
  assert.equal(found.json.name, "Westfield Academy");
  assert.equal(found.json.primary, "#4937b8");
  assert.equal((await api.call("/schools/by-code/NOPE1")).status, 404);
});

test("teacher signs in, refreshes, and signs out", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const login = await api.call("/auth/login", {
    method: "POST",
    body: {
      schoolCode: "WFA26",
      identifier: "Westfield.Teacher@example.test",
      password,
    },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.role, "teacher");
  assert.equal(login.json.user.name, "Maya Patel");
  assert.equal(login.json.school.code, "WFA26");
  assert.ok(login.json.permissions.includes("attendance.mark"));
  assert.ok(!login.json.permissions.includes("fees.manage"));
  assert.match(login.setCookie, /HttpOnly/i);
  assert.match(login.setCookie, /Path=\/api\/auth/);
  assert.match(login.setCookie, /SameSite=Lax/i);
  assert.equal(
    login.json.refreshToken,
    undefined,
    "refresh token stays in the cookie",
  );

  assert.equal((await api.call("/auth/me")).status, 401);
  const me = await api.call("/auth/me", { token: login.json.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, "westfield.teacher@example.test");

  const refreshed = await api.call("/auth/refresh", {
    method: "POST",
    cookie: login.cookie,
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.cookie && refreshed.cookie !== login.cookie);
  const reused = await api.call("/auth/refresh", {
    method: "POST",
    cookie: login.cookie,
  });
  assert.equal(reused.status, 401, "a refresh token works only once");

  const out = await api.call("/auth/logout", {
    method: "POST",
    cookie: refreshed.cookie,
  });
  assert.equal(out.status, 204);
  const afterOut = await api.call("/auth/me", {
    token: refreshed.json.accessToken,
  });
  assert.equal(afterOut.status, 401, "signing out ends the session at once");
});

test("students sign in with their student number in their own school", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const login = await api.call("/auth/login", {
    method: "POST",
    body: { schoolCode: "hbv26", identifier: "st-1", password },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.role, "student");
  assert.equal(login.json.user.name, "Kiran Menon");
  assert.equal(login.json.school.code, "HBV26");

  const secondChild = await api.call("/auth/login", {
    method: "POST",
    body: { schoolCode: "HBV26", identifier: "ST-2", password },
  });
  assert.equal(
    secondChild.status,
    401,
    "the demo lets only the first student sign in",
  );
});

test("accounts are scoped to their school", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const wrongSchool = await api.call("/auth/login", {
    method: "POST",
    body: {
      schoolCode: "HBV26",
      identifier: "westfield.teacher@example.test",
      password,
    },
  });
  assert.equal(wrongSchool.status, 401);
  assert.equal(
    wrongSchool.json.message,
    "The email, student number or password is incorrect.",
  );

  const notPlatform = await api.call("/auth/login", {
    method: "POST",
    body: { identifier: "westfield.admin@example.test", password },
  });
  assert.equal(
    notPlatform.status,
    401,
    "school staff can't use the platform sign-in",
  );
});

test("permissions guard the audit log and keep it to one school", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const admin = await api.call("/auth/login", {
    method: "POST",
    body: {
      schoolCode: "CGC26",
      identifier: "cedar.admin@example.test",
      password,
    },
  });
  assert.equal(admin.status, 200);
  assert.equal(admin.json.role, "school-admin");
  const events = await api.call("/audit-events?limit=20", {
    token: admin.json.accessToken,
  });
  assert.equal(events.status, 200);
  assert.ok(events.json.events.length > 0);
  assert.ok(
    events.json.events.every(
      (event) => event.schoolId === admin.json.school.id,
    ),
  );

  const teacher = await api.call("/auth/login", {
    method: "POST",
    body: {
      schoolCode: "CGC26",
      identifier: "cedar.teacher@example.test",
      password,
    },
  });
  const denied = await api.call("/audit-events", {
    token: teacher.json.accessToken,
  });
  assert.equal(denied.status, 403);

  const owner = await api.call("/auth/login", {
    method: "POST",
    body: { identifier: "platform.owner@example.test", password },
  });
  assert.equal(owner.status, 200);
  assert.equal(owner.json.role, "super-admin");
  assert.equal(owner.json.school, null);
  const all = await api.call("/audit-events", {
    token: owner.json.accessToken,
  });
  assert.equal(all.status, 200);
});

test("parents sign in with a one-time code sent to their phone", async (t) => {
  if (!seeded) return t.skip("run npm run db:seed first");
  const before = api.outbox.length;
  const unknown = await api.call("/auth/otp/request", {
    method: "POST",
    body: { schoolCode: "WFA26", phone: "+91 90000 00000" },
  });
  assert.equal(
    unknown.status,
    202,
    "same answer whether or not the number exists",
  );
  assert.equal(api.outbox.length, before);

  const sent = await api.call("/auth/otp/request", {
    method: "POST",
    body: { schoolCode: "WFA26", phone: "98200 11001" },
  });
  assert.equal(sent.status, 202);
  assert.equal(sent.json.message, unknown.json.message);
  const sms = api.outbox.at(-1);
  assert.equal(sms?.channel, "sms");
  assert.equal(sms.to, "+919820011001");
  const code = codeIn(sms.text);
  assert.ok(code);

  const wrong = await api.call("/auth/otp/verify", {
    method: "POST",
    body: {
      schoolCode: "WFA26",
      phone: "+91 98200 11001",
      code: code === "000000" ? "111111" : "000000",
    },
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.json.message, "That code is incorrect.");

  const ok = await api.call("/auth/otp/verify", {
    method: "POST",
    body: { schoolCode: "WFA26", phone: "+91 98200 11001", code },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.role, "parent");
  assert.equal(ok.json.user.name, "Jordan Chen");

  const again = await api.call("/auth/otp/verify", {
    method: "POST",
    body: { schoolCode: "WFA26", phone: "+91 98200 11001", code },
  });
  assert.equal(again.status, 400, "a code works only once");
});

test("bad input is rejected before it reaches the service", async () => {
  const response = await api.call("/auth/login", {
    method: "POST",
    body: {
      schoolCode: "WFA26",
      identifier: "x",
      password: "y",
      isAdmin: true,
    },
  });
  assert.equal(response.status, 400);
});

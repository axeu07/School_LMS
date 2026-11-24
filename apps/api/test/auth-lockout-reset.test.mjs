import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { codeIn, startApi } from "./helpers.mjs";

// Creates a throwaway school and teacher so lockouts and password changes
// never touch the demo accounts. Everything is deleted afterwards.
const require = createRequire(import.meta.url);
const { hashPassword } = require("../dist/modules/auth/password.js");

let api;
const suffix = randomBytes(3).toString("hex").toUpperCase();
const schoolCode = "TST" + suffix;
const email = "lockout-" + suffix.toLowerCase() + "@example.test";
let ids = {};

before(async () => {
  api = await startApi();
  const { db } = api;
  const school = await db.school.create({
    data: {
      slug: "test-" + suffix.toLowerCase(),
      code: schoolCode,
      name: "Test School " + suffix,
    },
  });
  const role = await db.role.create({
    data: { schoolId: school.id, code: "teacher", name: "Teacher" },
  });
  const user = await db.user.create({
    data: {
      email,
      displayName: "Test Teacher",
      passwordHash: await hashPassword("Start1234"),
    },
  });
  const membership = await db.schoolMembership.create({
    data: { schoolId: school.id, userId: user.id },
  });
  await db.membershipRole.create({
    data: { schoolId: school.id, membershipId: membership.id, roleId: role.id },
  });
  ids = { school: school.id, user: user.id };
});

after(async () => {
  if (api && ids.school) {
    const { db } = api;
    await db.schoolMembership.deleteMany({ where: { schoolId: ids.school } });
    await db.role.deleteMany({ where: { schoolId: ids.school } });
    await db.authSession.deleteMany({ where: { userId: ids.user } });
    await db.school.delete({ where: { id: ids.school } });
    await db.user.delete({ where: { id: ids.user } });
  }
  await api?.app.close();
});

const login = (password) =>
  api.call("/auth/login", {
    method: "POST",
    body: { schoolCode, identifier: email, password },
  });

test("an idle session is signed out after 15 minutes", async () => {
  const signedIn = await login("Start1234");
  assert.equal(signedIn.status, 200);
  const sixteenMinutesAgo = new Date(Date.now() - 16 * 60_000);
  await api.db.authSession.update({
    where: { id: signedIn.json.session.id },
    data: { lastUsedAt: sixteenMinutesAgo },
  });
  const me = await api.call("/auth/me", { token: signedIn.json.accessToken });
  assert.equal(me.status, 401);
  assert.equal(
    me.json.message,
    "You were signed out after a period of inactivity.",
  );
  const refresh = await api.call("/auth/refresh", {
    method: "POST",
    cookie: signedIn.cookie,
  });
  assert.equal(refresh.status, 401);
});

test("five wrong passwords lock the account, and a reset unlocks it", async () => {
  for (let i = 1; i <= 4; i++)
    assert.equal((await login("Wrong" + i + "pass")).status, 401);
  const fifth = await login("Wrong5pass");
  assert.equal(fifth.status, 429);
  assert.equal(
    fifth.json.message,
    "Too many failed attempts. Try again in 5 minutes.",
  );
  const rightButLocked = await login("Start1234");
  assert.equal(
    rightButLocked.status,
    429,
    "even the right password waits out the lock",
  );

  const forgot = await api.call("/auth/password/forgot", {
    method: "POST",
    body: { schoolCode, identifier: email },
  });
  assert.equal(forgot.status, 202);
  const mail = api.outbox.findLast(
    (item) => item.channel === "email" && item.to === email,
  );
  const code = codeIn(mail?.text ?? "");
  assert.ok(code, "a reset code was emailed");

  const weak = await api.call("/auth/password/reset", {
    method: "POST",
    body: { schoolCode, identifier: email, code, newPassword: "short" },
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.json.message, "Use at least 8 characters.");

  const reset = await api.call("/auth/password/reset", {
    method: "POST",
    body: { schoolCode, identifier: email, code, newPassword: "Fresh2026pw" },
  });
  assert.equal(reset.status, 204);
  assert.ok(
    api.outbox.some(
      (item) => item.to === email && /password was changed/.test(item.text),
    ),
  );

  assert.equal(
    (await login("Start1234")).status,
    401,
    "the old password no longer works",
  );
  const fresh = await login("Fresh2026pw");
  assert.equal(fresh.status, 200, "the reset cleared the lock");

  const changed = await api.call("/auth/password/change", {
    method: "POST",
    token: fresh.json.accessToken,
    body: { currentPassword: "Fresh2026pw", newPassword: "Another2026pw" },
  });
  assert.equal(changed.status, 204);
  const stillIn = await api.call("/auth/me", { token: fresh.json.accessToken });
  assert.equal(
    stillIn.status,
    200,
    "changing a password keeps the current device signed in",
  );

  const actions = (
    await api.db.auditEvent.findMany({
      where: { userId: ids.user },
      select: { action: true },
    })
  ).map((event) => event.action);
  for (const action of [
    "auth.sign_in_failed",
    "auth.account_locked",
    "auth.password_reset_requested",
    "auth.password_reset",
    "auth.signed_in",
    "auth.password_changed",
  ])
    assert.ok(actions.includes(action), action + " was audited");
});

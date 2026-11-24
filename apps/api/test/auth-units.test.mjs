import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// Runs against the compiled output: `npm test` builds first.
const require = createRequire(import.meta.url);
const password = require("../dist/modules/auth/password.js");
const lockout = require("../dist/modules/auth/lockout.js");
const phone = require("../dist/modules/auth/phone.js");
const tokens = require("../dist/modules/auth/tokens.js");
const permissions = require("../dist/modules/auth/permissions.js");
const { authPolicy } = require("../dist/modules/auth/auth.policy.js");

test("password hashes verify, are salted and reject wrong passwords", async () => {
  const first = await password.hashPassword("Demo@1234");
  const second = await password.hashPassword("Demo@1234");
  assert.match(first, /^scrypt\$16\$8\$2\$/);
  assert.notEqual(first, second);
  assert.equal(await password.verifyPassword("Demo@1234", first), true);
  assert.equal(await password.verifyPassword("demo@1234", first), false);
  assert.equal(await password.verifyPassword("Demo@1234", "not-a-hash"), false);
  assert.equal(
    await password.verifyPassword("Demo@1234", "scrypt$40$8$2$AA$AA"),
    false,
    "absurd cost parameters are refused, not computed",
  );
  assert.equal(await password.verifyAgainstDummy("anything"), false);
});

test("password rules match the demo reset form", () => {
  const problem = password.passwordProblem;
  assert.equal(
    problem("short1", "x@example.test"),
    "Use at least 8 characters.",
  );
  assert.equal(
    problem("longpassword", "x@example.test"),
    "Use both letters and numbers.",
  );
  assert.equal(
    problem("maya.teacher99", "maya.teacher@example.test"),
    "Don't include your email name in the password.",
  );
  assert.equal(
    problem("a1".repeat(65), "x@example.test"),
    "Use at most 128 characters.",
  );
  assert.equal(problem("NewPass2026", "maya.teacher@example.test"), undefined);
});

test("five wrong passwords lock the account for five minutes", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  let state = lockout.unlocked;
  for (let i = 1; i < authPolicy.lockAfterFailures; i++) {
    state = lockout.afterFailedAttempt(state, now);
    assert.equal(state.lockedUntil, null);
    assert.equal(lockout.minutesLocked(state, now), 0);
  }
  state = lockout.afterFailedAttempt(state, now);
  assert.equal(state.failedLoginCount, 5);
  assert.equal(lockout.minutesLocked(state, now), 5);
  const later = new Date(now.getTime() + 4.5 * 60_000);
  assert.equal(lockout.minutesLocked(state, later), 1);

  // Once the lock expires, the next mistake starts counting again from one.
  const afterLock = new Date(now.getTime() + 6 * 60_000);
  assert.equal(lockout.minutesLocked(state, afterLock), 0);
  const fresh = lockout.afterFailedAttempt(state, afterLock);
  assert.deepEqual(fresh, { failedLoginCount: 1, lockedUntil: null });
});

test("phone numbers normalise to E.164 with India as the default", () => {
  assert.equal(phone.normalizePhone("+91 98200 11001"), "+919820011001");
  assert.equal(phone.normalizePhone("98200 11001"), "+919820011001");
  assert.equal(phone.normalizePhone("098200-11001"), "+919820011001");
  assert.equal(phone.normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(phone.normalizePhone("12345"), null);
});

test("one-time codes are six digits and their digests are keyed", () => {
  for (let i = 0; i < 50; i++) assert.match(tokens.newCode(), /^\d{6}$/);
  const a = tokens.codeDigest("secret-one", "user", "SIGN_IN_OTP", "123456");
  assert.equal(
    a,
    tokens.codeDigest("secret-one", "user", "SIGN_IN_OTP", "123456"),
  );
  assert.notEqual(
    a,
    tokens.codeDigest("secret-two", "user", "SIGN_IN_OTP", "123456"),
  );
  assert.notEqual(
    a,
    tokens.codeDigest("secret-one", "other", "SIGN_IN_OTP", "123456"),
  );
  assert.notEqual(
    a,
    tokens.codeDigest("secret-one", "user", "PASSWORD_RESET", "123456"),
  );
  assert.equal(tokens.sameHex(a, a), true);
  assert.equal(tokens.sameHex(a, a.slice(0, 10)), false);
  assert.match(tokens.sha256Hex("x"), /^[0-9a-f]{64}$/);
  assert.notEqual(tokens.newRefreshToken(), tokens.newRefreshToken());
});

test("role permissions keep each role to its own side", () => {
  const { rolePermissions, permissionCatalog, primaryRole } = permissions;
  for (const codes of Object.values(rolePermissions))
    for (const code of codes) assert.ok(code in permissionCatalog, code);
  const admin = rolePermissions["school-admin"];
  assert.ok(admin.includes("audit.read") && admin.includes("fees.manage"));
  assert.ok(
    !admin.includes("assignments.submit") && !admin.includes("fees.pay"),
  );
  assert.ok(!rolePermissions.teacher.includes("fees.manage"));
  assert.ok(!rolePermissions.teacher.includes("audit.read"));
  assert.ok(!rolePermissions.student.includes("people.read"));
  assert.ok(rolePermissions.parent.includes("fees.pay"));
  assert.equal(primaryRole(["parent", "teacher"]), "teacher");
  assert.equal(primaryRole(["unknown"]), undefined);
});

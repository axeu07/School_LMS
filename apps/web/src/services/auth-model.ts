import { academicRecords, platformUser } from "@/mocks/academics";
import type { DemoRole, SchoolId } from "@/types/demo";
import type { AcademicState } from "./academic-model";
import { sha256 } from "./hash";

/**
 * Demo sign-in. It behaves like real authentication (hashed passwords,
 * lockouts, expiring one-time codes, idle timeout) but runs in the browser,
 * so it is not a security boundary. Real authentication belongs on the API.
 */

export const demoPassword = "Demo@1234";
export const sessionTimeoutMinutes = 15;
export const lockAfterFailures = 5;
export const lockMinutes = 5;
export const codeMinutes = 10;
export const codeAttempts = 5;
export const resendSeconds = 30;

export type AccountScope = SchoolId | "platform";
export type Account = {
  key: string;
  school: AccountScope;
  role: DemoRole;
  person: string;
  name: string;
  email: string;
  studentNumber: string;
  phone: string;
};
export type SignInMethod = "password" | "otp";
export type Session = {
  account: string;
  school: AccountScope;
  role: DemoRole;
  person: string;
  name: string;
  method: SignInMethod;
  signedInAt: string;
  lastActive: string;
};
type CodeEntry = {
  hash: string;
  purpose: "otp" | "reset";
  sent: string;
  expires: string;
  tries: number;
};
export type OutboxMessage = {
  id: string;
  school: AccountScope;
  channel: "SMS" | "Email";
  to: string;
  text: string;
  at: string;
};
export type AuthState = {
  version: 1;
  /** Password hashes for accounts that changed the demo password. */
  passwords: Record<string, string>;
  attempts: Record<string, { count: number; lockedUntil: string }>;
  codes: Record<string, CodeEntry>;
  /** Messages that would be sent by SMS or email (shown as a demo inbox). */
  outbox: OutboxMessage[];
  session: Session | null;
};

export const authSeed: AuthState = {
  version: 1,
  passwords: {},
  attempts: {},
  codes: {},
  outbox: [],
  session: null,
};

export function decodeAuthState(raw: string | null): AuthState {
  if (!raw) return authSeed;
  try {
    const data = JSON.parse(raw) as AuthState;
    const objects = [data?.passwords, data?.attempts, data?.codes];
    if (
      data?.version !== 1 ||
      objects.some((item) => !item || typeof item !== "object") ||
      !Array.isArray(data.outbox) ||
      (data.session !== null &&
        (typeof data.session !== "object" ||
          typeof data.session.account !== "string" ||
          typeof data.session.lastActive !== "string"))
    )
      return authSeed;
    return data;
  } catch {
    return authSeed;
  }
}

/** Seeded mobile numbers for the demo parent in each school. */
export const parentPhones: Record<SchoolId, string> = {
  westfield: "+91 98200 11001",
  harborview: "+91 98470 22002",
  cedar: "+91 98450 33003",
};

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

/**
 * Accounts that can sign in. Derived from the live school records, so a
 * deactivated teacher or an edited email takes effect immediately.
 */
export function accountsFor(
  academic: AcademicState,
  scope: AccountScope,
): Account[] {
  if (scope === "platform")
    return [
      {
        key: "platform:super-admin",
        school: "platform",
        role: "super-admin",
        person: platformUser.id,
        name: platformUser.name,
        email: "platform.owner@example.test",
        studentNumber: "",
        phone: "",
      },
    ];
  const source = academicRecords.find((item) => item.schoolId === scope);
  const school = academic.schools[scope];
  if (!source || !school) return [];
  const accounts: Account[] = [
    {
      key: scope + ":school-admin",
      school: scope,
      role: "school-admin",
      person: source.admin.id,
      name: source.admin.name,
      email: scope + ".admin@example.test",
      studentNumber: "",
      phone: "",
    },
  ];
  const teacher = school.teachers.find((item) => item.id === source.teacher.id);
  if (teacher?.status === "Active")
    accounts.push({
      key: scope + ":teacher",
      school: scope,
      role: "teacher",
      person: teacher.id,
      name: teacher.name,
      email: teacher.email,
      studentNumber: "",
      phone: "",
    });
  const parent = school.guardians.find((item) => item.id === source.parent.id);
  if (parent)
    accounts.push({
      key: scope + ":parent",
      school: scope,
      role: "parent",
      person: parent.id,
      name: parent.name,
      email: parent.email,
      studentNumber: "",
      phone: parentPhones[scope],
    });
  const student = school.students.find(
    (item) => item.id === source.learners[0].id,
  );
  if (student)
    accounts.push({
      key: scope + ":student",
      school: scope,
      role: "student",
      person: student.id,
      name: student.name,
      email: "",
      studentNumber: student.code,
      phone: "",
    });
  return accounts;
}

export function findAccount(accounts: Account[], identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (!value) return undefined;
  return accounts.find(
    (item) =>
      (item.email && item.email.toLowerCase() === value) ||
      (item.studentNumber && item.studentNumber.toLowerCase() === value),
  );
}

export function findByPhone(accounts: Account[], phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length !== 10) return undefined;
  return accounts.find(
    (item) => item.phone && phoneDigits(item.phone) === digits,
  );
}

const passwordHash = (key: string, password: string) =>
  sha256("password:" + key + ":" + password);
const codeHash = (key: string, code: string) =>
  sha256("code:" + key + ":" + code);
const iso = (date: Date) => date.toISOString();
const minutesLater = (date: Date, minutes: number) =>
  iso(new Date(date.getTime() + minutes * 60_000));

function startSession(
  auth: AuthState,
  account: Account,
  method: SignInMethod,
  now: Date,
): AuthState {
  const attempts = { ...auth.attempts };
  delete attempts[account.key];
  return {
    ...auth,
    attempts,
    session: {
      account: account.key,
      school: account.school,
      role: account.role,
      person: account.person,
      name: account.name,
      method,
      signedInAt: iso(now),
      lastActive: iso(now),
    },
  };
}

function lockMessage(auth: AuthState, key: string, now: Date) {
  const lock = auth.attempts[key];
  if (!lock?.lockedUntil || lock.lockedUntil <= iso(now)) return undefined;
  const minutes = Math.ceil(
    (new Date(lock.lockedUntil).getTime() - now.getTime()) / 60_000,
  );
  return (
    "Too many failed attempts. Try again in " +
    minutes +
    (minutes === 1 ? " minute." : " minutes.")
  );
}

export type AuthResult = { auth: AuthState; error?: string };

export const signInError =
  "The email, student number or password is incorrect.";

export function signIn(
  auth: AuthState,
  accounts: Account[],
  identifier: string,
  password: string,
  now: Date,
): AuthResult {
  const account = findAccount(accounts, identifier);
  if (!account) return { auth, error: signInError };
  const locked = lockMessage(auth, account.key, now);
  if (locked) return { auth, error: locked };
  const expected =
    auth.passwords[account.key] ?? passwordHash(account.key, demoPassword);
  if (expected === passwordHash(account.key, password))
    return { auth: startSession(auth, account, "password", now) };
  const previous = auth.attempts[account.key];
  const count =
    previous && previous.lockedUntil && previous.lockedUntil <= iso(now)
      ? 1
      : (previous?.count ?? 0) + 1;
  const lockedNow = count >= lockAfterFailures;
  const next: AuthState = {
    ...auth,
    attempts: {
      ...auth.attempts,
      [account.key]: {
        count,
        lockedUntil: lockedNow ? minutesLater(now, lockMinutes) : "",
      },
    },
  };
  return {
    auth: next,
    error: lockedNow ? lockMessage(next, account.key, now) : signInError,
  };
}

/**
 * Sends a one-time code: an OTP to a parent's phone, or a reset code to an
 * email. Always reports success so the page never reveals who has an account.
 */
export function requestCode(
  auth: AuthState,
  accounts: Account[],
  purpose: "otp" | "reset",
  identifier: string,
  now: Date,
  code: string,
): AuthState {
  const account =
    purpose === "otp"
      ? findByPhone(accounts, identifier)
      : findAccount(accounts, identifier);
  if (!account || (purpose === "otp" && account.role !== "parent")) return auth;
  if (purpose === "reset" && !account.email) return auth;
  const existing = auth.codes[account.key];
  if (
    existing &&
    existing.purpose === purpose &&
    now.getTime() - new Date(existing.sent).getTime() < resendSeconds * 1000
  )
    return auth;
  const message: OutboxMessage = {
    id: account.key + ":" + iso(now),
    school: account.school,
    channel: purpose === "otp" ? "SMS" : "Email",
    to: purpose === "otp" ? account.phone : account.email,
    text:
      purpose === "otp"
        ? code +
          " is your ACADMAXIS sign-in code. It expires in " +
          codeMinutes +
          " minutes. Don't share it with anyone."
        : "Use code " +
          code +
          " to reset your ACADMAXIS password. It expires in " +
          codeMinutes +
          " minutes.",
    at: iso(now),
  };
  return {
    ...auth,
    codes: {
      ...auth.codes,
      [account.key]: {
        hash: codeHash(account.key, code),
        purpose,
        sent: iso(now),
        expires: minutesLater(now, codeMinutes),
        tries: 0,
      },
    },
    outbox: [message, ...auth.outbox].slice(0, 30),
  };
}

function checkCode(
  auth: AuthState,
  account: Account | undefined,
  purpose: "otp" | "reset",
  code: string,
  now: Date,
): AuthResult & { ok?: boolean } {
  const entry = account && auth.codes[account.key];
  if (!account || !entry || entry.purpose !== purpose)
    return { auth, error: "That code is incorrect or has expired." };
  if (entry.expires <= iso(now))
    return { auth, error: "This code has expired. Request a new one." };
  if (entry.tries >= codeAttempts)
    return { auth, error: "Too many incorrect codes. Request a new one." };
  if (entry.hash !== codeHash(account.key, code.trim())) {
    const tries = entry.tries + 1;
    return {
      auth: {
        ...auth,
        codes: { ...auth.codes, [account.key]: { ...entry, tries } },
      },
      error:
        tries >= codeAttempts
          ? "Too many incorrect codes. Request a new one."
          : "That code is incorrect.",
    };
  }
  const codes = { ...auth.codes };
  delete codes[account.key];
  return { auth: { ...auth, codes }, ok: true };
}

export function verifyOtp(
  auth: AuthState,
  accounts: Account[],
  phone: string,
  code: string,
  now: Date,
): AuthResult {
  const account = findByPhone(accounts, phone);
  const result = checkCode(auth, account, "otp", code, now);
  if (!result.ok) return { auth: result.auth, error: result.error };
  return { auth: startSession(result.auth, account!, "otp", now) };
}

export function passwordProblem(password: string, identifier: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use both letters and numbers.";
  if (
    password
      .toLowerCase()
      .includes(identifier.trim().toLowerCase().split("@")[0])
  )
    return "Don't include your email name in the password.";
  return undefined;
}

export function resetPassword(
  auth: AuthState,
  accounts: Account[],
  identifier: string,
  code: string,
  password: string,
  now: Date,
): AuthResult {
  const account = findAccount(accounts, identifier);
  const problem = passwordProblem(password, identifier);
  if (problem) return { auth, error: problem };
  const result = checkCode(auth, account, "reset", code, now);
  if (!result.ok) return { auth: result.auth, error: result.error };
  const attempts = { ...result.auth.attempts };
  delete attempts[account!.key];
  return {
    auth: {
      ...result.auth,
      attempts,
      passwords: {
        ...result.auth.passwords,
        [account!.key]: passwordHash(account!.key, password),
      },
      outbox: [
        {
          id: account!.key + ":changed:" + iso(now),
          school: account!.school,
          channel: "Email" as const,
          to: account!.email,
          text: "Your ACADMAXIS password was changed. If this wasn't you, contact your school office.",
          at: iso(now),
        },
        ...result.auth.outbox,
      ].slice(0, 30),
    },
  };
}

export function sessionExpired(session: Session, now: Date) {
  return (
    now.getTime() - new Date(session.lastActive).getTime() >=
    sessionTimeoutMinutes * 60_000
  );
}

export function touchSession(auth: AuthState, now: Date): AuthState {
  if (!auth.session) return auth;
  return { ...auth, session: { ...auth.session, lastActive: iso(now) } };
}

export function signOut(auth: AuthState): AuthState {
  return auth.session ? { ...auth, session: null } : auth;
}

/** Six random digits from a secure source. */
export function newCode(random: (size: number) => Uint32Array) {
  return String(random(1)[0] % 1_000_000).padStart(6, "0");
}

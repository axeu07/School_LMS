import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Password hashing with scrypt (OWASP: N=2^16, r=8, p=2). The parameters are
 * stored with each hash so they can be raised later without breaking logins.
 * Format: scrypt$<log2 N>$<r>$<p>$<salt base64url>$<hash base64url>
 */
const defaults = { log2N: 16, r: 8, p: 2, keyLength: 64, saltLength: 16 };
export const maxPasswordLength = 128;

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

const options = (log2N: number, r: number, p: number): ScryptOptions => ({
  N: 2 ** log2N,
  r,
  p,
  maxmem: 2 * 128 * 2 ** log2N * r,
});

export async function hashPassword(password: string): Promise<string> {
  const { log2N, r, p, keyLength, saltLength } = defaults;
  const salt = randomBytes(saltLength);
  const key = await scrypt(password, salt, keyLength, options(log2N, r, p));
  return [
    "scrypt",
    log2N,
    r,
    p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [log2N, r, p] = parts.slice(1, 4).map(Number);
  if (
    ![log2N, r, p].every(Number.isInteger) ||
    log2N < 14 ||
    log2N > 20 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 16
  )
    return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (!expected.length || password.length > maxPasswordLength) return false;
  const actual = await scrypt(
    password,
    salt,
    expected.length,
    options(log2N, r, p),
  );
  return timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;

/**
 * Spend the same time as a real check when no account matched, so response
 * times don't reveal which emails or student numbers exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password.slice(0, maxPasswordLength), await dummy);
  return false;
}

/** Same rules as the demo reset form, plus an upper length limit. */
export function passwordProblem(
  password: string,
  identifier: string,
): string | undefined {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > maxPasswordLength)
    return "Use at most " + maxPasswordLength + " characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use both letters and numbers.";
  const name = identifier.trim().toLowerCase().split("@")[0];
  if (name.length >= 3 && password.toLowerCase().includes(name))
    return "Don't include your email name in the password.";
  return undefined;
}

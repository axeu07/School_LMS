import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

/** An opaque refresh token; only its SHA-256 hash is stored. */
export const newRefreshToken = () => randomBytes(32).toString("base64url");

export const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Six digits from a secure source. */
export const newCode = () =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

/**
 * Keyed digest of a one-time code, so a database leak alone can't be used to
 * recover live codes by trying all million values.
 */
export function codeDigest(
  secret: string,
  userId: string,
  purpose: string,
  code: string,
) {
  return createHmac("sha256", secret)
    .update("code:" + purpose + ":" + userId + ":" + code)
    .digest("hex");
}

export function sameHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

import { registerAs } from "@nestjs/config";

export interface AuthConfiguration {
  /** Signs access tokens and one-time-code digests. */
  secret: string;
  /** Send the refresh cookie only over HTTPS. */
  secureCookies: boolean;
}

export const authConfig = registerAs("auth", (): AuthConfiguration => {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be at least 32 characters. Set it in apps/api/.env.local.",
    );
  }
  const secure = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  return {
    secret,
    secureCookies:
      secure === undefined || secure === ""
        ? process.env.NODE_ENV === "production"
        : secure === "true",
  };
});

import { registerAs } from "@nestjs/config";

export interface MailConfiguration {
  /** Blank until SMTP credentials are supplied; email is then logged in development. */
  host: string;
  port: number;
  /** true for implicit TLS (usually port 465); false uses STARTTLS when offered. */
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export const mailConfig = registerAs("mail", (): MailConfiguration => ({
  host: process.env.SMTP_HOST?.trim() ?? "",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE?.trim().toLowerCase() === "true",
  user: process.env.SMTP_USER?.trim() ?? "",
  password: process.env.SMTP_PASSWORD ?? "",
  from: process.env.MAIL_FROM?.trim() || "ACADMAXIS <no-reply@localhost>",
}));

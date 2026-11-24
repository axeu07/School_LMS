import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { MailConfiguration } from "../../config/mail.config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export interface OutgoingSms {
  to: string;
  text: string;
}

/**
 * Sends email over SMTP and SMS through a provider. Until credentials are set,
 * development builds print messages to the API console (the equivalent of
 * the demo inbox); production builds refuse and log an error instead.
 *
 * Sending never throws: callers such as "forgot password" must answer the
 * same way whether or not a message went out.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger("Delivery");
  private readonly mail: MailConfiguration;
  private readonly transport?: Transporter;
  private readonly isProduction = process.env.NODE_ENV === "production";

  constructor(config: ConfigService) {
    this.mail = config.getOrThrow<MailConfiguration>("mail");
    if (this.mail.host) {
      this.transport = createTransport({
        host: this.mail.host,
        port: this.mail.port,
        secure: this.mail.secure,
        requireTLS: !this.mail.secure,
        auth: this.mail.user
          ? { user: this.mail.user, pass: this.mail.password }
          : undefined,
      });
    }
  }

  get emailConfigured() {
    return Boolean(this.transport);
  }

  /** Sends in the background so response times don't depend on SMTP. */
  queueEmail(message: OutgoingEmail): void {
    void this.sendEmail(message);
  }

  queueSms(message: OutgoingSms): void {
    void this.sendSms(message);
  }

  async sendEmail(message: OutgoingEmail): Promise<boolean> {
    if (!this.transport) {
      if (this.isProduction) {
        this.logger.error("Email not sent: SMTP is not configured.");
        return false;
      }
      this.logger.warn(
        "[dev email, SMTP not configured] To: " +
          message.to +
          " | " +
          message.subject +
          " | " +
          message.text,
      );
      return true;
    }
    try {
      await this.transport.sendMail({ from: this.mail.from, ...message });
      return true;
    } catch (error) {
      this.logger.error(
        "Email to " + message.to + " failed.",
        error instanceof Error ? error.message : undefined,
      );
      return false;
    }
  }

  // An SMS provider has not been chosen yet. Add it here when it is.
  async sendSms(message: OutgoingSms): Promise<boolean> {
    if (this.isProduction) {
      this.logger.error("SMS not sent: no SMS provider is configured.");
      return false;
    }
    this.logger.warn(
      "[dev SMS, no provider configured] To: " +
        message.to +
        " | " +
        message.text,
    );
    return true;
  }
}

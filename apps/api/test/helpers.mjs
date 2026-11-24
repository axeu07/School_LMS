import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module.js");
const { configureApp } = require("../dist/app.setup.js");
const {
  DeliveryService,
} = require("../dist/modules/notifications/delivery.service.js");
const { PrismaService } = require("../dist/database/prisma.service.js");

/**
 * Boots the real API on a random port against the local database in
 * apps/api/.env.local. Outgoing email and SMS are captured in `outbox`
 * instead of being sent.
 */
export async function startApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const outbox = [];
  const delivery = app.get(DeliveryService);
  delivery.sendSms = async (message) => {
    outbox.push({ channel: "sms", ...message });
    return true;
  };
  delivery.sendEmail = async (message) => {
    outbox.push({ channel: "email", ...message });
    return true;
  };
  const base = (await app.getUrl()).replace("[::1]", "127.0.0.1") + "/api";

  /** Sends a request. Pass `cookie` to send the refresh cookie. */
  async function call(path, { method = "GET", body, token, cookie } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = "Bearer " + token;
    if (cookie) headers.cookie = cookie;
    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const setCookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("acadmaxis_rt="));
    return {
      status: response.status,
      json: text ? JSON.parse(text) : null,
      /** "acadmaxis_rt=<token>" ready to send back, or undefined. */
      cookie: setCookie?.split(";")[0],
      setCookie,
    };
  }

  return { app, call, outbox, db: app.get(PrismaService).db };
}

export const codeIn = (text) => /\b(\d{6})\b/.exec(text)?.[1];

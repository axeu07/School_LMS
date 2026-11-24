import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import type { ApiConfiguration } from "./config/api.config";

/** Shared by main.ts and the API tests so both run the same setup. */
export function configureApp(app: NestExpressApplication): ApiConfiguration {
  const settings = app.get(ConfigService).getOrThrow<ApiConfiguration>("api");

  // Behind a load balancer, trust it so rate limits see the real client IP.
  if (settings.trustProxy) app.set("trust proxy", settings.trustProxy);
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix("api");
  // credentials: true lets the web app send the refresh cookie.
  app.enableCors({ origin: settings.origins, credentials: true });
  app.enableShutdownHooks();
  return settings;
}

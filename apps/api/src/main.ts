import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import type { ApiConfiguration } from "./config/api.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { host, port, origins } = config.getOrThrow<ApiConfiguration>("api");

  app.setGlobalPrefix("api");
  app.enableCors({ origin: origins });
  app.enableShutdownHooks();
  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { host, port } = configureApp(app);
  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

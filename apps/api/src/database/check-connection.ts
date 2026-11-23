import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "./prisma.service";

async function checkConnection() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const prisma = app.get(PrismaService);
    if (!prisma.isConfigured) {
      console.error("Set DATABASE_URL in apps/api/.env.local.");
      process.exitCode = 1;
      return;
    }

    await prisma.checkConnection();
    console.log("PostgreSQL connectivity verified.");
  } finally {
    await app.close();
  }
}

checkConnection().catch(() => {
  console.error(
    "Could not verify PostgreSQL connectivity. Check that PostgreSQL is running and that the API connection settings are valid.",
  );
  process.exitCode = 1;
});

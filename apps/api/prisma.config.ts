import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const { parsed: fileEnv } = config({
  path: [resolve(__dirname, ".env.local"), resolve(__dirname, ".env")],
  processEnv: {},
  quiet: true,
});

const databaseUrl =
  process.env.DATABASE_URL?.trim() || fileEnv?.DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl },
});

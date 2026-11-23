import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  private client?: PrismaClient;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>("DATABASE_URL")?.trim());
  }

  async checkConnection(): Promise<void> {
    if (!this.client) {
      const connectionString = this.config.get<string>("DATABASE_URL")?.trim();
      if (!connectionString) {
        throw new Error("DATABASE_URL is missing.");
      }

      this.client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 5_000,
        }),
      });
    }

    await this.client.$queryRaw`SELECT 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.$disconnect();
  }
}

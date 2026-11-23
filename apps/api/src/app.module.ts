import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { apiConfig } from "./config/api.config";
import { HealthController } from "./common/health.controller";
import { DatabaseModule } from "./database/database.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(__dirname, "../.env.local"),
        resolve(__dirname, "../.env"),
      ],
      load: [apiConfig],
    }),
    DatabaseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

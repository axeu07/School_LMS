import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { resolve } from "node:path";
import { apiConfig } from "./config/api.config";
import { authConfig } from "./config/auth.config";
import { mailConfig } from "./config/mail.config";
import { AuditController } from "./common/audit.controller";
import { AuditModule } from "./common/audit.service";
import { HealthController } from "./common/health.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccessTokenGuard, PermissionsGuard } from "./modules/auth/guards";
import { InstitutionsModule } from "./modules/institutions/institutions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(__dirname, "../.env.local"),
        resolve(__dirname, "../.env"),
      ],
      load: [apiConfig, authConfig, mailConfig],
    }),
    // Default: 120 requests a minute per IP. Auth routes set stricter limits.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    InstitutionsModule,
  ],
  controllers: [HealthController, AuditController],
  providers: [
    // Order matters: rate limit, then sign-in, then permissions.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}

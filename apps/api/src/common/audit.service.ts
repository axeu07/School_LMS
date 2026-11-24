import { Global, Injectable, Logger, Module } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { RequestMeta } from "../modules/auth/auth.types";

export interface AuditEntry {
  action: string;
  schoolId?: string | null;
  userId?: string | null;
  meta?: RequestMeta;
  detail?: Prisma.InputJsonObject;
}

/** Writes security and admin events. Failures are logged, never thrown. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.db.auditEvent.create({
        data: {
          action: entry.action,
          schoolId: entry.schoolId ?? null,
          userId: entry.userId ?? null,
          ipAddress: entry.meta?.ipAddress ?? null,
          userAgent: entry.meta?.userAgent ?? null,
          detail: entry.detail,
        },
      });
    } catch (error) {
      this.logger.error(
        "Could not record audit event " + entry.action,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

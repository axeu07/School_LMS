import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { AuthContext } from "../modules/auth/auth.types";
import { CurrentAuth, RequirePermissions } from "../modules/auth/decorators";

@Controller("audit-events")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Latest events for the signed-in user's school. Super Admins see every
   * school's events and platform events.
   */
  @RequirePermissions("audit.read")
  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const events = await this.prisma.db.auditEvent.findMany({
      where: auth.isSuperAdmin ? {} : { schoolId: auth.schoolId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        action: true,
        createdAt: true,
        ipAddress: true,
        detail: true,
        schoolId: true,
        user: { select: { id: true, displayName: true } },
      },
    });
    return { events };
  }
}

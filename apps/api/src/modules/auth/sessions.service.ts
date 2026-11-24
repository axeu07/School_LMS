import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { SignInMethod } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  authPolicy,
  messages,
  tokenAudience,
  tokenIssuer,
} from "./auth.policy";
import type {
  AccessTokenPayload,
  AuthContext,
  RequestMeta,
} from "./auth.types";
import { allPermissions, primaryRole, type AppRole } from "./permissions";
import { newRefreshToken, sha256Hex } from "./tokens";

const minute = 60_000;
/** Don't write lastUsedAt on every request; once a minute is enough. */
const touchEveryMs = minute;

export interface OpenedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
  schoolId: string | null;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async open(
    userId: string,
    schoolId: string | null,
    method: SignInMethod,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<OpenedSession> {
    const refreshToken = newRefreshToken();
    const expiresAt = new Date(
      now.getTime() + authPolicy.sessionMaxHours * 60 * minute,
    );
    const session = await this.prisma.db.authSession.create({
      data: {
        userId,
        schoolId,
        method,
        refreshTokenHash: sha256Hex(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        lastUsedAt: now,
        expiresAt,
      },
      select: { id: true },
    });
    return { sessionId: session.id, refreshToken, expiresAt, userId, schoolId };
  }

  /**
   * Swaps a refresh token for a new one. Each token works once; a second use
   * (or a concurrent refresh that lost the race) is rejected.
   */
  async rotate(refreshToken: string, now = new Date()): Promise<OpenedSession> {
    const oldHash = sha256Hex(refreshToken);
    const session = await this.prisma.db.authSession.findUnique({
      where: { refreshTokenHash: oldHash },
    });
    if (!session) throw new UnauthorizedException(messages.sessionEnded);
    await this.assertOpen(session, now);

    const next = newRefreshToken();
    const { count } = await this.prisma.db.authSession.updateMany({
      where: { id: session.id, refreshTokenHash: oldHash, revokedAt: null },
      data: { refreshTokenHash: sha256Hex(next), lastUsedAt: now },
    });
    if (count !== 1) throw new UnauthorizedException(messages.sessionEnded);
    return {
      sessionId: session.id,
      refreshToken: next,
      expiresAt: session.expiresAt,
      userId: session.userId,
      schoolId: session.schoolId,
    };
  }

  /** Builds the request's AuthContext, or rejects if the session has ended. */
  async resolve(
    sessionId: string,
    userId: string,
    now = new Date(),
  ): Promise<AuthContext> {
    const session = await this.prisma.db.authSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId)
      throw new UnauthorizedException(messages.sessionEnded);
    await this.assertOpen(session, now);
    const context = await this.context(userId, session.schoolId, session.id);
    if (now.getTime() - session.lastUsedAt.getTime() > touchEveryMs) {
      await this.prisma.db.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });
    }
    return context;
  }

  async revokeByToken(refreshToken: string, now = new Date()) {
    const session = await this.prisma.db.authSession.findUnique({
      where: { refreshTokenHash: sha256Hex(refreshToken) },
      select: { id: true, userId: true, schoolId: true },
    });
    if (!session) return null;
    await this.revoke(session.id, now);
    return session;
  }

  async revoke(sessionId: string, now = new Date()) {
    await this.prisma.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  /** Signs the user out everywhere, optionally keeping the current device. */
  async revokeAll(userId: string, exceptSessionId?: string, now = new Date()) {
    await this.prisma.db.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: now },
    });
  }

  accessToken(context: AuthContext): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: context.userId,
      sid: context.sessionId,
      sch: context.schoolId,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: authPolicy.accessTokenMinutes * 60,
      issuer: tokenIssuer,
      audience: tokenAudience,
    });
  }

  /** The user's current roles and permissions in the session's school. */
  async context(
    userId: string,
    schoolId: string | null,
    sessionId: string,
  ): Promise<AuthContext> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { isActive: true, platformRole: true },
    });
    if (!user?.isActive) throw new UnauthorizedException(messages.sessionEnded);

    if (!schoolId) {
      if (user.platformRole !== "SUPER_ADMIN")
        throw new UnauthorizedException(messages.sessionEnded);
      return {
        userId,
        sessionId,
        schoolId: null,
        membershipId: null,
        role: "super-admin",
        roles: ["super-admin"],
        permissions: new Set(allPermissions),
        isSuperAdmin: true,
      };
    }

    const membership = await this.prisma.db.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
      select: {
        id: true,
        isActive: true,
        school: { select: { isActive: true } },
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    const roles = membership?.roles.map(({ role }) => role.code) ?? [];
    const role = primaryRole(roles);
    if (!membership?.isActive || !membership.school.isActive || !role)
      throw new UnauthorizedException(messages.sessionEnded);

    return {
      userId,
      sessionId,
      schoolId,
      membershipId: membership.id,
      role,
      roles: roles.filter(
        (code): code is AppRole => primaryRole([code]) !== undefined,
      ),
      permissions: new Set(
        membership.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
      isSuperAdmin: false,
    };
  }

  private async assertOpen(
    session: {
      id: string;
      revokedAt: Date | null;
      expiresAt: Date;
      lastUsedAt: Date;
    },
    now: Date,
  ) {
    if (session.revokedAt)
      throw new UnauthorizedException(messages.sessionEnded);
    if (session.expiresAt <= now) {
      await this.revoke(session.id, now);
      throw new UnauthorizedException(messages.sessionEnded);
    }
    const idleMs = now.getTime() - session.lastUsedAt.getTime();
    if (idleMs >= authPolicy.idleTimeoutMinutes * minute) {
      await this.revoke(session.id, now);
      throw new UnauthorizedException(messages.sessionIdle);
    }
  }
}

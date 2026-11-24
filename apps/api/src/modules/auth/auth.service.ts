import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CodePurpose, SignInMethod } from "../../generated/prisma/client";
import type { AuthConfiguration } from "../../config/auth.config";
import { AuditService } from "../../common/audit.service";
import { PrismaService } from "../../database/prisma.service";
import { DeliveryService } from "../notifications/delivery.service";
import { authPolicy, lockedMessage, messages } from "./auth.policy";
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  ResetPasswordDto,
} from "./auth.dto";
import type { AuthContext, RequestMeta } from "./auth.types";
import { afterFailedAttempt, minutesLocked, unlocked } from "./lockout";
import {
  hashPassword,
  passwordProblem,
  verifyAgainstDummy,
  verifyPassword,
} from "./password";
import { normalizePhone } from "./phone";
import { SessionsService } from "./sessions.service";
import { codeDigest, newCode, sameHex } from "./tokens";

const accountSelect = {
  id: true,
  email: true,
  passwordHash: true,
  failedLoginCount: true,
  lockedUntil: true,
} as const;
type Account = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

export interface SignedIn {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  profile: Profile;
}

export interface Profile {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    studentNumber: string | null;
  };
  school: { id: string; code: string; slug: string; name: string } | null;
  role: string;
  roles: string[];
  permissions: string[];
  session: {
    id: string;
    idleTimeoutMinutes: number;
    accessTokenExpiresIn: number;
  };
}

@Injectable()
export class AuthService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly delivery: DeliveryService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<AuthConfiguration>("auth").secret;
  }

  // ---------- Password sign-in ----------

  async login(dto: LoginDto, meta: RequestMeta): Promise<SignedIn> {
    const now = new Date();
    const school = dto.schoolCode
      ? await this.schoolByCode(dto.schoolCode)
      : null;
    const account =
      dto.schoolCode && !school
        ? null
        : await this.findAccount(school?.id ?? null, dto.identifier);

    if (!account?.passwordHash) {
      await verifyAgainstDummy(dto.password);
      await this.audit.record({
        action: "auth.sign_in_failed",
        schoolId: school?.id,
        meta,
        detail: { reason: "unknown_account" },
      });
      throw new UnauthorizedException(messages.signInFailed);
    }

    const locked = minutesLocked(account, now);
    if (locked)
      throw new HttpException(
        lockedMessage(locked),
        HttpStatus.TOO_MANY_REQUESTS,
      );

    if (!(await verifyPassword(dto.password, account.passwordHash))) {
      const next = afterFailedAttempt(account, now);
      await this.prisma.db.user.update({
        where: { id: account.id },
        data: next,
      });
      await this.audit.record({
        action: next.lockedUntil
          ? "auth.account_locked"
          : "auth.sign_in_failed",
        schoolId: school?.id,
        userId: account.id,
        meta,
        detail: { reason: "wrong_password", failures: next.failedLoginCount },
      });
      if (next.lockedUntil)
        throw new HttpException(
          lockedMessage(minutesLocked(next, now)),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      throw new UnauthorizedException(messages.signInFailed);
    }

    return this.startSession(
      account.id,
      school?.id ?? null,
      "PASSWORD",
      meta,
      now,
    );
  }

  // ---------- Parent sign-in with a one-time code ----------

  async requestOtp(dto: OtpRequestDto, meta: RequestMeta) {
    const parent = await this.findParentByPhone(dto.schoolCode, dto.phone);
    if (parent) {
      const code = await this.issueCode(
        parent.userId,
        parent.schoolId,
        "SIGN_IN_OTP",
      );
      if (code) {
        this.delivery.queueSms({
          to: parent.phone,
          text:
            code +
            " is your ACADMAXIS sign-in code. It expires in " +
            authPolicy.codeMinutes +
            " minutes. Don't share it with anyone.",
        });
        await this.audit.record({
          action: "auth.otp_sent",
          schoolId: parent.schoolId,
          userId: parent.userId,
          meta,
        });
      }
    }
    return { message: messages.codeSent };
  }

  async verifyOtp(dto: OtpVerifyDto, meta: RequestMeta): Promise<SignedIn> {
    const parent = await this.findParentByPhone(dto.schoolCode, dto.phone);
    if (!parent) throw new BadRequestException(messages.codeInvalid);
    await this.consumeCode(parent.userId, "SIGN_IN_OTP", dto.code, meta);
    return this.startSession(
      parent.userId,
      parent.schoolId,
      "OTP",
      meta,
      new Date(),
    );
  }

  // ---------- Forgotten and changed passwords ----------

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta) {
    const school = dto.schoolCode
      ? await this.schoolByCode(dto.schoolCode)
      : null;
    const account =
      dto.schoolCode && !school
        ? null
        : await this.findAccount(school?.id ?? null, dto.identifier);
    if (account?.email) {
      const code = await this.issueCode(
        account.id,
        school?.id ?? null,
        "PASSWORD_RESET",
      );
      if (code) {
        this.delivery.queueEmail({
          to: account.email,
          subject: "Reset your ACADMAXIS password",
          text:
            "Use code " +
            code +
            " to reset your ACADMAXIS password. It expires in " +
            authPolicy.codeMinutes +
            " minutes. If you didn't ask for this, you can ignore this email.",
        });
        await this.audit.record({
          action: "auth.password_reset_requested",
          schoolId: school?.id,
          userId: account.id,
          meta,
        });
      }
    }
    return { message: messages.codeSent };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta) {
    const problem = passwordProblem(dto.newPassword, dto.identifier);
    if (problem) throw new BadRequestException(problem);
    const school = dto.schoolCode
      ? await this.schoolByCode(dto.schoolCode)
      : null;
    const account =
      dto.schoolCode && !school
        ? null
        : await this.findAccount(school?.id ?? null, dto.identifier);
    if (!account?.email) throw new BadRequestException(messages.codeInvalid);
    await this.consumeCode(account.id, "PASSWORD_RESET", dto.code, meta);
    await this.setPassword(account.id, dto.newPassword);
    await this.sessions.revokeAll(account.id);
    this.passwordChangedEmail(account.email);
    await this.audit.record({
      action: "auth.password_reset",
      schoolId: school?.id,
      userId: account.id,
      meta,
    });
  }

  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.db.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { email: true, passwordHash: true },
    });
    if (
      !user.passwordHash ||
      !(await verifyPassword(dto.currentPassword, user.passwordHash))
    )
      throw new BadRequestException(messages.wrongPassword);
    const problem = passwordProblem(dto.newPassword, user.email ?? "");
    if (problem) throw new BadRequestException(problem);
    await this.setPassword(auth.userId, dto.newPassword);
    await this.sessions.revokeAll(auth.userId, auth.sessionId);
    if (user.email) this.passwordChangedEmail(user.email);
    await this.audit.record({
      action: "auth.password_changed",
      schoolId: auth.schoolId,
      userId: auth.userId,
      meta,
    });
  }

  // ---------- Sessions ----------

  async refresh(refreshToken: string): Promise<SignedIn> {
    const opened = await this.sessions.rotate(refreshToken);
    const context = await this.sessions.context(
      opened.userId,
      opened.schoolId,
      opened.sessionId,
    );
    return {
      accessToken: await this.sessions.accessToken(context),
      refreshToken: opened.refreshToken,
      refreshExpiresAt: opened.expiresAt,
      profile: await this.profile(context),
    };
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) return;
    const session = await this.sessions.revokeByToken(refreshToken);
    if (session)
      await this.audit.record({
        action: "auth.signed_out",
        schoolId: session.schoolId,
        userId: session.userId,
        meta,
      });
  }

  async profile(context: AuthContext): Promise<Profile> {
    const [user, school, membership] = await Promise.all([
      this.prisma.db.user.findUniqueOrThrow({
        where: { id: context.userId },
        select: { id: true, displayName: true, email: true, phone: true },
      }),
      context.schoolId
        ? this.prisma.db.school.findUnique({
            where: { id: context.schoolId },
            select: { id: true, code: true, slug: true, name: true },
          })
        : null,
      context.membershipId
        ? this.prisma.db.schoolMembership.findUnique({
            where: { id: context.membershipId },
            select: { studentNumber: true },
          })
        : null,
    ]);
    return {
      user: {
        id: user.id,
        name: user.displayName,
        email: user.email,
        phone: user.phone,
        studentNumber: membership?.studentNumber ?? null,
      },
      school,
      role: context.role,
      roles: context.roles,
      permissions: [...context.permissions].sort(),
      session: {
        id: context.sessionId,
        idleTimeoutMinutes: authPolicy.idleTimeoutMinutes,
        accessTokenExpiresIn: authPolicy.accessTokenMinutes * 60,
      },
    };
  }

  // ---------- Helpers ----------

  private async startSession(
    userId: string,
    schoolId: string | null,
    method: SignInMethod,
    meta: RequestMeta,
    now: Date,
  ): Promise<SignedIn> {
    // A member with no active role can't use the app: close the new session
    // and report the normal sign-in error.
    const opened = await this.sessions.open(
      userId,
      schoolId,
      method,
      meta,
      now,
    );
    let context: AuthContext;
    try {
      context = await this.sessions.context(userId, schoolId, opened.sessionId);
    } catch {
      await this.sessions.revoke(opened.sessionId, now);
      throw new UnauthorizedException(messages.signInFailed);
    }
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { ...unlocked, lastSignInAt: now },
    });
    await this.audit.record({
      action: "auth.signed_in",
      schoolId,
      userId,
      meta,
      detail: { method },
    });
    return {
      accessToken: await this.sessions.accessToken(context),
      refreshToken: opened.refreshToken,
      refreshExpiresAt: opened.expiresAt,
      profile: await this.profile(context),
    };
  }

  private schoolByCode(code: string) {
    return this.prisma.db.school.findFirst({
      where: { code: code.trim().toUpperCase(), isActive: true },
      select: { id: true },
    });
  }

  /**
   * Finds an account by email, or by student number within a school.
   * With no school, only platform (Super Admin) accounts are searched.
   */
  private async findAccount(
    schoolId: string | null,
    identifier: string,
  ): Promise<Account | null> {
    const value = identifier.trim();
    if (!value) return null;
    if (!schoolId) {
      return this.prisma.db.user.findFirst({
        where: {
          email: value.toLowerCase(),
          isActive: true,
          platformRole: "SUPER_ADMIN",
        },
        select: accountSelect,
      });
    }
    const membership = await this.prisma.db.schoolMembership.findFirst({
      where: {
        schoolId,
        isActive: true,
        ...(value.includes("@")
          ? { user: { isActive: true, email: value.toLowerCase() } }
          : {
              user: { isActive: true },
              studentNumber: { equals: value, mode: "insensitive" },
            }),
      },
      select: { user: { select: accountSelect } },
    });
    return membership?.user ?? null;
  }

  private async findParentByPhone(schoolCode: string, input: string) {
    const phone = normalizePhone(input);
    const school = await this.schoolByCode(schoolCode);
    if (!phone || !school) return null;
    const membership = await this.prisma.db.schoolMembership.findFirst({
      where: {
        schoolId: school.id,
        isActive: true,
        user: { isActive: true, phone },
        roles: { some: { role: { code: "parent", isActive: true } } },
      },
      select: { userId: true },
    });
    return membership
      ? { userId: membership.userId, schoolId: school.id, phone }
      : null;
  }

  /**
   * Creates a new code and cancels older ones. Returns null when a code was
   * sent less than resendSeconds ago, so repeated clicks don't spam.
   */
  private async issueCode(
    userId: string,
    schoolId: string | null,
    purpose: CodePurpose,
  ): Promise<string | null> {
    const now = new Date();
    const latest = await this.prisma.db.oneTimeCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      latest &&
      now.getTime() - latest.createdAt.getTime() <
        authPolicy.resendSeconds * 1000
    )
      return null;
    const code = newCode();
    await this.prisma.db.$transaction([
      this.prisma.db.oneTimeCode.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.db.oneTimeCode.create({
        data: {
          userId,
          schoolId,
          purpose,
          codeHash: codeDigest(this.secret, userId, purpose, code),
          expiresAt: new Date(now.getTime() + authPolicy.codeMinutes * 60_000),
          createdAt: now,
        },
      }),
    ]);
    return code;
  }

  /** Checks a code and marks it used. Throws with the reason if it fails. */
  private async consumeCode(
    userId: string,
    purpose: CodePurpose,
    code: string,
    meta: RequestMeta,
  ) {
    const now = new Date();
    const entry = await this.prisma.db.oneTimeCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!entry) throw new BadRequestException(messages.codeInvalid);
    if (entry.expiresAt <= now)
      throw new BadRequestException(messages.codeExpired);
    if (entry.attempts >= authPolicy.codeAttempts)
      throw new BadRequestException(messages.codeTooManyTries);

    if (
      !sameHex(entry.codeHash, codeDigest(this.secret, userId, purpose, code))
    ) {
      const attempts = entry.attempts + 1;
      await this.prisma.db.oneTimeCode.update({
        where: { id: entry.id },
        data: { attempts },
      });
      await this.audit.record({
        action: "auth.code_failed",
        schoolId: entry.schoolId,
        userId,
        meta,
        detail: { purpose, attempts },
      });
      throw new BadRequestException(
        attempts >= authPolicy.codeAttempts
          ? messages.codeTooManyTries
          : "That code is incorrect.",
      );
    }

    const { count } = await this.prisma.db.oneTimeCode.updateMany({
      where: { id: entry.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (count !== 1) throw new BadRequestException(messages.codeInvalid);
  }

  private async setPassword(userId: string, password: string) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        ...unlocked,
      },
    });
  }

  private passwordChangedEmail(to: string) {
    this.delivery.queueEmail({
      to,
      subject: "Your ACADMAXIS password was changed",
      text: "Your ACADMAXIS password was changed. If this wasn't you, contact your school office.",
    });
  }
}

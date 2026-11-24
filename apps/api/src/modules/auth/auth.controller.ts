import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { AuthConfiguration } from "../../config/auth.config";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  ResetPasswordDto,
} from "./auth.dto";
import { messages, refreshCookieName, refreshCookiePath } from "./auth.policy";
import { AuthService, type SignedIn } from "./auth.service";
import { requestMeta, type AuthContext } from "./auth.types";
import { CurrentAuth, Public } from "./decorators";

/** Stricter limit for endpoints that check passwords or codes. */
const sensitive = { default: { limit: 10, ttl: 60_000 } };

/**
 * Access tokens go in the response body (keep them in memory, send as
 * `Authorization: Bearer`). The refresh token is an httpOnly cookie scoped to
 * /api/auth, so page scripts can never read it.
 */
@Controller("auth")
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secureCookies =
      config.getOrThrow<AuthConfiguration>("auth").secureCookies;
  }

  @Public()
  @Throttle(sensitive)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.signedIn(
      response,
      await this.auth.login(dto, requestMeta(request)),
    );
  }

  @Public()
  @Throttle(sensitive)
  @Post("otp/request")
  @HttpCode(HttpStatus.ACCEPTED)
  requestOtp(@Body() dto: OtpRequestDto, @Req() request: Request) {
    return this.auth.requestOtp(dto, requestMeta(request));
  }

  @Public()
  @Throttle(sensitive)
  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: OtpVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.signedIn(
      response,
      await this.auth.verifyOtp(dto, requestMeta(request)),
    );
  }

  @Public()
  @Throttle(sensitive)
  @Post("password/forgot")
  @HttpCode(HttpStatus.ACCEPTED)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.auth.forgotPassword(dto, requestMeta(request));
  }

  @Public()
  @Throttle(sensitive)
  @Post("password/reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    await this.auth.resetPassword(dto, requestMeta(request));
  }

  @Throttle(sensitive)
  @Post("password/change")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    await this.auth.changePassword(auth, dto, requestMeta(request));
  }

  /** Swaps the refresh cookie for a new access token (and a new cookie). */
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = this.cookie(request);
    if (!token) throw new UnauthorizedException(messages.sessionEnded);
    try {
      return this.signedIn(response, await this.auth.refresh(token));
    } catch (error) {
      this.clearCookie(response);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(this.cookie(request), requestMeta(request));
    this.clearCookie(response);
  }

  @Get("me")
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.profile(auth);
  }

  private signedIn(response: Response, result: SignedIn) {
    response.cookie(refreshCookieName, result.refreshToken, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      path: refreshCookiePath,
      expires: result.refreshExpiresAt,
    });
    response.setHeader("Cache-Control", "no-store");
    return {
      accessToken: result.accessToken,
      expiresIn: result.profile.session.accessTokenExpiresIn,
      ...result.profile,
    };
  }

  private clearCookie(response: Response) {
    response.clearCookie(refreshCookieName, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      path: refreshCookiePath,
    });
  }

  private cookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[refreshCookieName];
    return typeof value === "string" && value ? value : undefined;
  }
}

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { AccessTokenPayload, AuthedRequest } from "./auth.types";
import { tokenAudience, tokenIssuer } from "./auth.policy";
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from "./decorators";
import { SessionsService } from "./sessions.service";

/**
 * Applied to every route. Checks the bearer access token, then confirms the
 * session behind it is still open (not signed out, idle or expired).
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ["HS256"],
        issuer: tokenIssuer,
        audience: tokenAudience,
      });
    } catch {
      throw new UnauthorizedException();
    }

    request.auth = await this.sessions.resolve(payload.sid, payload.sub);
    return true;
  }
}

/** Enforces @RequirePermissions on signed-in routes. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    if (auth.isSuperAdmin) return true;
    if (required.every((code) => auth.permissions.has(code))) return true;
    throw new ForbiddenException("You don't have access to this.");
  }
}

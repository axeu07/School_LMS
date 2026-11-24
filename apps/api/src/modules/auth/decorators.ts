import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthContext, AuthedRequest } from "./auth.types";
import type { PermissionCode } from "./permissions";

export const IS_PUBLIC = "auth:isPublic";
export const REQUIRED_PERMISSIONS = "auth:permissions";

/** The route needs no sign-in. Every other route does. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The signed-in user must hold every listed permission. */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** The signed-in user's AuthContext. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    return auth;
  },
);

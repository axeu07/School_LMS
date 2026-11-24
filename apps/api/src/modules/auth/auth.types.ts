import type { Request } from "express";
import type { AppRole } from "./permissions";

/** Who is making the request. Set by AccessTokenGuard. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  /** Null for a platform (Super Admin) session. */
  schoolId: string | null;
  membershipId: string | null;
  role: AppRole;
  roles: AppRole[];
  /** Super Admins hold every permission. */
  permissions: ReadonlySet<string>;
  isSuperAdmin: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  sch: string | null;
}

export type AuthedRequest = Request & { auth?: AuthContext };

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export function requestMeta(request: Request): RequestMeta {
  const agent = request.headers["user-agent"];
  return {
    ipAddress: request.ip?.slice(0, 64) ?? null,
    userAgent: typeof agent === "string" ? agent.slice(0, 400) : null,
  };
}

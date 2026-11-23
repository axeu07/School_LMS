# Architecture

- `apps/web` contains the Next.js App Router, a reusable responsive layout, shadcn/ui configuration, and Tailwind CSS theme tokens. The default institution name lives in `src/lib/institution.ts`. Future institution branding can supply the name, logo, theme tokens, and configuration through that boundary.
- `apps/api` contains the NestJS application, environment configuration, the `/api/health` REST route, and the Prisma configuration and PostgreSQL schema. The database module creates one pooled Prisma client on first use and disconnects on shutdown. `/api/health` checks HTTP availability and `/api/health/database` checks database connectivity.
- `packages/shared` reserves a workspace for types, constants, and validation schemas shared by the web and API apps## Tenancy and deployment

One PostgreSQL database can host multiple schools. Each school has a unique slug, display name, optional logo and theme, and school settings. The same schema supports a dedicated app and database for a single school. School, user, membership, and role records have an active flag for deactivation. Disabling a school, identity, or membership must take effect in authorization checks.

`User` is a global identity. `SchoolMembership` connects a user to a school, with one membership per user per school. Academic records reference memberships, so the same identity can have different roles and academic relationships in different schools. Normalize email and slug before storage and lookup in Phase 4.

## Roles and permissions

- `User.platformRole` is a separate, nullable platform role with a single initial value, `SUPER_ADMIN`. Platform-only management must use separate guards, audited operations, and a protected provisioning flow. A platform role does not implicitly authorize a school API request.
- `Role` belongs to one school, with a unique code within that school. PostgreSQL reserves the `SUPER_ADMIN` code for the platform. Provision `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, and `PARENT` as school-specific role records in the future school provisioning flow. Additional school roles use the same model.
- `Permission` is a platform-managed catalog of action codes. `RolePermission` grants actions to a role, and `MembershipRole` assigns roles to a school membership. Explicit join records support multiple roles and permissions, with uniqueness preventing duplicate assignments.
- Phase 4 must reserve the built-in school codes and protect built-in role definitions. Require a grant-specific permission for role administration. Check every role grant and role-permission edit against a server-defined delegation policy and the actor's effective grantable permissions. Deny self-escalation and protected grants by default. Validate and write within a transaction with appropriate locking or serializable retries so concurrent changes cannot bypass checks. Audit role and platform privilege changes.

## Academic relationships

- A school owns academic years, class levels, and subjects. A section ties a class level to one academic year. Class levels and subjects can be reused across years.
- An enrollment connects a student membership to one section per school and academic year. Its composite foreign key also checks the section's year. Moving a student between years creates a new enrollment. A transfer within a year updates the current enrollment. In-year transfer history would require a separate history model.
- A teacher assignment connects a teacher membership, subject, and section. A section determines its academic year. Multiple teachers can share a subject and section.
- A parent-student relationship links two distinct memberships in one school. Memberships can participate in multiple links in either supported capacity. Application authorization must validate participant roles, guardian linking authority, and the active state of relevant records.
- Composite foreign keys include `schoolId` for tenant-owned references. They reject cross-school references in academics and school role assignments. PostgreSQL also checks the order of academic year dates and prevents self-links in parent-student relationships. Essential references restrict deletion. Pure RBAC join records cascade when their owning role or membership is deleted.

## Phase 4 authorization

1. Authenticate the user and resolve a school selector such as a slug from the route or validated hostname. Treat the selector as untrusted. Resolve an active school and a matching active membership for the authenticated active user.
2. Build a server-side tenant context from the resolved membership containing the school ID, membership ID, and effective permissions from active school roles. Reject missing or inactive membership, and deny actions without a matching permission. Never accept tenant ownership from a request body.
3. Require that context in school-scoped services and repositories. Scope reads and writes by its school ID, including nested references, bulk updates, and deletes. Check resource-level access as well. For example, teachers can be limited to assigned sections and parents to linked children. Use compound selectors or conditional writes to prevent ID-only access.
4. Composite keys protect relationship integrity. API guards and scoped queries protect access to rows. Consider PostgreSQL Row-Level Security as defense in depth using a non-owner application role and transaction-local tenant context on the same connection. RLS requires a dedicated design for pooled connections, privileged operations, and background jobs.

Authentication, permission guards, role provisioning, and RLS are Phase 4 or later.

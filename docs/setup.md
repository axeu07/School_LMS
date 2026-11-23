# Local setup

Use a supported Node.js 22, 24, or 26 release and npm 10 or newer. Run these commands from the workspace root. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```powershell
npm.cmd ci
```

## Configure PostgreSQL

If `apps/api/.env.local` is missing, copy `apps/api/.env.example` to that path and set `DATABASE_URL` to the connection string for your existing `school_lms_db` database. Percent-encode reserved characters in URL credentials. Keep the connection string in the API workspace.

NestJS and Prisma load the API's `.env.local` ahead of `.env`. Values supplied by the process environment take priority. The optional `apps/web/.env.local` is for frontend settings. Variables beginning with `NEXT_PUBLIC_` are visible in the browser.

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run db:check
```

The check builds the API and runs a read-only `SELECT 1` through the same Prisma service used by the HTTP endpoint. It exits with code 1 if connectivity cannot be verified. These commands do not run migrations.

## Run the apps

```powershell
npm.cmd run dev       # Both apps
npm.cmd run dev:web   # Next.js only
npm.cmd run dev:api   # NestJS only
```

- Frontend: http://127.0.0.1:3000
- API liveness: http://127.0.0.1:3001/api/health returns HTTP 200 while NestJS is serving.
- Database readiness: http://127.0.0.1:3001/api/health/database returns HTTP 200 if the database query succeeds and HTTP 503 otherwise.

The API allows local frontend origins on port 3000 by default. If the frontend port changes, set `WEB_ORIGINS` to the frontend origin.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run format:check
```

## Schema-first migrations

Run from the workspace root after editing the Prisma schema. Use a local development database and verify the target in your local configuration before applying changes.

```powershell
npm.cmd run db:validate
npm.cmd exec -w @school-lms/api -- prisma migrate dev --name describe_change --create-only
# Review the generated migration.sql before applying.
npm.cmd exec -w @school-lms/api -- prisma migrate dev
npm.cmd run db:generate
npm.cmd exec -w @school-lms/api -- prisma migrate status
npm.cmd run db:check
```

Stop if Prisma reports unexpected drift or requests a reset. Prisma Migrate needs a separate shadow database for development. Its default workflow creates and cleans up its own temporary database. For staging or production, apply reviewed, committed migrations with `npm.cmd exec -w @school-lms/api -- prisma migrate deploy` and check them with `prisma migrate status` through the same workspace.

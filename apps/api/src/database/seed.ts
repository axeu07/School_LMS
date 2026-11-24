import "reflect-metadata";
import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../modules/auth/password";
import {
  permissionCatalog,
  roleNames,
  rolePermissions,
  schoolRoles,
} from "../modules/auth/permissions";
import { demoPassword, platformOwner, seedSchools } from "./seed-data";

/**
 * Seeds permissions, roles, the demo schools and the demo accounts.
 * Safe to run again: it updates names and roles but keeps any password a
 * user has changed. Pass --reset-passwords to restore Demo@1234 and clear
 * lockouts on the demo accounts.
 */
config({
  path: [
    resolve(__dirname, "../../.env.local"),
    resolve(__dirname, "../../.env"),
  ],
  quiet: true,
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo accounts in production.");
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("Set DATABASE_URL in apps/api/.env.local.");
  const resetPasswords = process.argv.includes("--reset-passwords");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const demoHash = await hashPassword(demoPassword);

  try {
    // Permissions are platform-wide.
    const permissionIds = new Map<string, string>();
    for (const [code, description] of Object.entries(permissionCatalog)) {
      const row = await db.permission.upsert({
        where: { code },
        create: { code, description },
        update: { description },
        select: { id: true },
      });
      permissionIds.set(code, row.id);
    }

    async function upsertUser(data: {
      email?: string;
      phone?: string;
      name: string;
      canSignIn: boolean;
      platform?: boolean;
      existingId?: string;
    }) {
      const existing = data.existingId
        ? await db.user.findUnique({ where: { id: data.existingId } })
        : data.email
          ? await db.user.findUnique({ where: { email: data.email } })
          : null;
      const password = data.canSignIn
        ? {
            ...(!existing?.passwordHash || resetPasswords
              ? { passwordHash: demoHash, passwordChangedAt: null }
              : {}),
            ...(resetPasswords
              ? { failedLoginCount: 0, lockedUntil: null }
              : {}),
          }
        : { passwordHash: null };
      const fields = {
        email: data.email ?? null,
        phone: data.phone ?? null,
        displayName: data.name,
        platformRole: data.platform ? ("SUPER_ADMIN" as const) : null,
        isActive: true,
        ...password,
      };
      return existing
        ? db.user.update({ where: { id: existing.id }, data: fields })
        : db.user.create({ data: fields });
    }

    await upsertUser({ ...platformOwner, canSignIn: true, platform: true });

    for (const source of seedSchools) {
      const school = await db.school.upsert({
        where: { slug: source.slug },
        create: {
          slug: source.slug,
          code: source.code,
          name: source.name,
          theme: source.theme,
        },
        update: { code: source.code, name: source.name, theme: source.theme },
      });

      const roleIds = new Map<string, string>();
      for (const code of schoolRoles) {
        const role = await db.role.upsert({
          where: { schoolId_code: { schoolId: school.id, code } },
          create: { schoolId: school.id, code, name: roleNames[code] },
          update: { name: roleNames[code], isActive: true },
        });
        roleIds.set(code, role.id);
        const wanted = rolePermissions[code].map((p) => permissionIds.get(p)!);
        await db.rolePermission.deleteMany({
          where: {
            schoolId: school.id,
            roleId: role.id,
            permissionId: { notIn: wanted },
          },
        });
        await db.rolePermission.createMany({
          data: wanted.map((permissionId) => ({
            schoolId: school.id,
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      const memberships = new Map<string, string>();
      for (const person of source.people) {
        // Students without email are matched by student number.
        const existingMembership = person.studentNumber
          ? await db.schoolMembership.findUnique({
              where: {
                schoolId_studentNumber: {
                  schoolId: school.id,
                  studentNumber: person.studentNumber,
                },
              },
            })
          : null;
        const user = await upsertUser({
          ...person,
          existingId: existingMembership?.userId,
        });
        const membership = await db.schoolMembership.upsert({
          where: { schoolId_userId: { schoolId: school.id, userId: user.id } },
          create: {
            schoolId: school.id,
            userId: user.id,
            studentNumber: person.studentNumber ?? null,
          },
          update: {
            isActive: true,
            studentNumber: person.studentNumber ?? null,
          },
        });
        memberships.set(person.key, membership.id);
        await db.membershipRole.createMany({
          data: [
            {
              schoolId: school.id,
              membershipId: membership.id,
              roleId: roleIds.get(person.role)!,
            },
          ],
          skipDuplicates: true,
        });
      }

      for (const person of source.people) {
        for (const child of person.children ?? []) {
          await db.parentStudentRelationship.createMany({
            data: [
              {
                schoolId: school.id,
                parentMembershipId: memberships.get(person.key)!,
                studentMembershipId: memberships.get(child)!,
              },
            ],
            skipDuplicates: true,
          });
        }
      }
      console.log("Seeded " + source.name + " (" + source.code + ").");
    }
    console.log(
      "Done. Demo accounts use the password " +
        demoPassword +
        (resetPasswords ? " (passwords and lockouts reset)." : "."),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

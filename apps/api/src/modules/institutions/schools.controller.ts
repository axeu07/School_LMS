import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "../../database/prisma.service";
import { Public } from "../auth/decorators";

type Theme = { primary?: string; tagline?: string; welcome?: string };

@Controller("schools")
export class SchoolsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public branding for a school's sign-in page, found by its code. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("by-code/:code")
  async byCode(@Param("code") code: string) {
    const value = code.trim().toUpperCase();
    const school = /^[A-Z0-9-]{2,16}$/.test(value)
      ? await this.prisma.db.school.findFirst({
          where: { code: value, isActive: true },
          select: {
            code: true,
            slug: true,
            name: true,
            logoUrl: true,
            theme: true,
          },
        })
      : null;
    if (!school)
      throw new NotFoundException("We couldn't find a school with that code.");
    const theme = (school.theme ?? {}) as Theme;
    return {
      code: school.code,
      slug: school.slug,
      name: school.name,
      logoUrl: school.logoUrl,
      primary: theme.primary ?? null,
      tagline: theme.tagline ?? null,
      welcome: theme.welcome ?? null,
    };
  }
}

import type { DemoRole, SchoolId } from "@/types/demo";

/**
 * Preschool mode: Oak and Ivy is a kindergarten, so only parents, teachers and
 * the school office use the app. Nothing is deleted. The full K-12 menus stay
 * in `fullNavigation`, and everything listed here is hidden from the menus,
 * routes and dashboards. Set `enabled` to false to bring the full LMS back,
 * or delete a slug below to bring back one page.
 */
export const preschool = {
  enabled: true,
  /** Children never sign in, so the student workspace is hidden. */
  hiddenRoles: ["student"] as DemoRole[],
  /** Only the preschool is offered in the school selector. */
  schools: ["westfield"] as SchoolId[],
  /** The floating assistant answers K-12 questions (homework, doubts, leads). */
  showAssistant: false,
  hiddenSections: {
    "super-admin": [],
    "school-admin": [
      "assignments",
      "results",
      "performance",
      "marketing",
      "leads",
      "recruitment",
    ],
    teacher: [
      "doubt-board",
      "courses",
      "assignments",
      "assessments",
      "ai-tools",
      "performance",
    ],
    student: [],
    parent: ["homework", "performance", "assessments"],
  } as Record<DemoRole, string[]>,
  /** Friendlier names for pages that stay visible. */
  renamed: {
    "school-admin/subjects": {
      title: "Learning Areas",
      description: "Play-based learning areas such as numeracy and phonics.",
    },
    "school-admin/classes": {
      title: "Classes & Groups",
      description: "Nursery, LKG and UKG groups, capacity and class teachers.",
    },
    "school-admin/students": {
      title: "Children",
      description: "Every child enrolled at the school, with their class.",
    },
    "teacher/classes": {
      title: "My Classes",
      description: "Your groups and the children in each.",
    },
  } as Record<string, { title: string; description: string }>,
};

export function roleHidden(role: DemoRole) {
  return preschool.enabled && preschool.hiddenRoles.includes(role);
}

export function sectionHidden(role: DemoRole, slug: string) {
  if (!preschool.enabled) return false;
  return roleHidden(role) || preschool.hiddenSections[role].includes(slug);
}

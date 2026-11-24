/**
 * Permission codes and the default permissions for each school role. Role
 * codes match the web app's role ids so the frontend can route by them.
 * Record-level rules (a parent sees only their own children, a teacher only
 * their classes) are applied in each feature's service, not here.
 */
export const permissionCatalog = {
  "school.settings.manage": "Change school settings and branding",
  "people.read": "View students, teachers and parents",
  "people.manage": "Add, edit and deactivate people",
  "import.run": "Bulk import people from spreadsheets",
  "classes.read": "View classes, sections and timetables",
  "classes.manage": "Manage classes, sections and timetables",
  "attendance.read": "View attendance",
  "attendance.mark": "Mark attendance",
  "assignments.read": "View assignments",
  "assignments.manage": "Create and grade assignments",
  "assignments.submit": "Submit assignments",
  "assessments.read": "View online tests",
  "assessments.manage": "Create and grade online tests",
  "assessments.attempt": "Take online tests",
  "results.read": "View results",
  "results.publish": "Publish results",
  "fees.read": "View fees and receipts",
  "fees.manage": "Manage fee structures, invoices and discounts",
  "fees.pay": "Pay fees online",
  "messages.send": "Send messages",
  "announcements.manage": "Post announcements",
  "calendar.manage": "Manage the school calendar",
  "leave.request": "Request leave",
  "leave.approve": "Approve or reject leave",
  "consent.manage": "Manage consent forms and privacy requests",
  "consent.respond": "Give or withdraw consent",
  "audit.read": "View the audit log",
  "insights.read": "View insights, leads and recruitment",
  "doubts.post": "Post doubts anonymously",
  "doubts.answer": "Answer doubts",
} as const;

export type PermissionCode = keyof typeof permissionCatalog;
export const allPermissions = Object.keys(
  permissionCatalog,
) as PermissionCode[];

export const schoolRoles = [
  "school-admin",
  "teacher",
  "student",
  "parent",
] as const;
export type SchoolRole = (typeof schoolRoles)[number];
export type AppRole = "super-admin" | SchoolRole;

export const roleNames: Record<SchoolRole, string> = {
  "school-admin": "School Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

const learnerSide: PermissionCode[] = [
  "assignments.submit",
  "assessments.attempt",
  "fees.pay",
  "doubts.post",
  "consent.respond",
];

export const rolePermissions: Record<SchoolRole, PermissionCode[]> = {
  "school-admin": allPermissions.filter((code) => !learnerSide.includes(code)),
  teacher: [
    "people.read",
    "classes.read",
    "attendance.read",
    "attendance.mark",
    "assignments.read",
    "assignments.manage",
    "assessments.read",
    "assessments.manage",
    "results.read",
    "results.publish",
    "messages.send",
    "announcements.manage",
    "leave.request",
    "doubts.answer",
  ],
  student: [
    "classes.read",
    "attendance.read",
    "assignments.read",
    "assignments.submit",
    "assessments.read",
    "assessments.attempt",
    "results.read",
    "messages.send",
    "doubts.post",
  ],
  parent: [
    "attendance.read",
    "assignments.read",
    "assessments.read",
    "results.read",
    "fees.read",
    "fees.pay",
    "messages.send",
    "leave.request",
    "consent.respond",
  ],
};

/** When someone holds several roles, the dashboard opens on the first. */
export function primaryRole(roles: string[]): SchoolRole | undefined {
  return schoolRoles.find((role) => roles.includes(role));
}

import {
  Award,
  BriefcaseBusiness,
  BookMarked,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  ChartColumn,
  ChartPie,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileUp,
  GraduationCap,
  History,
  ShieldCheck,
  HeartHandshake,
  IndianRupee,
  LayoutDashboard,
  Library,
  Magnet,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  MessagesSquare,
  Network,
  NotebookPen,
  Palette,
  School,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { DemoRole } from "@/types/demo";

/**
 * "live" pages use the shared demo records and working actions.
 * "preview" pages show representative sample content for planned modules.
 */
export type NavStatus = "live" | "preview";
export type NavItem = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: NavStatus;
};
export type NavGroup = { label: string; items: NavItem[] };

const item = (
  slug: string,
  title: string,
  icon: LucideIcon,
  description: string,
  status: NavStatus = "live",
): NavItem => ({ slug, title, icon, description, status });

const dashboard = (description: string) => ({
  label: "Overview",
  items: [item("", "Dashboard", LayoutDashboard, description)],
});

export const navigation: Record<DemoRole, NavGroup[]> = {
  "super-admin": [
    dashboard("Platform health, schools and subscriptions at a glance."),
    {
      label: "Platform",
      items: [
        item(
          "schools",
          "Schools",
          Building2,
          "Every institution on the platform, with plan, status and size.",
        ),
        item(
          "subscriptions",
          "Subscriptions",
          CreditCard,
          "Plans, limits, feature access and billing for each school.",
          "preview",
        ),
        item(
          "analytics",
          "Platform Analytics",
          ChartColumn,
          "Growth, adoption and attendance across all schools.",
        ),
      ],
    },
    {
      label: "Configuration",
      items: [
        item(
          "branding",
          "White-Label Branding",
          Palette,
          "Logos, colours, school codes and sign-in pages for each school.",
        ),
        item(
          "settings",
          "Platform Settings",
          Settings,
          "Security, AI usage limits and platform-wide notices.",
          "preview",
        ),
      ],
    },
  ],
  "school-admin": [
    dashboard("Today's school operations and what needs your attention."),
    {
      label: "Academics",
      items: [
        item(
          "academic-years",
          "Academic Years",
          CalendarRange,
          "Define academic sessions and choose the active year.",
        ),
        item(
          "classes",
          "Classes & Sections",
          School,
          "Class levels, sections, capacity and coordinators.",
        ),
        item(
          "subjects",
          "Subjects",
          BookOpen,
          "The subjects your school teaches.",
        ),
        item(
          "allocations",
          "Teacher Allocations",
          Network,
          "Assign teachers to a subject and section.",
        ),
        item(
          "timetable",
          "Timetable",
          CalendarClock,
          "Build weekly class sessions without teacher or section clashes.",
        ),
      ],
    },
    {
      label: "People",
      items: [
        item(
          "teachers",
          "Teachers",
          GraduationCap,
          "Faculty directory, availability and status.",
        ),
        item(
          "students",
          "Students",
          Users,
          "Student records and enrollments by academic year.",
        ),
        item(
          "parents",
          "Parents & Guardians",
          HeartHandshake,
          "Guardian contacts and their links to students.",
        ),
        item(
          "import",
          "Bulk Import",
          FileUp,
          "Upload students, teachers and parents from an Excel or CSV template.",
        ),
      ],
    },
    {
      label: "Operations",
      items: [
        item(
          "announcements",
          "Announcements",
          Megaphone,
          "Publish notices to the school, a role or a section.",
        ),
        item(
          "assignments",
          "Assignments",
          ClipboardList,
          "Every assignment across the school, with submission and grading progress.",
        ),
        item(
          "attendance",
          "Attendance",
          ClipboardCheck,
          "Attendance history and totals by section.",
        ),
        item(
          "leave-management",
          "Leave Management",
          CalendarOff,
          "Escalated student leave, teacher leave approvals, leave calendar and analytics.",
        ),
        item(
          "results",
          "Exams & Results",
          Award,
          "Set up exams, track marks entry and publish report cards.",
        ),
        item(
          "calendar",
          "School Calendar",
          CalendarDays,
          "Holidays, exams, PTMs and school events — schedule, publish, approve and manage PTM slots.",
        ),
        item(
          "messages",
          "Communication",
          MessagesSquare,
          "Teacher–parent messaging statistics, response times and administrative notices.",
        ),
      ],
    },
    {
      label: "Finance",
      items: [
        item(
          "fees",
          "Fees & Payments",
          IndianRupee,
          "Fee structure, invoices, payments, receipts, dues and the Razorpay gateway.",
        ),
      ],
    },
    {
      label: "Insights",
      items: [
        item(
          "performance",
          "Performance Analytics",
          TrendingUp,
          "Enrollment, attendance and grades by section.",
        ),
        item(
          "marketing",
          "Marketing Insights",
          ChartPie,
          "Social reach and enquiries for your school.",
          "preview",
        ),
        item(
          "leads",
          "Leads & Deals",
          Magnet,
          "Student leads from Instagram, Facebook, Meta Ads and more, plus upcoming deals and collaborations.",
          "preview",
        ),
        item(
          "recruitment",
          "Recruitment",
          BriefcaseBusiness,
          "Open roles, upcoming interviews, shortlisted and rejected candidates.",
          "preview",
        ),
      ],
    },
    {
      label: "Administration",
      items: [
        item(
          "settings",
          "School Settings",
          Settings,
          "School profile, plan usage, modules and demo data.",
        ),
        item(
          "branding",
          "School Branding",
          Palette,
          "Logo, colours, school code and the sign-in page.",
        ),
        item(
          "privacy",
          "Data & Privacy",
          ShieldCheck,
          "Parental consent, data copies and deletion requests.",
        ),
        item(
          "audit",
          "Audit Log",
          History,
          "Who changed marks, fees, attendance and records, and when.",
        ),
      ],
    },
  ],
  teacher: [
    dashboard("Your teaching day and what needs your attention."),
    {
      label: "Teaching",
      items: [
        item(
          "timetable",
          "Weekly Timetable",
          CalendarClock,
          "Your weekly sessions by day, room and section.",
        ),
        item(
          "classes",
          "Assigned Classes",
          UsersRound,
          "Your sections, subjects and student rosters.",
        ),
        item(
          "courses",
          "Courses & Lessons",
          Library,
          "Build chapters and topics, and add notes, PDFs and video links.",
        ),
        item(
          "calendar",
          "School Calendar",
          CalendarDays,
          "Exams, PTMs, holidays and events for your classes, plus your PTM schedule.",
        ),
      ],
    },
    {
      label: "Classwork",
      items: [
        item(
          "assignments",
          "Assignments",
          ClipboardList,
          "Create, publish, review and grade assignments.",
        ),
        item(
          "attendance",
          "Attendance",
          ClipboardCheck,
          "Mark and edit daily attendance for your sections.",
        ),
        item(
          "leave-requests",
          "Leave Requests",
          CalendarOff,
          "Review student leave for your classes and apply for your own leave.",
        ),
        item(
          "assessments",
          "Assessments & Quizzes",
          ListChecks,
          "Question bank, timed online tests, results and exam marks entry.",
        ),
      ],
    },
    {
      label: "Engagement",
      items: [
        item(
          "doubt-board",
          "Anonymous Doubt Board",
          MessageCircleQuestion,
          "Student doubts from your classes, ranked by upvotes.",
        ),
        item(
          "ai-tools",
          "AI Teaching Tools",
          Sparkles,
          "Draft summaries, questions and quizzes from your material.",
          "preview",
        ),
        item(
          "performance",
          "Class Performance",
          TrendingUp,
          "Attendance, submission rates and grades for your classes.",
        ),
        item(
          "announcements",
          "Announcements",
          Megaphone,
          "Notices published for your classes.",
        ),
        item(
          "messages",
          "Parent Messages",
          MessagesSquare,
          "Conversations with parents of the students you teach.",
        ),
      ],
    },
  ],
  student: [
    dashboard("Your classes, deadlines and progress."),
    {
      label: "Learning",
      items: [
        item(
          "courses",
          "My Courses",
          Library,
          "Chapters, topics and study material by subject.",
        ),
        item(
          "timetable",
          "My Timetable",
          CalendarClock,
          "Your weekly class sessions.",
        ),
        item(
          "calendar",
          "School Calendar",
          CalendarDays,
          "Holidays, exams, deadlines and activities for your class.",
        ),
        item(
          "assignments",
          "Assignments",
          ClipboardList,
          "Your homework, submissions, grades and feedback.",
        ),
        item(
          "quizzes",
          "Quizzes & Assessments",
          ListChecks,
          "Take timed online tests, then review your answers once they close.",
        ),
        item(
          "attendance",
          "Attendance",
          ClipboardCheck,
          "Your attendance record.",
        ),
        item(
          "leave-requests",
          "Leave Requests",
          CalendarOff,
          "Apply for leave and track approval status.",
        ),
      ],
    },
    {
      label: "Study support",
      items: [
        item(
          "doubt-board",
          "Anonymous Doubt Board",
          MessageCircleQuestion,
          "Ask doubts anonymously and upvote your classmates' questions.",
        ),
        item(
          "ai-homework-helper",
          "AI Homework Helper",
          Sparkles,
          "Get a hint first, then a step-by-step explanation.",
          "preview",
        ),
        item(
          "ai-notes",
          "AI Notes & Revision",
          NotebookPen,
          "Short revision notes generated from your chapters.",
          "preview",
        ),
        item(
          "daily-quiz",
          "Daily Revision Quiz",
          Zap,
          "Five questions from your question bank, weak topics first.",
        ),
      ],
    },
    {
      label: "Progress",
      items: [
        item(
          "progress",
          "My Progress",
          Target,
          "Report cards, test scores, weak topics, grades and attendance.",
        ),
        item(
          "announcements",
          "Announcements",
          Megaphone,
          "School and class notices.",
        ),
      ],
    },
  ],
  parent: [
    dashboard("Your child's attendance, homework and results."),
    {
      label: "My family",
      items: [
        item(
          "children",
          "My Children",
          UsersRound,
          "Every child linked to your account in this school.",
        ),
        item(
          "attendance",
          "Attendance",
          ClipboardCheck,
          "Your child's attendance record.",
        ),
        item(
          "leave-requests",
          "Child Leave Requests",
          CalendarOff,
          "Apply for leave for your child, track decisions and respond to absence alerts.",
        ),
        item(
          "homework",
          "Homework & Assignments",
          ClipboardList,
          "What is assigned, what was submitted, and the grades.",
        ),
        item(
          "performance",
          "Academic Performance",
          TrendingUp,
          "Report cards, weak topics, grades and teacher feedback.",
        ),
        item(
          "assessments",
          "Assessments",
          BookMarked,
          "Online tests, scores and the exam schedule.",
        ),
        item(
          "fees",
          "Fees",
          IndianRupee,
          "Fee details and dues, online payment and receipts.",
        ),
        item(
          "calendar",
          "School Calendar",
          CalendarDays,
          "Holidays, exams, school events and PTM booking for your child.",
        ),
        item(
          "privacy",
          "Consent & Privacy",
          ShieldCheck,
          "Your consent choices, and copies or deletion of your child's data.",
        ),
      ],
    },
    {
      label: "Communication",
      items: [
        item(
          "announcements",
          "Announcements",
          Megaphone,
          "Notices for your child's school and class.",
        ),
        item(
          "messages",
          "Messages",
          MessagesSquare,
          "Message your child's class and subject teachers.",
        ),
      ],
    },
  ],
};

export function roleHref(role: DemoRole, slug = "") {
  return "/demo/" + role + (slug ? "/" + slug : "");
}

export function navItems(role: DemoRole) {
  return navigation[role].flatMap((group) =>
    group.items.map((entry) => ({ ...entry, group: group.label })),
  );
}

export function findNavItem(role: DemoRole, slug: string) {
  return navItems(role).find((entry) => entry.slug === slug);
}

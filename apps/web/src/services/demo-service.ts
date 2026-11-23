import { academicRecords, platformUser } from "@/mocks/academics";
import { schools } from "@/mocks/schools";
import type {
  DemoChart,
  DemoPanel,
  DemoRole,
  DemoRow,
  DemoStat,
  SchoolId,
} from "@/types/demo";

const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const number = (value: number) => new Intl.NumberFormat("en").format(value);
const panel = (
  id: string,
  title: string,
  rows: DemoRow[],
  description?: string,
): DemoPanel => ({ id, title, rows, description });
const stat = (
  label: string,
  value: string | number,
  note: string,
  icon: DemoStat["icon"],
): DemoStat => ({
  label,
  value: typeof value === "number" ? number(value) : value,
  note,
  icon,
});
const chart = (
  title: string,
  description: string,
  values: number[],
  unit: DemoChart["unit"] = "%",
): DemoChart => ({ title, description, labels: months, values, unit });

export function listDemoSchools() {
  return schools;
}

export function getDemoDashboard(
  role: DemoRole,
  schoolId: SchoolId,
  childId?: string,
) {
  const school = schools.find((item) => item.id === schoolId);
  const records = academicRecords.find((item) => item.schoolId === schoolId);
  if (!school || !records) return undefined;
  const children = records.learners.filter(({ id }) =>
    records.childIds.includes(id),
  );
  const student =
    role === "parent"
      ? (children.find(({ id }) => id === childId) ?? children[0])
      : records.learners[0];
  const classroom = records.classes.find(({ id }) => id === student.classId)!;
  const subjects = classroom.subjects;
  const assignments = [
    {
      title: subjects[0] + " practice",
      detail: classroom.label + " · Exercise set",
      meta: "Tomorrow",
    },
    {
      title: subjects[1] + " reflection",
      detail: classroom.label + " · Written response",
      meta: "Friday",
    },
  ];
  const assessments = [
    {
      title: subjects[0] + " unit quiz",
      detail: classroom.label + " · 20 minutes",
      meta: "21 Nov",
    },
    {
      title: subjects[2] + " assessment",
      detail: classroom.label,
      meta: "28 Nov",
    },
  ];
  const schedule = subjects.slice(0, 2).map((title, index) => ({
    title,
    detail: classroom.label + " · Room " + (105 + index),
    meta: index === 0 ? "09:00" : "10:30",
  }));
  const notify = (rows: DemoRow[]) => rows.slice(0, 2);
  const base = {
    school,
    children,
    child: student,
    courses: [] as { title: string; progress: number }[],
    notifications: notify(records.announcements),
  };

  switch (role) {
    case "super-admin":
      return {
        ...base,
        person: platformUser,
        stats: [
          stat("Total schools", schools.length, "Platform-wide", "schools"),
          stat(
            "Active schools",
            schools.filter(({ status }) => status === "Active").length,
            "1 institution on trial",
            "classes",
          ),
          stat(
            "Total students",
            schools.reduce((sum, item) => sum + item.students, 0),
            "Across demo institutions",
            "students",
          ),
          stat(
            "Total teachers",
            schools.reduce((sum, item) => sum + item.teachers, 0),
            "Across demo institutions",
            "teachers",
          ),
        ],
        chart: chart(
          "School growth",
          "Institutions on the demo platform",
          [1, 1, 2, 2, 3, 3],
          "",
        ),
        panels: [
          panel(
            "schools",
            "School management preview",
            schools.map((item) => ({
              title: item.name,
              detail:
                item.location + " · " + number(item.students) + " students",
              meta: item.status,
            })),
            "Platform-wide institution directory",
          ),
          panel(
            "subscriptions",
            "Subscription overview",
            schools.map((item) => ({
              title: item.name,
              detail: item.plan + " plan",
              meta: item.status,
            })),
            "Simulated plans",
          ),
          panel("school-context", "Selected school snapshot", [
            {
              title: school.name,
              detail:
                school.location + " · " + number(school.students) + " students",
              meta: school.plan,
            },
          ]),
          panel("activity", "Recent platform activity", [
            {
              title: "Trial workspace activated",
              detail: "Cedar Grove College",
              meta: "Today",
            },
            {
              title: "Platform report published",
              detail: "November institution summary",
              meta: "Yesterday",
            },
          ]),
        ],
        notifications: [
          {
            title: "New school on trial",
            detail: "Cedar Grove College",
            meta: "Today",
          },
        ],
      };
    case "school-admin":
      return {
        ...base,
        person: records.admin,
        stats: [
          stat(
            "Total students",
            school.students,
            "Enrolled this term",
            "students",
          ),
          stat("Total teachers", school.teachers, "Active faculty", "teachers"),
          stat(
            "Active classes",
            school.classes,
            "Across all year groups",
            "classes",
          ),
          stat(
            "Today's attendance",
            school.attendance + "%",
            "Current school day",
            "attendance",
          ),
        ],
        chart: chart(
          "Academic performance",
          "Average assessment score by month",
          records.scores,
        ),
        panels: [
          panel("announcements", "Recent announcements", records.announcements),
          panel("events", "Upcoming events", records.events),
          panel(
            "marketing",
            "Marketing insights",
            ["Instagram", "Facebook", "Google Business Profile"].map(
              (title, index) => ({
                title,
                detail: [
                  "Accounts reached",
                  "Post impressions",
                  "Profile interactions",
                ][index],
                meta: number(records.marketing[index]),
              }),
            ),
            "Simulated integrations · last 30 days",
          ),
        ],
      };
    case "teacher": {
      const assignedClasses = records.classes.filter(({ id }) =>
        records.teacherClassIds.includes(id),
      );
      const teachingSchedule = assignedClasses.map((group, index) => ({
        title: group.subjects[0],
        detail: group.label + " · Room " + (105 + index),
        meta: index === 0 ? "09:00" : "10:30",
      }));
      return {
        ...base,
        person: records.teacher,
        stats: [
          stat(
            "Assigned classes",
            records.teacherClassIds.length,
            "Current school term",
            "classes",
          ),
          stat(
            "Today's lessons",
            teachingSchedule.length,
            "On your teaching schedule",
            "calendar",
          ),
          stat("To review", assignments.length, "Assignment groups", "tasks"),
          stat(
            "Upcoming assessments",
            assessments.length,
            "On your assessment calendar",
            "attendance",
          ),
        ],
        chart: chart(
          "Student performance",
          "Average scores across your classes",
          records.scores,
        ),
        panels: [
          panel("schedule", "Today's teaching schedule", teachingSchedule),
          panel(
            "classes",
            "Assigned classes",
            records.classes
              .filter(({ id }) => records.teacherClassIds.includes(id))
              .map(({ label }) => ({
                title: label,
                detail: subjects.join(" · "),
              })),
          ),
          panel("assignments", "Assignments to review", assignments),
          panel("doubts", "Recent anonymous doubts", records.doubts),
          panel("assessments", "Upcoming assessments", assessments),
        ],
      };
    }
    case "student":
      return {
        ...base,
        person: student,
        stats: [
          stat(
            "Today's classes",
            schedule.length,
            "On your timetable",
            "classes",
          ),
          stat(
            "Pending homework",
            assignments.length,
            "To submit this week",
            "tasks",
          ),
          stat("Upcoming quizzes", 1, "On your quiz calendar", "calendar"),
          stat(
            "Attendance",
            student.attendance + "%",
            "This academic year",
            "attendance",
          ),
        ],
        chart: chart(
          "Learning progress",
          "Your assessment scores by month",
          student.scores,
        ),
        panels: [
          panel("schedule", "Today's classes", schedule),
          panel("homework", "Pending homework", assignments),
          panel("quizzes", "Upcoming quizzes", assessments.slice(0, 1)),
        ],
        courses: subjects.map((title, index) => ({
          title,
          progress: student.courses[index],
        })),
      };
    case "parent":
      return {
        ...base,
        person: records.parent,
        stats: [
          stat(
            "Linked children",
            children.length,
            "In this school",
            "students",
          ),
          stat(
            "Attendance",
            student.attendance + "%",
            "This academic year",
            "attendance",
          ),
          stat(
            "Homework completion",
            student.homework + "%",
            "Assignments submitted",
            "tasks",
          ),
          stat(
            "Latest assessment",
            student.scores.at(-1) + "%",
            "Most recent result",
            "classes",
          ),
        ],
        chart: chart(
          "Academic performance",
          student.name + " · monthly assessment scores",
          student.scores,
        ),
        panels: [
          panel(
            "children",
            "Linked children",
            children.map(({ name, classId }) => ({
              title: name,
              detail:
                records.classes.find(({ id }) => id === classId)?.label ?? "",
            })),
          ),
          panel("exams", "Upcoming exams", assessments),
          panel(
            "announcements",
            "Teacher announcements",
            records.announcements,
          ),
        ],
      };
  }
}

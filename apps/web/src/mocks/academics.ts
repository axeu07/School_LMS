import type {
  DemoRow,
  DemoRole,
  Learner,
  Person,
  SchoolId,
} from "@/types/demo";

type Classroom = {
  id: string;
  schoolId: SchoolId;
  label: string;
  subjects: [string, string, string];
};
type SchoolRecords = {
  schoolId: SchoolId;
  admin: Person;
  parent: Person;
  teacher: Person;
  teacherClassIds: string[];
  childIds: string[];
  learners: Learner[];
  classes: Classroom[];
  /**
   * A Class 10 learner in their own section, separate from the parent's
   * family, so the senior (Grade 9+) student experience can be demoed.
   */
  senior: Learner;
  seniorClass: Classroom;
  announcements: DemoRow[];
  events: DemoRow[];
  doubts: DemoRow[];
  scores: number[];
  marketing: [number, number, number];
};

function makeSchoolRecords(
  schoolId: SchoolId,
  names: [string, string, string, string, string],
  classLabels: [string, string],
  subjects: [string, string, string],
  event: string,
  doubt: string,
  offset: number,
  [seniorName, seniorLabel]: [string, string],
): SchoolRecords {
  const [admin, teacher, parent, firstChild, secondChild] = names;
  const makePerson = (id: string, name: string) => ({
    id: schoolId + "-" + id,
    schoolId,
    name,
  });
  const classes = classLabels.map((label, index) => ({
    id: schoolId + "-class-" + index,
    schoolId,
    label,
    subjects,
  }));
  const learners = [firstChild, secondChild].map((name, index) => ({
    ...makePerson("student-" + index, name),
    classId: classes[index].id,
    attendance: 97 - offset - index * 5,
    homework: 89 - offset - index * 15,
    scores: [70, 74, 72, 82, 79, 90].map(
      (score) => score - offset + index * ((score % 6) - 4),
    ),
    courses: [84, 62, 73].map((progress) => progress - offset - index * 12),
  }));
  const seniorClass = {
    id: schoolId + "-class-senior",
    schoolId,
    label: seniorLabel,
    subjects,
  };
  const senior = {
    ...makePerson("student-senior", seniorName),
    classId: seniorClass.id,
    attendance: 95 - offset,
    homework: 91 - offset,
    scores: [78, 81, 76, 84, 86, 88].map((score) => score - offset),
    courses: [71, 58, 66].map((progress) => progress - offset),
  };
  return {
    schoolId,
    admin: makePerson("admin", admin),
    teacher: makePerson("teacher", teacher),
    parent: makePerson("parent", parent),
    classes,
    teacherClassIds: classes.map(({ id }) => id),
    learners,
    childIds: learners.map(({ id }) => id),
    senior,
    seniorClass,
    announcements: [
      {
        title: "A note from " + teacher,
        detail: "Revision materials are ready for " + classLabels[0],
        meta: "Today",
      },
      {
        title: event + " registration",
        detail: "Sign-up closes Friday",
        meta: "Yesterday",
      },
    ],
    events: [
      { title: event, detail: "Main campus", meta: "18 Nov" },
      {
        title: "Parent–teacher meetings",
        detail: "Classrooms",
        meta: "25 Nov",
      },
    ],
    doubts: [
      { title: doubt, detail: subjects[0] + " · Anonymous", meta: "New" },
    ],
    scores: [69, 76, 74, 83, 79, 88].map((score) => score - offset),
    marketing: [2480 - offset * 82, 1460 - offset * 41, 718 - offset * 19],
  };
}

export const academicRecords = [
  makeSchoolRecords(
    "westfield",
    ["Amelia Brooks", "Maya Patel", "Jordan Chen", "Avery Chen", "Robin Chen"],
    ["Grade 8 · A", "Grade 7 · B"],
    ["Mathematics", "General Science", "English"],
    "Westfield Science Fair",
    "Why does a negative times a negative give a positive?",
    0,
    ["Aarav Sharma", "Grade 10 · A"],
  ),
  makeSchoolRecords(
    "harborview",
    ["Nisha Rao", "Leena Das", "Dev Menon", "Kiran Menon", "Isha Menon"],
    ["Year 9 · Blue", "Year 8 · Gold"],
    ["Statistics", "Marine Biology", "Literature"],
    "Harborview Coastal Showcase",
    "How do I tell a sample from a population?",
    5,
    ["Meera Iyer", "Year 10 · Blue"],
  ),
  makeSchoolRecords(
    "cedar",
    ["Rafael D'Souza", "Anika Shah", "Priya Mehta", "Neel Mehta", "Tara Mehta"],
    ["Year 1 · A", "Foundation · B"],
    ["Applied Algebra", "Environmental Studies", "Communication"],
    "Cedar Grove Arts Week",
    "When should I factor a quadratic equation?",
    9,
    ["Rohan Verma", "Grade 10 · A"],
  ),
] satisfies SchoolRecords[];

export const platformUser: Person = {
  id: "platform-admin",
  schoolId: "westfield",
  name: "Morgan Reed",
};

export const roleProfiles: Record<
  DemoRole,
  { label: string; short: string; description: string; focus: string }
> = {
  "super-admin": {
    label: "Super Admin",
    short: "Platform",
    description: "Oversee institutions and subscriptions across ACADMAXIS.",
    focus: "Schools, subscriptions and platform activity.",
  },
  "school-admin": {
    label: "School Admin",
    short: "School operations",
    description: "See attendance, academic performance and school updates.",
    focus: "Academic performance and school operations at a glance.",
  },
  teacher: {
    label: "Teacher",
    short: "Teaching",
    description:
      "Manage the teaching day, review work and surface student doubts.",
    focus: "Your teaching schedule and what needs your attention.",
  },
  student: {
    label: "Student",
    short: "Learning",
    description:
      "Track coursework, stay ahead of deadlines and practice daily.",
    focus: "Your classes, recent progress and upcoming work.",
  },
  parent: {
    label: "Parent",
    short: "Family",
    description:
      "Follow attendance, homework and academic progress for your children.",
    focus: "Keep up with each child's progress and school updates.",
  },
};

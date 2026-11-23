export const demoRoles = [
  "super-admin",
  "school-admin",
  "teacher",
  "student",
  "parent",
] as const;

export type DemoRole = (typeof demoRoles)[number];
export type SchoolId = "westfield" | "harborview" | "cedar";
export type School = {
  id: SchoolId;
  name: string;
  initials: string;
  location: string;
  students: number;
  teachers: number;
  classes: number;
  attendance: number;
  plan: string;
  status: "Active" | "Trial";
};

export type Person = { id: string; schoolId: SchoolId; name: string };
export type Learner = Person & {
  classId: string;
  attendance: number;
  homework: number;
  scores: number[];
  courses: number[];
};
export type DemoRow = { title: string; detail: string; meta?: string };
export type DemoStat = {
  label: string;
  value: string;
  note: string;
  icon:
    | "students"
    | "teachers"
    | "classes"
    | "attendance"
    | "tasks"
    | "schools"
    | "calendar";
};
export type DemoPanel = {
  id: string;
  title: string;
  description?: string;
  rows: DemoRow[];
};
export type DemoChart = {
  title: string;
  description: string;
  labels: string[];
  values: number[];
  unit: "%" | "";
};

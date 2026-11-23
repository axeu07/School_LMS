import type { DemoRole, SchoolId } from "@/types/demo";

export type AcademicTables = {
  years: { name: string; start: string; end: string; status: string };
  sections: {
    grade: string;
    name: string;
    year: string;
    capacity: string;
    coordinator: string;
    status: string;
  };
  subjects: { name: string; code: string };
  teachers: {
    name: string;
    email: string;
    availability: string;
    status: string;
  };
  allocations: { teacher: string; subject: string; section: string };
  students: { name: string; code: string };
  enrollments: { student: string; section: string; status: string };
  guardians: { name: string; email: string };
  links: {
    guardian: string;
    student: string;
    relationship: string;
    primary: string;
  };
  sessions: {
    allocation: string;
    day: string;
    start: string;
    end: string;
    room: string;
  };
  announcements: {
    name: string;
    message: string;
    audience: string;
    section: string;
    status: string;
  };
};
export type AcademicTable = keyof AcademicTables;
export type Entry<K extends AcademicTable> = AcademicTables[K] & { id: string };
export type Assignment = {
  id: string;
  allocation: string;
  title: string;
  instructions: string;
  due: string;
  maximum: number;
  published: boolean;
};
export type Submission = {
  assignment: string;
  student: string;
  text: string;
  status: "Draft" | "Submitted" | "Graded" | "Revision required";
  marks?: number;
  feedback?: string;
};
export type AttendanceStatus = "Present" | "Absent" | "Late";
export type Attendance = {
  section: string;
  date: string;
  marks: Record<string, AttendanceStatus>;
};
export type AcademicSchool = { [K in AcademicTable]: Entry<K>[] } & {
  assignments: Assignment[];
  submissions: Submission[];
  attendance: Attendance[];
};
export type AcademicState = {
  version: 1;
  schools: Record<SchoolId, AcademicSchool>;
};
export type Actor = { role: DemoRole; school: SchoolId };

export const academicTables = [
  "years",
  "sections",
  "subjects",
  "teachers",
  "allocations",
  "students",
  "enrollments",
  "guardians",
  "links",
  "sessions",
  "announcements",
] as const;

export function schoolRecords(state: AcademicState, school: SchoolId) {
  return state.schools[school];
}

export function linkedStudents(school: AcademicSchool, guardian: string) {
  const ids = new Set(
    school.links
      .filter((link) => link.guardian === guardian)
      .map((link) => link.student),
  );
  return school.students.filter((student) => ids.has(student.id));
}

export function currentEnrollment(school: AcademicSchool, student: string) {
  const year = school.years.find((item) => item.status === "Active");
  return school.enrollments.find(
    (item) =>
      item.student === student &&
      item.status === "Enrolled" &&
      school.sections.some(
        (section) =>
          section.id === item.section &&
          section.year === year?.id &&
          section.status === "Active",
      ),
  );
}

export function visibleAnnouncements(
  school: AcademicSchool,
  role: DemoRole,
  id: string,
  child?: string,
) {
  if (role === "super-admin") return [];
  if (role === "school-admin") return school.announcements;
  const student =
    role === "parent"
      ? linkedStudents(school, id).find((item) => item.id === child)?.id
      : id;
  const enrollment = student && currentEnrollment(school, student);
  const sections =
    role === "teacher"
      ? school.allocations
          .filter((item) => item.teacher === id)
          .map((item) => item.section)
      : enrollment
        ? [enrollment.section]
        : [];
  return school.announcements.filter(
    (item) =>
      item.status === "Published" &&
      (item.audience === "All" || item.audience === role) &&
      (!item.section || sections.includes(item.section)),
  );
}

export function requireRule(valid: unknown, message: string): asserts valid {
  if (!valid) throw new Error(message);
}

export function validDate(value: string) {
  const date = new Date(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(+date) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function saveAcademicRecord<K extends AcademicTable>(
  state: AcademicState,
  actor: Actor,
  table: K,
  record: Entry<K>,
): AcademicState {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can change academic records.",
  );
  const school = schoolRecords(state, actor.school);
  requireRule(school, "Select a valid school.");
  requireRule(
    !Object.entries(state.schools).some(
      ([id, other]) =>
        id !== actor.school &&
        academicTables.some((key) =>
          other[key].some((item) => item.id === record.id),
        ),
    ),
    "This record belongs to another school.",
  );
  const value = Object.fromEntries(
    Object.entries(record).map(([key, field]) => [key, String(field).trim()]),
  ) as unknown as Entry<K>;
  const fields = value as Record<string, string>;
  const get = <T extends AcademicTable>(key: T, id: string) => {
    const match = (school[key] as unknown as Entry<T>[]).find(
      (item) => item.id === id,
    );
    requireRule(match, "Select a record from this school.");
    return match;
  };
  const unique = (key: AcademicTable, names: string[]) =>
    !school[key].some(
      (item) =>
        item.id !== value.id &&
        names.every(
          (name) =>
            (item as Record<string, string>)[name]?.toLowerCase() ===
            fields[name]?.toLowerCase(),
        ),
    );
  const needed = (...keys: string[]) =>
    requireRule(
      keys.every((key) => fields[key]),
      "Complete all required fields.",
    );
  const allowed = (key: string, choices: string[]) =>
    requireRule(choices.includes(fields[key]), "Select a valid " + key + ".");
  let next = { ...school };
  switch (table) {
    case "years": {
      needed("name");
      allowed("status", ["Draft", "Active", "Archived"]);
      requireRule(
        validDate(fields.start) &&
          validDate(fields.end) &&
          fields.start < fields.end,
        "Enter valid dates with the start before the end.",
      );
      requireRule(
        unique("years", ["name"]),
        "That academic year already exists.",
      );
      if (fields.status === "Active") {
        requireRule(
          school.years.find((year) => year.id === value.id)?.status !==
            "Archived",
          "Restore the archived year to Draft before activating it.",
        );
        next = {
          ...next,
          years: school.years.map((year) =>
            year.status === "Active" ? { ...year, status: "Draft" } : year,
          ),
        };
      }
      break;
    }
    case "sections": {
      needed("grade", "name");
      allowed("status", ["Active", "Archived"]);
      const year = get("years", fields.year);
      if (fields.coordinator) get("teachers", fields.coordinator);
      const roster = school.enrollments.filter(
        (item) => item.section === value.id,
      );
      requireRule(
        Number.isInteger(+fields.capacity) &&
          +fields.capacity > 0 &&
          +fields.capacity >=
            roster.filter((item) => item.status === "Enrolled").length,
        "Capacity must be a positive whole number and cover current enrollments.",
      );
      requireRule(
        !roster.length ||
          school.sections.find((item) => item.id === value.id)?.year ===
            fields.year,
        "A section with enrollment history must stay in its academic year.",
      );
      requireRule(
        fields.status === "Archived" || year.status !== "Archived",
        "Choose an open academic year.",
      );
      requireRule(
        unique("sections", ["grade", "name", "year"]),
        "This section already exists in the academic year.",
      );
      break;
    }
    case "subjects":
    case "students":
      needed("name", "code");
      requireRule(unique(table, ["code"]), "This code is already in use.");
      break;
    case "teachers":
    case "guardians":
      needed("name", "email");
      requireRule(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email),
        "Enter a valid fictional email address.",
      );
      requireRule(unique(table, ["email"]), "This email is already in use.");
      if (table === "teachers") allowed("status", ["Active", "Inactive"]);
      break;
    case "allocations":
      get("subjects", fields.subject);
      requireRule(
        get("teachers", fields.teacher).status === "Active",
        "Choose an active teacher.",
      );
      requireRule(
        get("sections", fields.section).status === "Active",
        "Choose an active section.",
      );
      requireRule(
        unique("allocations", ["teacher", "subject", "section"]),
        "This teacher allocation already exists.",
      );
      requireRule(
        !(
          school.sessions.some((session) => session.allocation === value.id) ||
          school.assignments.some((item) => item.allocation === value.id)
        ) ||
          school.allocations.some(
            (item) =>
              item.id === value.id &&
              item.teacher === fields.teacher &&
              item.section === fields.section,
          ),
        "An allocation with sessions or assignments must keep its teacher and section.",
      );
      break;
    case "enrollments": {
      get("students", fields.student);
      allowed("status", ["Enrolled", "Withdrawn"]);
      const section = get("sections", fields.section);
      requireRule(
        fields.status === "Withdrawn" ||
          (section.status === "Active" &&
            get("years", section.year).status !== "Archived"),
        "Choose an open section and year.",
      );
      requireRule(
        !school.enrollments.some(
          (item) =>
            item.id !== value.id &&
            item.student === fields.student &&
            school.sections.find((group) => group.id === item.section)?.year ===
              section.year,
        ),
        "This student already has an enrollment in that academic year.",
      );
      requireRule(
        fields.status === "Withdrawn" ||
          school.enrollments.filter(
            (item) =>
              item.id !== value.id &&
              item.section === section.id &&
              item.status === "Enrolled",
          ).length < +section.capacity,
        "This section is at capacity.",
      );
      break;
    }
    case "links":
      get("guardians", fields.guardian);
      get("students", fields.student);
      needed("relationship");
      allowed("primary", ["Yes", "No"]);
      requireRule(
        unique("links", ["guardian", "student"]),
        "This guardian is already linked to the student.",
      );
      if (fields.primary === "Yes")
        next.links = school.links.map((item) =>
          item.student === fields.student ? { ...item, primary: "No" } : item,
        );
      break;
    case "sessions": {
      needed("room");
      allowed("day", [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]);
      const allocation = get("allocations", fields.allocation);
      const section = get("sections", allocation.section);
      requireRule(
        section.status === "Active" &&
          get("years", section.year).status !== "Archived" &&
          get("teachers", allocation.teacher).status === "Active",
        "Choose an open section and active teacher.",
      );
      const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      requireRule(
        time.test(fields.start) &&
          time.test(fields.end) &&
          fields.start < fields.end,
        "Enter a start time before the end time.",
      );
      const conflict = school.sessions.some((session) => {
        if (
          session.id === value.id ||
          session.day !== fields.day ||
          session.start >= fields.end ||
          session.end <= fields.start
        )
          return false;
        const other = get("allocations", session.allocation);
        return (
          get("sections", other.section).year === section.year &&
          (other.teacher === allocation.teacher ||
            other.section === allocation.section)
        );
      });
      requireRule(
        !conflict,
        "The teacher or section already has an overlapping session.",
      );
      break;
    }
    case "announcements":
      needed("name", "message");
      allowed("audience", ["All", "teacher", "student", "parent"]);
      allowed("status", ["Draft", "Published"]);
      if (fields.section) get("sections", fields.section);
      break;
  }
  const rows = next[table] as unknown as Entry<K>[];
  return {
    ...state,
    schools: {
      ...state.schools,
      [actor.school]: {
        ...next,
        [table]: rows.some((item) => item.id === value.id)
          ? rows.map((item) => (item.id === value.id ? value : item))
          : [...rows, value],
      },
    },
  };
}

export function removeAcademicRecord(
  state: AcademicState,
  actor: Actor,
  table: "links" | "sessions" | "announcements",
  id: string,
) {
  requireRule(
    actor.role === "school-admin",
    "Only the school administrator can remove academic records.",
  );
  const school = schoolRecords(state, actor.school);
  requireRule(
    school?.[table].some((item) => item.id === id),
    "This record is unavailable in this school.",
  );
  return {
    ...state,
    schools: {
      ...state.schools,
      [actor.school]: {
        ...school,
        [table]: school[table].filter((item) => item.id !== id),
      },
    },
  };
}

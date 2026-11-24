import { academicRecords } from "@/mocks/academics";
import {
  academicTables,
  type AcademicSchool,
  type AcademicState,
  type Attendance,
} from "./academic-model";

/** Teaches the Class 10 section only, so the Grade 8 teacher's load is unchanged. */
const seniorTeachers: Record<string, string> = {
  westfield: "Helen Mathur",
  harborview: "Arjun Pillai",
  cedar: "Grace Fernandes",
};

const substituteTeachers: Record<string, string> = {
  westfield: "Daniel Okafor",
  harborview: "Farah Iqbal",
  cedar: "Marcus Lee",
};

type Source = (typeof academicRecords)[number];

/**
 * The Class 10 section studies every subject with its own teacher, spread
 * across the week.
 */
function seniorRows(source: Source, subjects: { id: string; name: string }[]) {
  const section = source.seniorClass.id;
  const student = source.senior.id;
  const slots = [
    { day: "Tuesday", start: "09:00", end: "09:45", room: "Room 210" },
    { day: "Wednesday", start: "10:30", end: "11:15", room: "Lab 2" },
    { day: "Thursday", start: "09:00", end: "09:45", room: "Library" },
  ];
  const allocation = (index: number) => section + "-allocation-" + index;
  const teacher = source.schoolId + "-teacher-senior";
  return {
    teacher: {
      id: teacher,
      name: seniorTeachers[source.schoolId],
      email: source.schoolId + ".senior@example.test",
      availability: "Monday–Friday, 08:00–15:00",
      status: "Active",
    },
    allocations: subjects.map((subject, index) => ({
      id: allocation(index),
      teacher,
      section,
      subject: subject.id,
    })),
    sessions: slots.map((slot, index) => ({
      id: section + "-session-" + index,
      allocation: allocation(index),
      ...slot,
    })),
    assignments: [
      {
        id: section + "-board-practice",
        allocation: allocation(0),
        title: "Board exam practice: " + subjects[0].name,
        instructions:
          "Attempt section B of last year's board paper under timed conditions and show full working for each answer.",
        due: "2027-02-10",
        maximum: 40,
        published: true,
      },
      {
        id: section + "-reading-notes",
        allocation: allocation(2),
        title: subjects[2].name + " chapter notes",
        instructions:
          "Summarise the prescribed chapter in under 300 words and note two questions you would ask in class.",
        due: "2027-01-20",
        maximum: 20,
        published: true,
      },
    ],
    attendance: ["2026-11-17", "2026-11-18", "2026-11-19"].map(
      (date): Attendance => ({
        section,
        date,
        marks: { [student]: "Present" },
      }),
    ),
  };
}

export const academicSeed: AcademicState = {
  version: 1,
  schools: Object.fromEntries(
    academicRecords.map((source) => {
      const prefix = source.schoolId;
      const year = prefix + "-year";
      const previous = prefix + "-previous";
      const subjects = source.classes[0].subjects.map((name, index) => ({
        id: prefix + "-subject-" + index,
        name,
        code: "SUB-" + (index + 1),
      }));
      const senior = seniorRows(source, subjects);
      const school: AcademicSchool = {
        years: [
          {
            id: year,
            name: "2026–2027",
            start: "2026-06-01",
            end: "2027-05-31",
            status: "Active",
          },
          {
            id: previous,
            name: "2025–2026",
            start: "2025-06-01",
            end: "2026-05-31",
            status: "Archived",
          },
        ],
        sections: [...source.classes, source.seniorClass].map(
          ({ id, label }) => {
            const [grade, name] = label.split(" · ");
            return {
              id,
              grade,
              name,
              year,
              capacity: "30",
              coordinator: source.teacher.id,
              status: "Active",
            };
          },
        ),
        subjects,
        teachers: [
          {
            id: source.teacher.id,
            name: source.teacher.name,
            email: prefix + ".teacher@example.test",
            availability: "Monday–Friday, 08:00–15:00",
            status: "Active",
          },
          {
            // A second faculty member without allocations, available to cover
            // sessions when a colleague is on approved leave.
            id: prefix + "-teacher-2",
            name: substituteTeachers[prefix],
            email: prefix + ".faculty@example.test",
            availability: "Monday–Friday, 08:00–15:00",
            status: "Active",
          },
          senior.teacher,
        ],
        allocations: source.classes
          .map((item, index) => ({
            id: item.id + "-allocation",
            teacher: source.teacher.id,
            section: item.id,
            subject: subjects[index].id,
          }))
          .concat(senior.allocations),
        students: [...source.learners, source.senior].map(
          ({ id, name }, index) => ({
            id,
            name,
            code: "ST-" + (index + 1),
          }),
        ),
        enrollments: [...source.learners, source.senior].map(
          ({ id, classId }) => ({
            id: id + "-enrollment",
            student: id,
            section: classId,
            status: "Enrolled",
          }),
        ),
        guardians: [
          {
            id: source.parent.id,
            name: source.parent.name,
            email: prefix + ".family@example.test",
          },
          {
            id: prefix + "-guardian",
            name: "Sam Rivera",
            email: prefix + ".guardian@example.test",
          },
        ],
        links: [
          ...source.childIds.map((student) => ({
            id: student + "-link",
            guardian: source.parent.id,
            student,
            relationship: "Parent",
            primary: "Yes",
          })),
          {
            id: prefix + "-secondary-link",
            guardian: prefix + "-guardian",
            student: source.childIds[0],
            relationship: "Guardian",
            primary: "No",
          },
        ],
        sessions: source.classes
          .map(({ id }, index) => ({
            id: id + "-session",
            allocation: id + "-allocation",
            day: "Monday",
            start: index ? "10:30" : "09:00",
            end: index ? "11:15" : "09:45",
            room: "Room " + (105 + index),
          }))
          .concat(senior.sessions),
        assignments: source.classes
          .map(({ id }, index) => ({
            id: id + "-practice",
            allocation: id + "-allocation",
            title: subjects[index].name + " practice",
            instructions:
              "Explain one concept from the current unit in your own words and give a worked example.",
            due: "2027-05-15",
            maximum: 20,
            published: true,
          }))
          .concat(senior.assignments),
        submissions: [],
        attendance: source.learners
          .flatMap(({ id, classId }, index) =>
            [
              "2026-11-16",
              "2026-11-17",
              "2026-11-18",
              "2026-11-19",
              "2026-11-20",
            ].map((date, day): Attendance => ({
              section: classId,
              date,
              marks: {
                [id]:
                  index === 0 && day === 2
                    ? "Late"
                    : index === 1 && day === 3
                      ? "Absent"
                      : "Present",
              },
            })),
          )
          .concat(senior.attendance),
        announcements: source.announcements.map(({ title, detail }, index) => ({
          id: prefix + "-notice-" + index,
          name: title,
          message: detail,
          audience: "All",
          section: "",
          status: "Published",
        })),
      };
      return [prefix, school];
    }),
  ) as AcademicState["schools"],
};

/**
 * Records saved before the Class 10 demo section existed get it added once,
 * keeping every other saved change. A school that already has the section
 * is left alone, so later edits to it are never undone.
 */
function withSeniorSection(data: AcademicState): AcademicState {
  let changed = false;
  const schools = { ...data.schools };
  for (const source of academicRecords) {
    const saved = schools[source.schoolId];
    const seed = academicSeed.schools[source.schoolId];
    const section = source.seniorClass.id;
    if (saved.sections.some((item) => item.id === section)) continue;
    const mine = <T extends { id: string }>(rows: T[]) =>
      rows.filter(
        (row) =>
          row.id.startsWith(section) ||
          row.id === source.senior.id ||
          row.id === source.senior.id + "-enrollment",
      );
    changed = true;
    schools[source.schoolId] = {
      ...saved,
      sections: [...saved.sections, ...mine(seed.sections)],
      teachers: [
        ...saved.teachers,
        ...seed.teachers.filter(
          (item) =>
            item.id === source.schoolId + "-teacher-senior" &&
            !saved.teachers.some((own) => own.id === item.id),
        ),
      ],
      allocations: [...saved.allocations, ...mine(seed.allocations)],
      students: [...saved.students, ...mine(seed.students)],
      enrollments: [...saved.enrollments, ...mine(seed.enrollments)],
      sessions: [...saved.sessions, ...mine(seed.sessions)],
      assignments: [...saved.assignments, ...mine(seed.assignments)],
      attendance: [
        ...saved.attendance,
        ...seed.attendance.filter((row) => row.section === section),
      ],
    };
  }
  return changed ? { ...data, schools } : data;
}

export function decodeAcademicState(raw: string | null): AcademicState {
  if (!raw) return academicSeed;
  try {
    const data = JSON.parse(raw) as AcademicState;
    if (data?.version !== 1 || !data.schools) return academicSeed;
    const valid = Object.entries(academicSeed.schools).every(([id, sample]) => {
      const school = data.schools[id as keyof AcademicState["schools"]];
      return (
        school &&
        Array.isArray(school.assignments) &&
        school.assignments.every(
          (row) =>
            row &&
            typeof row.id === "string" &&
            typeof row.allocation === "string" &&
            typeof row.title === "string" &&
            typeof row.instructions === "string" &&
            typeof row.due === "string" &&
            Number.isFinite(row.maximum) &&
            typeof row.published === "boolean",
        ) &&
        Array.isArray(school.submissions) &&
        school.submissions.every(
          (row) =>
            row &&
            typeof row.assignment === "string" &&
            typeof row.student === "string" &&
            typeof row.text === "string" &&
            ["Submitted", "Draft", "Graded", "Revision required"].includes(
              row.status,
            ),
        ) &&
        Array.isArray(school.attendance) &&
        school.attendance.every(
          (row) =>
            row &&
            typeof row.section === "string" &&
            typeof row.date === "string" &&
            row.marks &&
            typeof row.marks === "object" &&
            !Array.isArray(row.marks) &&
            Object.values(row.marks).every((mark) =>
              ["Present", "Absent", "Late"].includes(mark),
            ),
        ) &&
        academicTables.every(
          (key) =>
            Array.isArray(school[key]) &&
            school[key].every(
              (row) =>
                row &&
                Object.keys(sample[key][0]).every(
                  (field) =>
                    typeof (row as Record<string, unknown>)[field] === "string",
                ) &&
                row.id,
            ),
        )
      );
    });
    return valid ? withSeniorSection(data) : academicSeed;
  } catch {
    return academicSeed;
  }
}

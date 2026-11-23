import { academicRecords } from "@/mocks/academics";
import {
  academicTables,
  type AcademicSchool,
  type AcademicState,
} from "./academic-model";

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
        sections: source.classes.map(({ id, label }) => {
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
        }),
        subjects,
        teachers: [
          {
            id: source.teacher.id,
            name: source.teacher.name,
            email: prefix + ".teacher@example.test",
            availability: "Monday–Friday, 08:00–15:00",
            status: "Active",
          },
        ],
        allocations: source.classes.map((item, index) => ({
          id: item.id + "-allocation",
          teacher: source.teacher.id,
          section: item.id,
          subject: subjects[index].id,
        })),
        students: source.learners.map(({ id, name }, index) => ({
          id,
          name,
          code: "ST-" + (index + 1),
        })),
        enrollments: source.learners.map(({ id, classId }) => ({
          id: id + "-enrollment",
          student: id,
          section: classId,
          status: "Enrolled",
        })),
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
        sessions: source.classes.map(({ id }, index) => ({
          id: id + "-session",
          allocation: id + "-allocation",
          day: "Monday",
          start: index ? "10:30" : "09:00",
          end: index ? "11:15" : "09:45",
          room: "Room " + (105 + index),
        })),
        assignments: source.classes.map(({ id }, index) => ({
          id: id + "-practice",
          allocation: id + "-allocation",
          title: subjects[index].name + " practice",
          instructions:
            "Explain one concept from the current unit in your own words and give a worked example.",
          due: "2027-05-15",
          maximum: 20,
          published: true,
        })),
        submissions: [],
        attendance: source.learners.flatMap(({ id, classId }, index) =>
          [
            "2026-11-16",
            "2026-11-17",
            "2026-11-18",
            "2026-11-19",
            "2026-11-20",
          ].map((date, day) => ({
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
        ),
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
    return valid ? data : academicSeed;
  } catch {
    return academicSeed;
  }
}

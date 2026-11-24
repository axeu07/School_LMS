import { currentEnrollment, type AcademicSchool } from "./academic-model";

/**
 * Students up to Class 8 get the playful workspace; from Class 9 onwards the
 * workspace turns calm and book-like, closer to how older students study.
 */
export type StudentStage = "junior" | "senior";

export const seniorFromGrade = 9;

/** Reads the class number from a grade label such as "Grade 10" or "Year 9". */
export function stageForGrade(grade: string | undefined): StudentStage {
  const number = Number(grade?.match(/\d+/)?.[0]);
  return number >= seniorFromGrade ? "senior" : "junior";
}

export function studentStage(
  school: AcademicSchool,
  student: string,
): StudentStage {
  const enrollment = currentEnrollment(school, student);
  const section = school.sections.find(
    (item) => item.id === enrollment?.section,
  );
  return stageForGrade(section?.grade);
}

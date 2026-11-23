# Phase 5 frontend demo

From the repository root, run `npm.cmd run dev:web` and open `http://127.0.0.1:3000/demo/select-profile`. Use **Switch Demo Role** in the dashboard to walk through the same school under another fictional profile. No backend process is needed.

## Implemented workflows

| Role         | Available Phase 5 workflow                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| School Admin | Manage academic years, classes and sections, subjects, faculty, teaching allocations, students, enrollments, guardians, guardian links, weekly sessions and announcements. View attendance history and totals by section. |
| Teacher      | View the assigned timetable and published announcements. Draft or publish assignments, review student responses, return work for revision and grade it. Enter and edit roster attendance.                                 |
| Student      | View section announcements and timetable, save assignment drafts, submit work and read grades and feedback. View personal attendance.                                                                                     |
| Parent       | Switch between linked children and view each child's relevant announcements, homework, grades, feedback and attendance.                                                                                                   |
| Super Admin  | Existing Phase 4 overview and institution selector.                                                                                                                                                                       |

All workflows use existing role URLs. The sidebar links to academic management, assignment and attendance sections inside each dashboard. Academic management includes searchable directories, status filters, record details and editable forms. Remove actions are available for guardian relationships, sessions and announcements. Archive academic years and sections, mark staff inactive, or withdraw an enrollment using its status field.

## Shared records and persistence

`academic-model.ts` defines a versioned school-keyed snapshot. Each school has academic years, sections, subjects, faculty, allocations, students, enrollments, guardians, guardian links, recurring sessions, announcements, assignments, submissions and dated attendance. Enrollment references the student and section and inherits its academic year from the section. A teaching allocation binds a section, subject and teacher. Sessions and assignments reference a teaching allocation.

`academic-seed.ts` derives the initial academic roster from the three existing fictional schools. It loads defaults when records are missing, unreadable or use an unsupported schema version. `academic-store.ts` wraps localStorage and broadcasts updates through a React external store. Each mutation reads the latest available snapshot before applying changes. Storage is browser-specific and concurrent writes across tabs are last-writer-wins.

Use **School Admin → Academic management → Reset Demo Data** and confirm to restore the shared academic records for all three schools. The active school and child preferences are stored separately.

## Business rules

- An academic year has a unique identifier within its school and requires valid, ordered dates. Activating one year moves the previous active year to Draft. Restore an archived year to Draft before activating it.
- An enrollment must reference records from its own school. A student has at most one enrollment per academic year, and a section cannot exceed capacity. Historical enrollments remain available.
- An active teacher can be assigned to a section and subject. Recurring sessions enforce valid times and reject overlapping teacher or section sessions within an academic year.
- A student can have multiple guardians and one primary guardian. A parent sees student-specific data for a linked child.
- Published announcements can target a role and section. Draft announcements remain visible in School Admin.
- A teacher creates assignments against their own active allocations. Eligible students can save a draft and submit through the local-calendar deadline. A returned submission can be revised after the deadline. Grading requires feedback and marks in range.
- Attendance saves one section/date record for the roster. Present and Late count toward attendance. Edits replace existing marks for current roster members and retain historical marks for former members.

## Demo walkthrough

1. In School Admin, publish an announcement for a section. Switch to that school's Teacher, Student or Parent role and check its announcements. In Parent, switch children to verify targeting.
2. In Teacher, create and publish an assignment for the first teaching allocation. In Student, open the assignment and submit a response. In Teacher, grade it. In Student and Parent, open Assignment Results or Homework Tracking to see the grade and feedback.
3. In Teacher, mark a student absent for a date in the active academic year. Compare the Student and Parent attendance cards with School Admin's section history.

## Checks and next work

Run the frontend checks with `npm.cmd run typecheck --workspace @school-lms/web`, `npm.cmd run lint --workspace @school-lms/web`, `npm.cmd run build --workspace @school-lms/web`, and `node --test apps/web/tests/phase5.test.mjs` (Node 26 used for validation).

Continue Phase 5B with shared courses, units, lessons, resources, quizzes, and progress. Then build the Phase 5C learning features, Phase 5D parent communication and broader performance views, and Phase 5E SaaS administration and marketing insights. Legacy course, quiz, AI, and marketing displays remain Phase 4 previews. School Admin student profiles include enrollment, guardians, recorded attendance, and assignment grades.

For later integration, place REST adapters behind the existing selectors and write commands. Academic years, sections, subject allocations, enrollments and guardian relationships map to school-scoped academic resources. Assignment, submission, timetable, announcement and attendance resources should enforce relationships and uniqueness server-side and use database transactions for multi-record changes. Resolve user, school and child access on the backend before returning records. The frontend role switches are demo controls.

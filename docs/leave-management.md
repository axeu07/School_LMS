# Leave management and absence alerts

This frontend demo stores its data in the browser. No API, database or messaging services are involved, and no files are uploaded. Attachments are fictional metadata only.

## Routes

| Role         | Route                                 | Sidebar label        |
| ------------ | ------------------------------------- | -------------------- |
| Student      | `/demo/student/leave-requests`        | Leave Requests       |
| Parent       | `/demo/parent/leave-requests`         | Child Leave Requests |
| Teacher      | `/demo/teacher/leave-requests`        | Leave Requests       |
| School Admin | `/demo/school-admin/leave-management` | Leave Management     |

The Teacher page has two tabs: Student Leave Approvals and My Leave Requests. The School Admin page has four tabs: Escalated Student Leave, Teacher Leave Approvals, Leave Calendar and Leave Analytics. The dashboards of all four roles show a leave summary widget. The header bell lists leave and absence notifications, and each one can be marked as read.

## Workflows and statuses

- **Student or parent request:** the request is submitted as Pending Teacher. The class teacher approves it (Approved), rejects it with a reason (Rejected) or forwards it (Pending Admin). The School Admin approves or rejects forwarded requests.
- **Teacher request:** the request is submitted as Pending Admin. The School Admin approves or rejects it. Teachers cannot review teacher leave, including their own.
- **Drafts:** drafts are visible only to their creator. The creator can edit a draft or submit it.
- **Cancellation:** the submitter can cancel a draft or a pending request. Approved and rejected requests cannot be cancelled.
- **Activity timeline:** every submission, edit, forward, decision, cancellation and substitute assignment is recorded in the request's timeline.

The class teacher is the section coordinator. If the coordinator is inactive, an active teacher allocated to that section takes the role.

Validation rejects a request in any of these cases:

- dates are missing or invalid, or the end date is before the start date
- a half day is requested for more than one date
- the request covers more than 30 days
- the dates fall outside the active academic year
- the reason is shorter than 10 characters

Relationship rules:

- A student can apply only for their own current enrollment.
- A parent can apply only for a linked child.
- A teacher can apply only for themselves.

A submission is also rejected if it overlaps an active request (Pending Teacher, Pending Admin or Approved) for the same person. This applies whoever submitted it, so a student and a parent cannot both get approved leave for the same dates. The only exception is a morning half day and an afternoon half day on the same date, which do not overlap. The system checks for overlap again before approving a request.

For teacher leave, the system calculates the affected sessions from the weekly timetable. A half day covers sessions starting before 12:00 or from 12:00 onwards. The School Admin assigns substitute teachers per session. Only active teachers who are free at that time and not on approved leave that day can be assigned. The teacher's timetable page lists the affected sessions and the planned cover.

## How Approved Leave affects attendance

- Recorded attendance marks remain Present, Absent or Late, and leave decisions never change them.
- An Absent mark on a date covered by **approved** leave is displayed as **Approved Leave**.
- **Physical attendance % = (Present + Late) ÷ recorded marks.** Approved leave never counts as presence, so approving leave does not change this figure.
- The number of approved leave days is reported separately. The attendance history includes an Approved Leave column showing how many Absent marks are covered by approved leave.
- Pending, rejected and cancelled requests have no effect on attendance. A leave request never creates an attendance record.

## Absence alerts

When a teacher saves attendance, `recordAttendance` saves it through the existing attendance service. It then reconciles alerts for that section and date:

- An Absent mark creates one alert for each guardian linked to the student in that school. The alert uses the attendance record's date. Example: "Attendance Alert: Avery was marked absent in Grade 8-A on 20 November 2026. View attendance or submit a leave request."
- Saving the same record again does not create duplicates. Each alert is keyed by section, date, student and guardian.
- If the mark changes from Absent to Present or Late, the alert is marked Corrected. If it changes back to Absent, the same alert becomes active again.
- On the Child Leave Requests page, parents can open the attendance record. They can also start a leave request for that date with the date already filled in.

## Data and reset

- **Code:** the business logic is in `apps/web/src/services/leave-model.ts`. The seed data is in `leave-seed.ts` and the store is in `leave-store.ts`.
- **Store:** the store uses the shared `createLocalStore` layer under the key `school-lms-leave`. Its records are versioned and kept separately for each school. Every query and command checks the school ID.
- **Relationships:** enrollment, guardian links and the timetable are always read from the shared academic records, never copied into the leave store.
- **Seed data:** the seed is built by running the same commands the UI uses, and it covers every status.
- **Substitute teacher:** each school has a second fictional teacher who can be assigned as cover.
- **Reset:** School Settings → Reset Demo Data also restores the leave data.

Tests: `node --test apps/web/tests/leave.test.mjs`.

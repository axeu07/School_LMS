import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      return next(
        new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href,
        context,
      );
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    )
      return next(specifier + ".ts", context);
    return next(specifier, context);
  },
});

const cal = await import("../src/services/attendance-calendar.ts");

const school = {
  attendance: [
    { section: "s", date: "2026-11-16", marks: { a: "Present" } },
    { section: "s", date: "2026-11-17", marks: { a: "Late" } },
    { section: "s", date: "2026-11-18", marks: { a: "Absent" } },
    { section: "s", date: "2026-11-19", marks: { a: "Absent" } },
  ],
};
const approved = (kind, subject, start, end, duration) => ({
  kind,
  subject,
  start,
  end,
  duration,
  type: "Sick",
  status: "Approved",
});
const leave = {
  requests: [
    approved("student", "a", "2026-11-19", "2026-11-19", "First half"),
    approved("teacher", "t", "2026-11-17", "2026-11-17", "Full day"),
    approved("teacher", "t", "2026-11-18", "2026-11-18", "Second half"),
  ],
  notifications: [],
};

test("student days map marks, half-day leave, Sundays and holidays", () => {
  const days = cal.studentAttendanceDays(
    school,
    leave,
    "a",
    new Set(["2026-11-20"]),
    "2026-11-15",
    "2026-11-25",
    "2026-11-23",
  );
  const status = Object.fromEntries(days.map((d) => [d.date, d.status]));
  assert.equal(status["2026-11-15"], "holiday"); // Sunday
  assert.equal(status["2026-11-16"], "present");
  assert.equal(status["2026-11-17"], "present"); // late counts
  assert.equal(status["2026-11-18"], "absent");
  assert.equal(status["2026-11-19"], "half");
  assert.equal(status["2026-11-20"], "holiday");
  assert.equal(status["2026-11-21"], "none");
  assert.equal(status["2026-11-24"], "upcoming");
});

test("teacher days come from approved leave", () => {
  const days = cal.teacherAttendanceDays(
    leave,
    "t",
    new Set(),
    "2026-11-16",
    "2026-11-19",
    "2026-11-19",
  );
  assert.deepEqual(
    days.map((d) => d.status),
    ["present", "absent", "half", "present"],
  );
  assert.equal(cal.summarizeDays(days).percent, 63);
});

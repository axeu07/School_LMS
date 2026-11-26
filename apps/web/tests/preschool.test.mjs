import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(
        new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href,
        context,
      );
    }
    if (
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts")
    ) {
      return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});

const model = await import("../src/services/preschool-model.ts");
const { buildPreschoolSeed } =
  await import("../src/services/preschool-seed.ts");
const { academicDemoSeed } = await import("../src/services/academic-seed.ts");
const sim = await import("../src/services/transport-sim.ts");
const { preschool, sectionHidden, roleHidden } =
  await import("../src/features/preschool/config.ts");

const W = "westfield";
const day = "2026-11-26";
const now = day + "T09:00:00.000Z";
const records = academicDemoSeed.schools.westfield;
const seed = buildPreschoolSeed(day);
const s = (state) => state.schools.westfield;

const avery = "westfield-student-0"; // UKG · Sunflower, Jordan Chen's child
const robin = "westfield-student-1"; // LKG · Daisy, Jordan Chen's child
const ishaan = "westfield-kid-0"; // UKG · Sunflower, another family
const parent = { school: W, role: "parent", person: "westfield-parent" };
const otherParent = { school: W, role: "parent", person: "westfield-family-0" };
const teacher = { school: W, role: "teacher", person: "westfield-teacher" };
const admin = { school: W, role: "school-admin", person: "westfield-admin" };

test("preschool mode hides the student role and K-12 pages without deleting them", () => {
  assert.equal(preschool.enabled, true);
  assert.equal(roleHidden("student"), true);
  assert.equal(roleHidden("parent"), false);
  for (const slug of ["doubt-board", "assessments", "ai-tools", "courses"])
    assert.equal(sectionHidden("teacher", slug), true, slug);
  for (const slug of ["homework", "performance", "assessments"])
    assert.equal(sectionHidden("parent", slug), true, slug);
  assert.equal(sectionHidden("parent", "fees"), false);
  assert.equal(sectionHidden("teacher", "attendance"), false);
});

test("the demo roster gives each preschool class several children", () => {
  const sizes = records.sections.map(
    (section) =>
      records.enrollments.filter((item) => item.section === section.id).length,
  );
  assert.ok(
    sizes.every((size) => size >= 3),
    String(sizes),
  );
  assert.deepEqual(
    records.sections.map((item) => item.grade),
    ["UKG", "LKG", "Nursery"],
  );
});

test("parents see only their own children; teachers see their classes", () => {
  const mine = model.childrenFor(records, parent).map((item) => item.id);
  assert.deepEqual(mine.sort(), [avery, robin].sort());
  assert.equal(model.canSeeChild(records, otherParent, avery), false);
  assert.ok(model.childrenFor(records, teacher).length >= 10);
  assert.ok(model.childrenFor(records, admin).length >= 13);
});

test("diaries: teachers write and send, parents read only sent ones and reply", () => {
  const input = {
    student: ishaan,
    date: day,
    meals: { breakfast: "All", lunch: "Some", snack: "Most" },
    napStart: "12:00",
    napEnd: "12:45",
    mood: "happy",
    potty: 2,
    diaper: 0,
    activities: ["Painting"],
    note: "",
  };
  assert.throws(
    () => model.saveDiary(seed, records, parent, input, false, now, day),
    /teachers or the school office/,
  );
  assert.throws(
    () =>
      model.saveDiary(
        seed,
        records,
        teacher,
        { ...input, napEnd: "11:00" },
        false,
        now,
        day,
      ),
    /Nap must end/,
  );
  assert.throws(
    () => model.saveDiary(seed, records, teacher, input, true, now, day),
    /short note/,
  );
  assert.throws(
    () =>
      model.saveDiary(
        seed,
        records,
        teacher,
        { ...input, date: "2026-11-27" },
        false,
        now,
        day,
      ),
    /future/,
  );
  let state = model.saveDiary(
    seed,
    records,
    teacher,
    input,
    false,
    now,
    day,
    "d1",
  );
  const draft = model.diaryFor(s(state), ishaan, day);
  assert.equal(draft.status, "Draft");
  // A draft is invisible to the child's parent.
  assert.equal(
    model
      .visibleDiaries(s(state), records, otherParent)
      .some((d) => d.id === draft.id),
    false,
  );
  state = model.saveDiary(
    state,
    records,
    teacher,
    { ...input, note: "A happy painting day." },
    true,
    now,
    day,
  );
  const sent = model.diaryFor(s(state), ishaan, day);
  assert.equal(sent.id, draft.id, "the same diary is updated, not duplicated");
  assert.equal(sent.status, "Sent");
  assert.ok(
    model
      .visibleDiaries(s(state), records, otherParent)
      .some((d) => d.id === sent.id),
  );
  assert.equal(
    model
      .visibleDiaries(s(state), records, parent)
      .some((d) => d.student === ishaan),
    false,
  );
  state = model.markDiaryRead(state, records, otherParent, sent.id, now);
  assert.equal(model.diaryFor(s(state), ishaan, day).readAt, now);
  state = model.replyToDiary(
    state,
    records,
    otherParent,
    sent.id,
    "Thank you!",
  );
  assert.equal(model.diaryFor(s(state), ishaan, day).reply, "Thank you!");
  assert.throws(
    () => model.replyToDiary(state, records, parent, sent.id, "Hello"),
    /linked to this child/,
  );
});

test("pickup: parents add people for approval, and only approved people collect", () => {
  let state = model.addPickupPerson(
    seed,
    records,
    parent,
    {
      student: avery,
      name: "Uncle Sam",
      relation: "Uncle",
      phone: "98765 43210",
      photo: "",
    },
    "p1",
  );
  const added = s(state).pickupPeople.find((item) => item.id === "p1");
  assert.equal(added.status, "Pending approval");
  assert.equal(added.phone, "+91 98765 43210");
  assert.throws(
    () =>
      model.addPickupPerson(state, records, parent, {
        student: avery,
        name: "Bad",
        relation: "Uncle",
        phone: "12345",
        photo: "",
      }),
    /10-digit/,
  );
  // Avery is in school today; a pending person can't collect her.
  assert.equal(model.dayStatus(s(state), avery, day).state, "In school");
  assert.throws(
    () => model.checkOut(state, records, teacher, avery, "p1", day, "13:20"),
    /waiting for approval/,
  );
  assert.throws(
    () => model.approvePickupPerson(state, records, teacher, "p1"),
    /school office/,
  );
  state = model.approvePickupPerson(state, records, admin, "p1");
  state = model.checkOut(state, records, teacher, avery, "p1", day, "13:20");
  const status = model.dayStatus(s(state), avery, day);
  assert.equal(status.state, "Picked up");
  assert.equal(status.out.method, "Authorised person");
  assert.throws(
    () => model.checkOut(state, records, teacher, avery, "p1", day, "13:25"),
    /in school/,
  );
});

test("pickup passes are verified once, by OTP or QR code, on their own day", () => {
  const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  let i = 0;
  const random = () => values[i++ % values.length];
  assert.throws(
    () =>
      model.createPass(
        seed,
        records,
        teacher,
        {
          student: avery,
          date: day,
          name: "Anu",
          relation: "Aunt",
          phone: "9876543210",
          time: "13:00",
          note: "",
        },
        day,
        now,
      ),
    /parent linked/,
  );
  assert.throws(
    () =>
      model.createPass(
        seed,
        records,
        parent,
        {
          student: avery,
          date: "2026-12-10",
          name: "Anu",
          relation: "Aunt",
          phone: "9876543210",
          time: "13:00",
          note: "",
        },
        day,
        now,
      ),
    /up to a week/,
  );
  let state = model.createPass(
    seed,
    records,
    parent,
    {
      student: avery,
      date: day,
      name: "Anu Rao",
      relation: "Aunt",
      phone: "9876543210",
      time: "13:00",
      note: "",
    },
    day,
    now,
    random,
    "pass-1",
  );
  const pass = s(state).passes.find((item) => item.id === "pass-1");
  assert.match(pass.otp, /^\d{4}$/);
  assert.match(pass.code, /^OI-[A-Z2-9]{6}$/);
  assert.throws(
    () =>
      model.verifyPass(
        state,
        records,
        teacher,
        avery,
        "0000",
        day,
        now,
        "13:00",
      ),
    /doesn't match/,
  );
  assert.throws(
    () =>
      model.verifyPass(
        state,
        records,
        teacher,
        avery,
        pass.otp,
        "2026-11-27",
        now,
        "13:00",
      ),
    /another day/,
  );
  state = model.verifyPass(
    state,
    records,
    teacher,
    avery,
    pass.code.toLowerCase(),
    day,
    now,
    "13:05",
  );
  assert.equal(model.dayStatus(s(state), avery, day).out.method, "QR pass");
  assert.equal(
    s(state).passes.find((item) => item.id === "pass-1").status,
    "Used",
  );
  assert.throws(
    () =>
      model.verifyPass(
        state,
        records,
        teacher,
        avery,
        pass.otp,
        day,
        now,
        "13:06",
      ),
    /already been used/,
  );
  // The seeded pass for Robin works with its OTP.
  const robinPass = s(seed).passes.find((item) => item.student === robin);
  const verified = model.verifyPass(
    seed,
    records,
    teacher,
    robin,
    robinPass.otp,
    day,
    now,
    "13:30",
  );
  assert.equal(model.dayStatus(s(verified), robin, day).out.method, "OTP");
});

test("health records: parents edit, staff report incidents, parents acknowledge", () => {
  assert.throws(
    () => model.saveHealth(seed, records, teacher, avery, (p) => p, now),
    /parents or the school office/,
  );
  let state = model.saveHealth(
    seed,
    records,
    parent,
    avery,
    (profile) => ({ ...profile, bloodGroup: "A+" }),
    now,
  );
  assert.equal(model.healthOf(s(state), avery).bloodGroup, "A+");
  assert.equal(model.healthOf(s(state), avery).allergies[0].name, "Peanuts");
  assert.throws(
    () =>
      model.saveHealth(
        state,
        records,
        parent,
        avery,
        (p) => ({
          ...p,
          allergies: [
            ...p.allergies,
            { id: "x", name: "", severity: "Mild", reaction: "", action: "" },
          ],
        }),
        now,
      ),
    /allergy/,
  );
  assert.throws(
    () =>
      model.reportIncident(
        state,
        records,
        parent,
        {
          student: avery,
          date: day,
          time: "10:00",
          kind: "Illness",
          description: "Felt unwell in class",
          action: "Rested",
        },
        day,
      ),
    /teachers or the school office/,
  );
  state = model.reportIncident(
    state,
    records,
    teacher,
    {
      student: avery,
      date: day,
      time: "10:00",
      kind: "Illness",
      description: "Felt unwell in class",
      action: "Rested in the quiet corner",
    },
    day,
    "inc-1",
  );
  assert.equal(s(state).incidents[0].status, "Awaiting acknowledgement");
  assert.throws(
    () =>
      model.acknowledgeIncident(state, records, otherParent, "inc-1", "", now),
    /linked to this child/,
  );
  state = model.acknowledgeIncident(
    state,
    records,
    parent,
    "inc-1",
    "Thanks",
    now,
  );
  const row = s(state).incidents.find((item) => item.id === "inc-1");
  assert.equal(row.status, "Acknowledged");
  assert.equal(row.ackBy, "Jordan Chen");
});

test("emergency contacts keep an order, and broadcasts reach the right families", () => {
  let state = model.saveContact(
    seed,
    records,
    parent,
    {
      student: avery,
      name: "Lee Chen",
      relation: "Uncle",
      phone: "9000012345",
    },
    "c-new",
  );
  let list = model.contactsOf(s(state), avery);
  assert.equal(list.at(-1).id, "c-new");
  state = model.changeContact(state, records, parent, "c-new", "up");
  list = model.contactsOf(s(state), avery);
  assert.equal(list[list.length - 2].id, "c-new");
  assert.deepEqual(
    list.map((item) => item.priority),
    list.map((_, i) => i + 1),
  );

  assert.throws(
    () =>
      model.sendBroadcast(
        seed,
        records,
        parent,
        {
          title: "Hello",
          message: "Some message here",
          category: "General",
          audience: "all",
          channels: [],
        },
        now,
      ),
    /staff/,
  );
  // A teacher may alert their own class only.
  state = model.sendBroadcast(
    seed,
    records,
    teacher,
    {
      title: "Sunflower class picnic moved",
      message: "The picnic moves to Friday because of rain.",
      category: "General",
      audience: "westfield-class-0",
      channels: ["SMS"],
    },
    now,
    "b-1",
  );
  const sent = s(state).broadcasts.find((item) => item.id === "b-1");
  assert.deepEqual(sent.channels, ["App", "SMS"]);
  const families = model.broadcastFamilies(records, "westfield-class-0");
  assert.ok(families.includes("westfield-parent"));
  assert.ok(
    !families.includes("westfield-family-4"),
    "LKG family not included",
  );
  assert.ok(
    model.broadcastsFor(s(state), records, parent).some((b) => b.id === "b-1"),
  );
  assert.ok(
    !model
      .broadcastsFor(s(state), records, {
        ...otherParent,
        person: "westfield-family-4",
      })
      .some((b) => b.id === "b-1"),
  );
  state = model.acknowledgeBroadcast(state, records, parent, "b-1");
  assert.deepEqual(s(state).broadcasts.find((b) => b.id === "b-1").acks, [
    "westfield-parent",
  ]);
  state = model.closeBroadcast(state, records, teacher, "b-1");
  assert.equal(s(state).broadcasts.find((b) => b.id === "b-1").active, false);
});

test("transport: parents track only their child's vehicle; staff find any by number", () => {
  const school = s(seed);
  assert.deepEqual(
    model.trackableVehicles(school, records, parent).map((v) => v.number),
    ["UK 07 PA 4521"],
  );
  assert.equal(model.trackableVehicles(school, records, teacher).length, 4);
  assert.equal(model.findVehicle(school, "uk07pb1180").id, "bus-2");
  assert.equal(model.findVehicle(school, "UK-07-TA-0392").id, "van-3");
  assert.equal(model.findVehicle(school, "0392").id, "van-3");
  assert.equal(model.findVehicle(school, "zz99"), undefined);
  assert.throws(
    () => model.assignRider(seed, records, teacher, avery, "bus-2", "it-park"),
    /school office/,
  );
  assert.throws(
    () => model.assignRider(seed, records, admin, avery, "bus-2", "jakhan"),
    /stop on this vehicle/,
  );
  const state = model.assignRider(
    seed,
    records,
    admin,
    avery,
    "bus-2",
    "it-park",
  );
  assert.equal(model.riderOf(s(state), avery).vehicle.id, "bus-2");
  assert.throws(
    () => model.setVehicleStatus(state, admin, "bus-2", "Maintenance"),
    /Move this vehicle's children/,
  );
});

test("simulated tracking moves along the route and reports stop arrivals", () => {
  const school = s(seed);
  const bus = school.vehicles.find((item) => item.id === "bus-1");
  const route = school.routes.find((item) => item.id === bus.route);
  const stop = route.stops.find((item) => item.id === "dilaram");
  const run = sim.tripMs(route);
  const seen = new Set();
  for (let t = 0; t < 2 * run + 40_000; t += sim.pingMs) {
    const live = sim.livePosition(bus, route, t);
    seen.add(live.phase);
    assert.ok(live.x >= 0 && live.x <= 100 && live.y >= 0 && live.y <= 70);
    const status = sim.stopStatus(route, stop, live, "Avery");
    assert.ok(status.title);
  }
  for (const phase of [
    "To school",
    "At school",
    "Drop-off run",
    "At last stop",
  ])
    assert.ok(seen.has(phase), phase);
  // Positions only change on a tracker ping.
  assert.deepEqual(
    sim.livePosition(bus, route, 1_000),
    sim.livePosition(bus, route, 4_000),
  );
  const spare = school.vehicles.find((item) => item.status === "Maintenance");
  assert.equal(sim.livePosition(spare, route, 0).moving, false);
});

test("saved data from an earlier day is replaced by a fresh day", () => {
  const raw = JSON.stringify(seed);
  const same = model.decodePreschoolState(raw, day, buildPreschoolSeed);
  assert.equal(same.day, day);
  assert.equal(s(same).diaries.length, s(seed).diaries.length);
  const next = model.decodePreschoolState(
    raw,
    "2026-11-27",
    buildPreschoolSeed,
  );
  assert.equal(next.day, "2026-11-27");
  assert.equal(
    model.decodePreschoolState("{bad", day, buildPreschoolSeed).day,
    day,
  );
  // Today has check-ins, a pending incident and an active alert.
  assert.ok(
    s(seed).gate.some((item) => item.date === day && item.kind === "in"),
  );
  assert.ok(
    s(seed).incidents.some(
      (item) => item.status === "Awaiting acknowledgement",
    ),
  );
  assert.ok(s(seed).broadcasts.some((item) => item.active));
});

import type { SchoolId } from "@/types/demo";
import { currentEnrollment, type AcademicSchool } from "./academic-model";
import { academicDemoSeed } from "./academic-seed";
import {
  activityOptions,
  addDays,
  emptySchool,
  type BusRoute,
  type Diary,
  type GateEvent,
  type HealthProfile,
  type MealLevel,
  type Mood,
  type PreschoolSchool,
  type PreschoolState,
  type TripEvent,
  type Vehicle,
} from "./preschool-model";

/**
 * Fictional day-care records for the demo, generated for a given day so the
 * school always has a "today": check-ins, diaries, a pickup pass, an
 * incident waiting for a parent, a rain alert and buses on their routes.
 */

/* ---------- Transport (Dehradun) ---------- */

const school = { x: 50, y: 33 };

const routes: BusRoute[] = [
  {
    id: "route-rajpur",
    name: "Rajpur Road",
    minutes: 38,
    stops: [
      { id: "jakhan", name: "Jakhan", x: 83, y: 7, am: "07:45", pm: "14:05" },
      {
        id: "hathibarkala",
        name: "Hathibarkala",
        x: 69,
        y: 16,
        am: "07:54",
        pm: "13:56",
      },
      {
        id: "dilaram",
        name: "Dilaram Chowk",
        x: 59,
        y: 24,
        am: "08:02",
        pm: "13:48",
      },
    ],
    path: [
      { x: 83, y: 7, stop: "jakhan" },
      { x: 77, y: 11 },
      { x: 69, y: 16, stop: "hathibarkala" },
      { x: 64, y: 20 },
      { x: 59, y: 24, stop: "dilaram" },
      { x: 55, y: 28 },
      school,
    ],
  },
  {
    id: "route-sahastradhara",
    name: "Sahastradhara Road",
    minutes: 34,
    stops: [
      {
        id: "it-park",
        name: "IT Park",
        x: 93,
        y: 40,
        am: "07:50",
        pm: "14:00",
      },
      {
        id: "sahastradhara",
        name: "Sahastradhara Crossing",
        x: 78,
        y: 36,
        am: "07:58",
        pm: "13:52",
      },
      {
        id: "aman-vihar",
        name: "Aman Vihar",
        x: 64,
        y: 34,
        am: "08:06",
        pm: "13:44",
      },
    ],
    path: [
      { x: 93, y: 40, stop: "it-park" },
      { x: 86, y: 38 },
      { x: 78, y: 36, stop: "sahastradhara" },
      { x: 71, y: 35 },
      { x: 64, y: 34, stop: "aman-vihar" },
      { x: 57, y: 33.5 },
      school,
    ],
  },
  {
    id: "route-vasant",
    name: "Vasant Vihar",
    minutes: 30,
    stops: [
      {
        id: "vasant-vihar",
        name: "Vasant Vihar",
        x: 9,
        y: 52,
        am: "07:55",
        pm: "13:55",
      },
      {
        id: "ballupur",
        name: "Ballupur Chowk",
        x: 23,
        y: 46,
        am: "08:02",
        pm: "13:48",
      },
      {
        id: "bindal",
        name: "Bindal Bridge",
        x: 37,
        y: 42,
        am: "08:09",
        pm: "13:41",
      },
    ],
    path: [
      { x: 9, y: 52, stop: "vasant-vihar" },
      { x: 16, y: 49 },
      { x: 23, y: 46, stop: "ballupur" },
      { x: 30, y: 44 },
      { x: 37, y: 42, stop: "bindal" },
      { x: 44, y: 39 },
      school,
    ],
  },
];

const vehicles: Vehicle[] = [
  {
    id: "bus-1",
    number: "UK 07 PA 4521",
    label: "Bus 1",
    kind: "Bus",
    capacity: 32,
    driver: "Ramesh Negi",
    driverPhone: "+91 98370 41520",
    attendant: "Sunita Rawat",
    attendantPhone: "+91 97190 22814",
    tracker: "GT06N · 868120 48213",
    route: "route-rajpur",
    status: "Active",
  },
  {
    id: "bus-2",
    number: "UK 07 PB 1180",
    label: "Bus 2",
    kind: "Bus",
    capacity: 32,
    driver: "Mohan Bisht",
    driverPhone: "+91 94120 66173",
    attendant: "Kavita Thapa",
    attendantPhone: "+91 98973 50461",
    tracker: "GT06N · 868120 51794",
    route: "route-sahastradhara",
    status: "Active",
  },
  {
    id: "van-3",
    number: "UK 07 TA 0392",
    label: "Van 3",
    kind: "Van",
    capacity: 12,
    driver: "Deepak Rana",
    driverPhone: "+91 99271 08345",
    attendant: "Geeta Joshi",
    attendantPhone: "+91 97600 31927",
    tracker: "GT06N · 868120 39027",
    route: "route-vasant",
    status: "Active",
  },
  {
    id: "van-4",
    number: "UK 07 TB 7745",
    label: "Van 4 (spare)",
    kind: "Van",
    capacity: 12,
    driver: "Harish Chauhan",
    driverPhone: "+91 98081 77412",
    attendant: "—",
    attendantPhone: "",
    tracker: "GT06N · 868120 60115",
    route: "route-vasant",
    status: "Maintenance",
  },
];

/* ---------- Children's details ---------- */

type Profile = {
  blood: string;
  allergies?: HealthProfile["allergies"];
  conditions?: string;
  medicine?: boolean;
  /** Vehicle and stop, or none when parents drop off. */
  bus?: [string, string];
  grandparent?: string;
};

const profiles: Record<string, Profile> = {
  "student-0": {
    blood: "O+",
    allergies: [
      {
        id: "a-peanut",
        name: "Peanuts",
        severity: "Severe",
        reaction: "Swelling of lips and face, hives",
        action:
          "No nut products. EpiPen Jr in the office cabinet. Call parents and 108.",
      },
    ],
    bus: ["bus-1", "dilaram"],
    grandparent: "Mei Chen",
  },
  "student-1": {
    blood: "O+",
    allergies: [
      {
        id: "a-dust",
        name: "Dust mites",
        severity: "Mild",
        reaction: "Sneezing and watery eyes",
        action:
          "Keep away from dusty play areas; wash face after outdoor play.",
      },
    ],
    medicine: true,
    bus: ["bus-1", "dilaram"],
    grandparent: "Mei Chen",
  },
  "student-senior": { blood: "B+", bus: ["van-3", "ballupur"] },
  "kid-0": { blood: "A+", bus: ["bus-1", "hathibarkala"] },
  "kid-1": {
    blood: "B+",
    allergies: [
      {
        id: "a-milk",
        name: "Cow's milk",
        severity: "Moderate",
        reaction: "Stomach ache and rash",
        action: "Offer the oat milk from her bag. No paneer or curd.",
      },
    ],
    bus: ["bus-2", "sahastradhara"],
  },
  "kid-2": { blood: "O−", bus: ["bus-2", "aman-vihar"] },
  "kid-3": { blood: "AB+" },
  "kid-4": {
    blood: "A+",
    conditions: "Mild asthma. Inhaler kept in the class first-aid box.",
    bus: ["van-3", "vasant-vihar"],
  },
  "kid-5": { blood: "B+", bus: ["bus-2", "it-park"] },
  "kid-6": {
    blood: "O+",
    allergies: [
      {
        id: "a-egg",
        name: "Egg",
        severity: "Moderate",
        reaction: "Itchy rash around the mouth",
        action: "No egg in snacks or cake. Inform parents of any rash.",
      },
    ],
    bus: ["bus-1", "jakhan"],
  },
  "kid-7": { blood: "A−" },
  "kid-8": { blood: "B+", bus: ["van-3", "bindal"] },
  "kid-9": { blood: "O+", grandparent: "Kamla Bhandari" },
};

const notes = [
  "{name} loved story time today and acted out the hungry caterpillar for everyone!",
  "{name} built a tall tower with blocks and was very proud of it. Shared nicely with friends.",
  "{name} painted a sunflower for you. Look for it in the bag. A little tired after lunch.",
  "A lovely day. {name} sang the rain song with the whole class and helped water the garden.",
  "{name} counted to 20 at circle time and tried writing the letter A. Great effort!",
  "{name} settled in quickly this morning and played happily in the sand pit.",
];
const moodCycle: Mood[] = [
  "happy",
  "happy",
  "calm",
  "sleepy",
  "happy",
  "fussy",
];
const mealCycle: MealLevel[] = ["All", "Most", "All", "Some", "All", "Most"];

/** Weekdays before `day`, newest first. */
function schoolDaysBefore(day: string, count: number) {
  const days: string[] = [];
  let cursor = day;
  while (days.length < count) {
    cursor = addDays(cursor, -1);
    const weekday = new Date(cursor + "T00:00:00").getDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor);
  }
  return days;
}

function minutes(time: string, add: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + add;
  return (
    String(Math.floor(total / 60)).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}

function schoolSeed(
  id: SchoolId,
  records: AcademicSchool,
  day: string,
): PreschoolSchool {
  const prefix = id + "-";
  const children = records.students.filter((item) =>
    currentEnrollment(records, item.id),
  );
  const local = (student: string) => student.replace(prefix, "");
  const guardianOf = (student: string) => {
    const link =
      records.links.find(
        (item) => item.student === student && item.primary === "Yes",
      ) ?? records.links.find((item) => item.student === student);
    return records.guardians.find((item) => item.id === link?.guardian);
  };
  const teacher =
    records.teachers.find((item) => item.id === prefix + "teacher")?.name ??
    "Class teacher";
  // Fifteen school days of gate records; diaries for the last four.
  const past = schoolDaysBefore(day, 15);
  const yesterday = past[0];
  const surname = (name: string) => name.split(" ").slice(1).join(" ");

  const diaries: Diary[] = [];
  const gate: GateEvent[] = [];
  const trips: TripEvent[] = [];
  const riders = children.flatMap((child) => {
    const bus = profiles[local(child.id)]?.bus;
    return bus ? [{ student: child.id, vehicle: bus[0], stop: bus[1] }] : [];
  });

  children.forEach((child, index) => {
    const first = child.name.split(" ")[0];
    const parent = guardianOf(child.id);
    const rider = riders.find((item) => item.student === child.id);
    const route = routes.find(
      (item) =>
        item.id === vehicles.find((v) => v.id === rider?.vehicle)?.route,
    );
    const stop = route?.stops.find((item) => item.id === rider?.stop);

    // Past days: a sent, read diary and a full gate record.
    past.forEach((date, dayIndex) => {
      const n = index + dayIndex;
      // A few days off sick, so attendance isn't a flat 100%.
      if ((index * 3 + dayIndex) % 13 === 7) return;
      if (dayIndex < 4)
        diaries.push({
          id: "diary-" + child.id + "-" + date,
          student: child.id,
          date,
          meals: {
            breakfast: mealCycle[n % 6],
            lunch: mealCycle[(n + 2) % 6],
            snack: "All",
          },
          napStart: "12:" + String(10 + (n % 3) * 5),
          napEnd: "13:" + String(5 + (n % 4) * 5).padStart(2, "0"),
          mood: moodCycle[n % 6],
          potty: 2 + (n % 2),
          diaper: local(child.id) === "student-senior" || n % 7 === 3 ? 1 : 0,
          activities: [
            activityOptions[n % 10],
            activityOptions[(n + 3) % 10],
            activityOptions[(n + 5) % 10],
          ],
          note: notes[n % notes.length].replace("{name}", first),
          status: "Sent",
          author: teacher,
          sentAt: date + "T14:20:00.000Z",
          readAt: date + "T15:05:00.000Z",
          reply:
            dayIndex === 1 && index % 3 === 0 ? "Thank you! 🙏" : undefined,
        });
      gate.push(
        {
          id: "gate-in-" + child.id + "-" + date,
          student: child.id,
          date,
          kind: "in",
          time: stop ? minutes(stop.am, 34) : "08:4" + (index % 10),
          person: stop ? "Bus attendant" : (parent?.name ?? "Parent"),
          method: stop ? "School bus" : "Parent",
          by: teacher,
        },
        {
          id: "gate-out-" + child.id + "-" + date,
          student: child.id,
          date,
          kind: "out",
          time: stop ? "13:15" : "13:3" + (index % 10),
          person: stop
            ? "Bus attendant"
            : (parent?.name ?? "Parent") + " (Parent)",
          method: stop ? "School bus" : "Parent",
          by: teacher,
        },
      );
    });

    // Today: most children are in; two have not arrived yet.
    const absentToday =
      local(child.id) === "kid-3" || local(child.id) === "kid-7";
    if (!absentToday) {
      const byBus = !!stop && local(child.id) !== "student-0";
      gate.push({
        id: "gate-in-" + child.id + "-" + day,
        student: child.id,
        date: day,
        kind: "in",
        time: byBus ? minutes(stop!.am, 34) : "08:" + String(40 + (index % 12)),
        person: byBus ? "Bus attendant" : (parent?.name ?? "Parent"),
        method: byBus ? "School bus" : "Parent",
        by: teacher,
      });
      if (byBus && rider && route)
        trips.push(
          {
            id: "trip-b-" + child.id,
            vehicle: rider.vehicle,
            student: child.id,
            date: day,
            time: stop!.am,
            kind: "Boarded",
            stop: stop!.name,
          },
          {
            id: "trip-s-" + child.id,
            vehicle: rider.vehicle,
            student: child.id,
            date: day,
            time: minutes(stop!.am, 31),
            kind: "Reached school",
            stop: "Oak and Ivy",
          },
        );
      // Diaries for today: half sent, a few drafts, the rest not started.
      if (index % 4 !== 3) {
        const sent = index % 2 === 0;
        diaries.push({
          id: "diary-" + child.id + "-" + day,
          student: child.id,
          date: day,
          meals: {
            breakfast: mealCycle[index % 6],
            lunch: mealCycle[(index + 1) % 6],
            snack: "All",
          },
          napStart: "12:15",
          napEnd: "13:00",
          mood: moodCycle[(index + 1) % 6],
          potty: 2,
          diaper: 0,
          activities: [
            ...new Set([
              "Circle time",
              "Garden walk",
              activityOptions[index % 10],
            ]),
          ],
          note: sent
            ? notes[(index + 4) % notes.length].replace("{name}", first)
            : "",
          status: sent ? "Sent" : "Draft",
          author: teacher,
          sentAt: sent ? day + "T08:30:00.000Z" : undefined,
        });
      }
    }
  });

  // Pickup lists: parents, grandparents and a family driver.
  const pickupPeople: PreschoolSchool["pickupPeople"] = children.flatMap(
    (child) => {
      const profile = profiles[local(child.id)];
      const rows: PreschoolSchool["pickupPeople"] = [];
      if (profile?.grandparent)
        rows.push({
          id: "pickup-gp-" + child.id,
          student: child.id,
          name: profile.grandparent,
          relation: "Grandmother",
          phone: "+91 98100 4" + String(1000 + rows.length + child.id.length),
          photo: "",
          status: "Approved",
          addedBy: "parent",
        });
      if (local(child.id) === "student-0" || local(child.id) === "student-1")
        rows.push(
          {
            id: "pickup-driver-" + child.id,
            student: child.id,
            name: "Rahul Kapoor",
            relation: "Family driver",
            phone: "+91 98971 20345",
            photo: "",
            status: "Approved",
            addedBy: "parent",
          },
          ...(local(child.id) === "student-1"
            ? [
                {
                  id: "pickup-neighbour-" + child.id,
                  student: child.id,
                  name: "Tara Singh",
                  relation: "Neighbour",
                  phone: "+91 99170 66412",
                  photo: "",
                  status: "Pending approval" as const,
                  addedBy: "parent" as const,
                },
              ]
            : []),
        );
      return rows;
    },
  );

  const robin = children.find((item) => local(item.id) === "student-1");
  const passes: PreschoolSchool["passes"] = robin
    ? [
        {
          id: "pass-robin-today",
          student: robin.id,
          date: day,
          name: "Anita Sharma",
          relation: "Aunt",
          phone: "+91 98370 11245",
          time: "13:30",
          note: "Robin's aunt is picking up today; we're travelling.",
          otp: "4826",
          code: "OI-7KQ2MX",
          status: "Active",
          createdAt: day + "T02:10:00.000Z",
        },
      ]
    : [];

  const vaccines = (child: string, n: number) => [
    {
      id: "v-bcg-" + child,
      name: "BCG",
      due: "2021-05-10",
      given: "2021-05-10",
    },
    {
      id: "v-mmr-" + child,
      name: "MMR (2nd dose)",
      due: "2022-11-15",
      given: "2022-11-18",
    },
    {
      id: "v-dpt-" + child,
      name: "DPT booster",
      due: addDays(day, n % 2 ? 20 : -40),
      given: n % 2 ? "" : addDays(day, -38),
    },
    {
      id: "v-typhoid-" + child,
      name: "Typhoid conjugate",
      due: addDays(day, 75),
      given: "",
    },
  ];
  const health: HealthProfile[] = children.map((child, n) => {
    const profile = profiles[local(child.id)] ?? { blood: "Not known" };
    return {
      student: child.id,
      bloodGroup: profile.blood,
      conditions: profile.conditions ?? "",
      allergies: profile.allergies ?? [],
      medicines: profile.medicine
        ? [
            {
              id: "med-" + child.id,
              name: "Cetirizine syrup",
              dose: "2.5 ml",
              time: "13:00",
              until: addDays(day, 4),
              notes:
                "After lunch, for the dust allergy. Prescribed by Dr Mehra.",
            },
          ]
        : [],
      vaccinations: vaccines(child.id, n),
      doctor: {
        name: n % 2 ? "Dr Rakesh Mehra" : "Dr Swati Uniyal",
        clinic:
          n % 2
            ? "Doon Kids Clinic, Rajpur Road"
            : "Little Steps Clinic, Ballupur",
        phone: n % 2 ? "0135 274 0211" : "0135 275 8340",
      },
      updatedAt: past[2] + "T10:00:00.000Z",
    };
  });

  const avery = children.find((item) => local(item.id) === "student-0");
  const incidents: PreschoolSchool["incidents"] = [
    ...(avery
      ? [
          {
            id: "incident-avery",
            student: avery.id,
            date: yesterday,
            time: "11:20",
            kind: "Minor injury" as const,
            description:
              "Avery slipped on the slide steps during outdoor play and grazed her right knee.",
            action:
              "Wound cleaned with saline and a plaster applied. Avery was comforted and returned to play after 10 minutes.",
            reportedBy: teacher,
            status: "Awaiting acknowledgement" as const,
          },
        ]
      : []),
    ...(robin
      ? [
          {
            id: "incident-robin",
            student: robin.id,
            date: past[3],
            time: "10:05",
            kind: "Illness" as const,
            description:
              "Robin felt warm after circle time; temperature 99.8°F.",
            action:
              "Rested in the quiet corner with water. Temperature normal by 11:00.",
            reportedBy: teacher,
            status: "Acknowledged" as const,
            ackAt: past[3] + "T12:30:00.000Z",
            ackBy: guardianOf(robin.id)?.name,
            parentNote: "Thanks for letting us know. He's fine at home.",
          },
        ]
      : []),
  ];

  const contacts: PreschoolSchool["contacts"] = children.flatMap((child) => {
    const parent = guardianOf(child.id);
    const profile = profiles[local(child.id)];
    return [
      {
        id: "contact-1-" + child.id,
        student: child.id,
        name: parent?.name ?? "Parent",
        relation: "Parent",
        phone: "+91 98200 1" + String(1001 + child.id.length * 7).slice(-4),
        priority: 1,
      },
      {
        id: "contact-2-" + child.id,
        student: child.id,
        name: profile?.grandparent ?? "Family friend " + surname(child.name),
        relation: profile?.grandparent ? "Grandmother" : "Family friend",
        phone: "+91 97600 2" + String(2003 + child.id.length * 11).slice(-4),
        priority: 2,
      },
    ];
  });

  const broadcasts: PreschoolSchool["broadcasts"] = [
    {
      id: "broadcast-rain",
      title: "Heavy rain alert: early dismissal at 12:30",
      message:
        "The weather office has issued an orange alert for Dehradun this afternoon. School closes at 12:30 today and buses leave 30 minutes early. Please send a raincoat and collect your child on time.",
      category: "Rain / weather",
      audience: "all",
      channels: ["App", "SMS", "WhatsApp"],
      sentAt: day + "T02:30:00.000Z",
      by: "School office",
      byId: prefix + "admin",
      acks: [prefix + "family-0", prefix + "family-1", prefix + "family-4"],
      active: true,
    },
    {
      id: "broadcast-water",
      title: "Water supply restored",
      message:
        "The water supply issue in the Nursery block has been fixed. Classes run as normal.",
      category: "General",
      audience: "all",
      channels: ["App"],
      sentAt: past[2] + "T05:00:00.000Z",
      by: "School office",
      byId: prefix + "admin",
      acks: [],
      active: false,
    },
  ];

  return {
    ...emptySchool,
    diaries,
    pickupPeople,
    passes,
    gate,
    health,
    incidents,
    contacts,
    broadcasts,
    vehicles,
    routes,
    riders,
    trips,
  };
}

export function buildPreschoolSeed(day: string): PreschoolState {
  return {
    version: 1,
    day,
    schools: Object.fromEntries(
      Object.entries(academicDemoSeed.schools).map(([id, records]) => [
        id,
        schoolSeed(id as SchoolId, records, day),
      ]),
    ),
  };
}

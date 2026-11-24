/**
 * Demo schools and accounts. These mirror the web app's demo data
 * (apps/web/src/mocks/academics.ts, services/academic-seed.ts,
 * services/branding-model.ts and services/auth-model.ts) so the same
 * sign-ins work against the API. Keep them in step if the demo changes.
 */
export const demoPassword = "Demo@1234";

export interface SeedPerson {
  key: string;
  name: string;
  email?: string;
  phone?: string;
  studentNumber?: string;
  role: "school-admin" | "teacher" | "student" | "parent";
  /** People the demo lets sign in get the demo password; others get none. */
  canSignIn: boolean;
  /** For parents: keys of their children in the same school. */
  children?: string[];
}

export interface SeedSchool {
  slug: string;
  code: string;
  name: string;
  theme: {
    primary: string;
    tagline: string;
    welcome: string;
    subdomain: string;
  };
  people: SeedPerson[];
}

function school(
  slug: string,
  code: string,
  name: string,
  theme: Omit<SeedSchool["theme"], "subdomain">,
  names: {
    admin: string;
    teacher: string;
    substitute: string;
    parent: string;
    parentPhone: string;
    children: [string, string];
  },
): SeedSchool {
  return {
    slug,
    code,
    name,
    theme: { ...theme, subdomain: slug },
    people: [
      {
        key: "admin",
        name: names.admin,
        email: slug + ".admin@example.test",
        role: "school-admin",
        canSignIn: true,
      },
      {
        key: "teacher",
        name: names.teacher,
        email: slug + ".teacher@example.test",
        role: "teacher",
        canSignIn: true,
      },
      {
        key: "teacher-2",
        name: names.substitute,
        email: slug + ".faculty@example.test",
        role: "teacher",
        canSignIn: false,
      },
      {
        key: "student-0",
        name: names.children[0],
        studentNumber: "ST-1",
        role: "student",
        canSignIn: true,
      },
      {
        key: "student-1",
        name: names.children[1],
        studentNumber: "ST-2",
        role: "student",
        canSignIn: false,
      },
      {
        key: "parent",
        name: names.parent,
        email: slug + ".family@example.test",
        phone: names.parentPhone,
        role: "parent",
        canSignIn: true,
        children: ["student-0", "student-1"],
      },
      {
        key: "guardian",
        name: "Sam Rivera",
        email: slug + ".guardian@example.test",
        role: "parent",
        canSignIn: false,
        children: ["student-0"],
      },
    ],
  };
}

export const seedSchools: SeedSchool[] = [
  school(
    "westfield",
    "WFA26",
    "Westfield Academy",
    {
      primary: "#4937b8",
      tagline: "Curious minds, kind hearts",
      welcome: "Welcome to Westfield Academy's learning space.",
    },
    {
      admin: "Amelia Brooks",
      teacher: "Maya Patel",
      substitute: "Daniel Okafor",
      parent: "Jordan Chen",
      parentPhone: "+919820011001",
      children: ["Avery Chen", "Robin Chen"],
    },
  ),
  school(
    "harborview",
    "HBV26",
    "Harborview International",
    {
      primary: "#185483",
      tagline: "Learning by the sea",
      welcome: "Sign in to Harborview International.",
    },
    {
      admin: "Nisha Rao",
      teacher: "Leena Das",
      substitute: "Farah Iqbal",
      parent: "Dev Menon",
      parentPhone: "+919847022002",
      children: ["Kiran Menon", "Isha Menon"],
    },
  ),
  school(
    "cedar",
    "CGC26",
    "Cedar Grove College",
    {
      primary: "#5b398f",
      tagline: "Grow with purpose",
      welcome: "Welcome to Cedar Grove College.",
    },
    {
      admin: "Rafael D'Souza",
      teacher: "Anika Shah",
      substitute: "Marcus Lee",
      parent: "Priya Mehta",
      parentPhone: "+919845033003",
      children: ["Neel Mehta", "Tara Mehta"],
    },
  ),
];

export const platformOwner = {
  name: "Morgan Reed",
  email: "platform.owner@example.test",
};

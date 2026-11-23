import type { DemoRole, SchoolId } from "@/types/demo";
import { requireRule } from "./academic-model";

/** White-label settings for one school's space. */
export type SchoolBranding = {
  displayName: string;
  tagline: string;
  /** Brand colour as #rrggbb. Must be readable as a background for white text. */
  primary: string;
  /** A small logo as a data URL, or "" to show initials. */
  logo: string;
  /** Short code parents and staff type on the sign-in page. */
  code: string;
  /** Planned address: <subdomain>.acadmaxis.example */
  subdomain: string;
  /** Shown on the school's sign-in page. */
  welcome: string;
};
export type BrandingState = {
  version: 1;
  schools: Record<SchoolId, SchoolBranding>;
};

export const brandingSeed: BrandingState = {
  version: 1,
  schools: {
    westfield: {
      displayName: "Westfield Academy",
      tagline: "Curious minds, kind hearts",
      primary: "#4937b8",
      logo: "",
      code: "WFA26",
      subdomain: "westfield",
      welcome: "Welcome to Westfield Academy's learning space.",
    },
    harborview: {
      displayName: "Harborview International",
      tagline: "Learning by the sea",
      primary: "#185483",
      logo: "",
      code: "HBV26",
      subdomain: "harborview",
      welcome: "Sign in to Harborview International.",
    },
    cedar: {
      displayName: "Cedar Grove College",
      tagline: "Grow with purpose",
      primary: "#5b398f",
      logo: "",
      code: "CGC26",
      subdomain: "cedar",
      welcome: "Welcome to Cedar Grove College.",
    },
  },
};

const hexPattern = /^#[0-9a-f]{6}$/i;
const logoPattern =
  /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
export const maxLogoLength = 280_000;

export function decodeBrandingState(raw: string | null): BrandingState {
  if (!raw) return brandingSeed;
  try {
    const data = JSON.parse(raw) as BrandingState;
    if (data?.version !== 1 || !data.schools) return brandingSeed;
    const valid = (Object.keys(brandingSeed.schools) as SchoolId[]).every(
      (id) => {
        const row = data.schools[id];
        return (
          !!row &&
          (
            [
              "displayName",
              "tagline",
              "primary",
              "logo",
              "code",
              "subdomain",
              "welcome",
            ] as const
          ).every((key) => typeof row[key] === "string") &&
          hexPattern.test(row.primary)
        );
      },
    );
    return valid ? data : brandingSeed;
  } catch {
    return brandingSeed;
  }
}

/* ---------- Colour helpers ---------- */

function channels(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

function mix(hex: string, target: number, amount: number) {
  return (
    "#" +
    channels(hex)
      .map((value) =>
        Math.round(value + (target - value) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** CSS variables derived from a school's brand colour. */
export function brandPalette(primary: string) {
  return {
    "--primary": primary,
    "--primary-strong": mix(primary, 0, 0.18),
    "--accent": mix(primary, 255, 0.9),
    "--school-accent": primary,
    "--school-soft": mix(primary, 255, 0.88),
  };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/* ---------- Rules ---------- */

export function saveBranding(
  state: BrandingState,
  role: DemoRole,
  actorSchool: SchoolId,
  school: SchoolId,
  value: SchoolBranding,
): BrandingState {
  requireRule(
    role === "super-admin" ||
      (role === "school-admin" && actorSchool === school),
    "Only this school's administrator or the platform owner can change branding.",
  );
  requireRule(state.schools[school], "Choose a school.");
  const next: SchoolBranding = {
    displayName: value.displayName.trim(),
    tagline: value.tagline.trim(),
    primary: value.primary.trim().toLowerCase(),
    logo: value.logo,
    code: value.code.trim().toUpperCase(),
    subdomain: value.subdomain.trim().toLowerCase(),
    welcome: value.welcome.trim(),
  };
  requireRule(
    next.displayName.length >= 2 && next.displayName.length <= 80,
    "Enter a display name of 2 to 80 characters.",
  );
  requireRule(
    next.tagline.length <= 120,
    "Keep the tagline under 120 characters.",
  );
  requireRule(
    next.welcome.length <= 200,
    "Keep the welcome message under 200 characters.",
  );
  requireRule(hexPattern.test(next.primary), "Choose a brand colour.");
  requireRule(
    contrastRatio(next.primary, "#ffffff") >= 4.5,
    "This colour is too light for white text on buttons. Choose a darker shade (contrast must be at least 4.5:1).",
  );
  requireRule(
    /^[A-Z0-9]{3,8}$/.test(next.code),
    "The school code must be 3 to 8 letters or numbers.",
  );
  requireRule(
    /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(next.subdomain) &&
      next.subdomain.length >= 3,
    "The subdomain must be 3 to 32 lowercase letters, numbers or hyphens.",
  );
  requireRule(
    !next.logo ||
      (logoPattern.test(next.logo) && next.logo.length <= maxLogoLength),
    "Upload a PNG, JPG, WebP or SVG logo under 200 KB.",
  );
  for (const [id, other] of Object.entries(state.schools)) {
    if (id === school) continue;
    requireRule(
      other.code !== next.code,
      "Another school already uses this code.",
    );
    requireRule(
      other.subdomain !== next.subdomain,
      "Another school already uses this subdomain.",
    );
  }
  return { ...state, schools: { ...state.schools, [school]: next } };
}

/** Finds a school by its code or subdomain, as typed on the sign-in page. */
export function findSchool(state: BrandingState, input: string) {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/\.acadmaxis\.example$/, "");
  if (!value) return undefined;
  return (Object.entries(state.schools) as [SchoolId, SchoolBranding][]).find(
    ([, item]) => item.code.toLowerCase() === value || item.subdomain === value,
  )?.[0];
}

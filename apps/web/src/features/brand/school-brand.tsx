"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { ImageUp, RotateCcw, Save } from "lucide-react";
import type { DemoRole, SchoolId } from "@/types/demo";
import { preschool } from "@/features/preschool/config";
import { schools } from "@/mocks/schools";
import {
  brandPalette,
  contrastRatio,
  initials,
  maxLogoLength,
  saveBranding,
  type SchoolBranding,
} from "@/services/branding-model";
import {
  updateBrandingState,
  useSchoolBranding,
} from "@/services/branding-store";
import { logAudit } from "@/services/audit-store";

/** CSS variables that recolour a container in the school's brand. */
export function brandStyle(branding: SchoolBranding) {
  return brandPalette(branding.primary) as CSSProperties;
}

export function SchoolLogo({
  branding,
  size = 36,
}: {
  branding: SchoolBranding;
  size?: number;
}) {
  return branding.logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL logo
    <img
      className="school-logo"
      src={branding.logo}
      alt=""
      width={size}
      height={size}
    />
  ) : (
    <span
      className="school-logo school-logo-initials"
      style={{ width: size, height: size, background: branding.primary }}
      aria-hidden="true"
    >
      {initials(branding.displayName)}
    </span>
  );
}

/** Sidebar brand for school workspaces: the school's logo and name. */
export function SchoolBrand({
  school,
  href,
}: {
  school: SchoolId;
  href: string;
}) {
  const branding = useSchoolBranding(school);
  return (
    <Link href={href} className="brand school-brand">
      <SchoolLogo branding={branding} />
      <span className="school-brand-text">
        <strong>{branding.displayName}</strong>
        <small>
          {preschool.enabled
            ? (schools.find((item) => item.id === school)?.location ??
              "Powered by ACADMAXIS")
            : "Powered by ACADMAXIS"}
        </small>
      </span>
    </Link>
  );
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The logo couldn't be read."));
    reader.readAsDataURL(file);
  });
}

/** Edits a school's white-label settings, with a live preview. */
export function BrandingEditor({
  school,
  role,
  actorSchool,
}: {
  school: SchoolId;
  role: DemoRole;
  actorSchool: SchoolId;
}) {
  const saved = useSchoolBranding(school);
  const [draft, setDraft] = useState<SchoolBranding>(saved);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (patch: Partial<SchoolBranding>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice("");
  };
  const validColour = /^#[0-9a-f]{6}$/i.test(draft.primary);
  const ratio = validColour ? contrastRatio(draft.primary, "#ffffff") : 0;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);

  async function upload(file: File | undefined) {
    setError("");
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
        file.type,
      )
    ) {
      setError("Upload a PNG, JPG, WebP or SVG logo.");
      return;
    }
    const data = await readFile(file);
    if (data.length > maxLogoLength) {
      setError("The logo must be under 200 KB.");
      return;
    }
    set({ logo: data });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      updateBrandingState((state) =>
        saveBranding(state, role, actorSchool, school, draft),
      );
      logAudit(
        school,
        "Branding",
        "Updated school branding",
        draft.displayName +
          " · " +
          draft.primary +
          " · code " +
          draft.code.toUpperCase(),
      );
      setNotice(
        "Branding saved. It now applies to this school's workspace and sign-in page.",
      );
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return (
    <form className="branding-editor" onSubmit={submit}>
      <div className="branding-fields dash-card">
        <label>
          Display name
          <input
            value={draft.displayName}
            onChange={(event) => set({ displayName: event.target.value })}
            required
            maxLength={80}
          />
        </label>
        <label>
          Tagline
          <input
            value={draft.tagline}
            onChange={(event) => set({ tagline: event.target.value })}
            maxLength={120}
          />
        </label>
        <div className="field-row">
          <label>
            Brand colour
            <span className="colour-field">
              <input
                type="color"
                value={validColour ? draft.primary : "#4937b8"}
                onChange={(event) => set({ primary: event.target.value })}
                aria-label="Pick brand colour"
              />
              <input
                value={draft.primary}
                onChange={(event) => set({ primary: event.target.value })}
                pattern="#[0-9a-fA-F]{6}"
                aria-label="Brand colour hex code"
              />
            </span>
            <span
              className={"field-hint" + (ratio && ratio < 4.5 ? " is-bad" : "")}
            >
              {validColour
                ? "Contrast with white text " +
                  ratio +
                  ":1 " +
                  (ratio >= 4.5 ? "✓ readable" : "✗ too light (needs 4.5:1)")
                : "Enter a colour like #4937b8."}
            </span>
          </label>
          <label>
            School code
            <input
              value={draft.code}
              onChange={(event) =>
                set({ code: event.target.value.toUpperCase() })
              }
              maxLength={8}
              required
            />
            <span className="field-hint">
              Typed by parents and staff on the sign-in page.
            </span>
          </label>
        </div>
        <label>
          Subdomain
          <span className="suffix-field">
            <input
              value={draft.subdomain}
              onChange={(event) =>
                set({ subdomain: event.target.value.toLowerCase() })
              }
              maxLength={32}
              required
            />
            <span>.acadmaxis.example</span>
          </span>
          <span className="field-hint">
            Planned for production; the demo uses the school code.
          </span>
        </label>
        <label>
          Sign-in welcome message
          <textarea
            value={draft.welcome}
            onChange={(event) => set({ welcome: event.target.value })}
            maxLength={200}
          />
        </label>
        <div className="logo-field">
          <SchoolLogo branding={draft} size={56} />
          <div className="card-actions">
            <label className="button button-outline file-button">
              <ImageUp size={15} aria-hidden="true" />
              Upload logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {draft.logo && (
              <button
                type="button"
                className="text-button"
                onClick={() => set({ logo: "" })}
              >
                Use initials instead
              </button>
            )}
          </div>
          <span className="field-hint">
            PNG, JPG, WebP or SVG, under 200 KB. Square works best.
          </span>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p role="status" className="form-notice">
          {notice}
        </p>
        <div className="card-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={!changed}
          >
            <Save size={15} aria-hidden="true" />
            Save branding
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={!changed}
            onClick={() => {
              setDraft(saved);
              setError("");
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Discard changes
          </button>
        </div>
      </div>
      <div
        className="branding-preview dash-card"
        style={validColour ? brandStyle(draft) : undefined}
        aria-label="Live preview"
      >
        <h2>Live preview</h2>
        <div className="preview-signin">
          <SchoolLogo branding={draft} size={44} />
          <strong>{draft.displayName || "School name"}</strong>
          <span>{draft.tagline}</span>
          <p>{draft.welcome}</p>
          <span className="preview-input" />
          <span className="preview-input" />
          <span className="button button-primary preview-button">Sign in</span>
        </div>
        <div className="preview-shell">
          <span className="preview-side">
            <i className="is-active" />
            <i />
            <i />
          </span>
          <span className="preview-main-area">
            <i />
            <i />
          </span>
        </div>
        <p className="field-hint">
          Sign-in page: <code>/login/{school}</code> · code {draft.code || "—"}
        </p>
      </div>
    </form>
  );
}

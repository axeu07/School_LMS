"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Info, School } from "lucide-react";
import { useNow } from "@/services/learning-store";
import { Card } from "@/components/ui/card";
import { useDemo } from "./demo-context";
import { roleHref } from "./navigation";

export function PageHeader({
  title,
  description,
  group,
  preview = false,
  actions,
}: {
  title: string;
  description: string;
  /** Sidebar group, shown in the breadcrumb trail. Omit on the dashboard. */
  group?: string;
  preview?: boolean;
  actions?: ReactNode;
}) {
  const { role, profile, school, data, stage } = useDemo();
  const now = useNow(60_000);
  const senior = stage === "senior";
  const scope = role === "super-admin" ? "Platform" : school.name;
  // The dashboard (no group) gets a themed welcome banner.
  const hero = !group;
  const firstName = data.person.name.split(" ")[0];
  const greeting = {
    student: senior
      ? "Welcome back, " + firstName + ". One chapter at a time."
      : "Hi " + firstName + "! Ready for an awesome day?",
    teacher: "Good to see you, " + data.person.name,
    "school-admin": "Welcome back, " + firstName,
    parent: "Welcome, " + firstName,
    "super-admin": "",
  }[role];
  return (
    <div
      className={"page-header" + (hero ? " page-hero" : "")}
      data-role={role}
      data-stage={stage}
    >
      {hero && (
        <span className="hero-art" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {hero ? (
        <>
          <div className="page-header-copy">
            {greeting && (
              <p className="hero-greeting">
                {role === "student" && !senior && (
                  <span className="hero-wave" aria-hidden="true">
                    👋
                  </span>
                )}
                {greeting}
              </p>
            )}
            <h1 title={description}>
              {title}
              {preview && (
                <span className="pill pill-preview">Demo preview</span>
              )}
            </h1>
          </div>
          <div className="hero-meta">
            <span className="hero-chip">
              <School size={13} aria-hidden="true" />
              {scope}
            </span>
            {now && (
              <span className="hero-chip">
                <CalendarDays size={13} aria-hidden="true" />
                {now.toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {actions}
          </div>
        </>
      ) : (
        <PlainHeader
          title={title}
          description={description}
          group={group}
          preview={preview}
          actions={actions}
          scope={scope}
          role={role}
          profileLabel={profile.label}
        />
      )}
    </div>
  );
}

function PlainHeader({
  title,
  description,
  group,
  preview,
  actions,
  scope,
  role,
  profileLabel,
}: {
  title: string;
  description: string;
  group?: string;
  preview: boolean;
  actions?: ReactNode;
  scope: string;
  role: Parameters<typeof roleHref>[0];
  profileLabel: string;
}) {
  return (
    <>
      <div className="page-header-copy">
        <nav aria-label="Breadcrumb" className="breadcrumbs">
          <ol>
            <li>{scope}</li>
            <li>
              <ChevronRight size={13} aria-hidden="true" />
              {group ? (
                <Link href={roleHref(role)}>{profileLabel}</Link>
              ) : (
                <span aria-current="page">{profileLabel}</span>
              )}
            </li>
            {group && (
              <>
                <li>
                  <ChevronRight size={13} aria-hidden="true" />
                  {group}
                </li>
                <li>
                  <ChevronRight size={13} aria-hidden="true" />
                  <span aria-current="page">{title}</span>
                </li>
              </>
            )}
          </ol>
        </nav>
        <h1>
          {title}
          {preview && <span className="pill pill-preview">Demo preview</span>}
        </h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </>
  );
}

/** States plainly that a page shows sample content for a planned module. */
export function PreviewNotice({
  summary,
  planned,
}: {
  summary: string;
  planned: string[];
}) {
  return (
    <Card className="dash-card preview-notice" role="note">
      <Info size={20} aria-hidden="true" />
      <div>
        <h2>Demo preview · sample content</h2>
        <p>{summary}</p>
        <ul>
          {planned.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={"dash-card section-card " + className}>
      <div className="widget-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

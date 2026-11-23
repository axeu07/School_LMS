"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
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
  const { role, profile, school } = useDemo();
  const scope = role === "super-admin" ? "Platform" : school.name;
  return (
    <div className="page-header">
      <div>
        <nav aria-label="Breadcrumb" className="breadcrumbs">
          <ol>
            <li>{scope}</li>
            <li>
              <ChevronRight size={13} aria-hidden="true" />
              {group ? (
                <Link href={roleHref(role)}>{profile.label}</Link>
              ) : (
                <span aria-current="page">{profile.label}</span>
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
    </div>
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

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { doubtsFor } from "@/services/doubt-model";
import { useDoubtState } from "@/services/doubt-store";
import { sectionLabel, subjectName } from "@/services/insights";
import type { DemoPanel, DemoRole } from "@/types/demo";
import { useDemo } from "./demo-context";
import {
  DataTable,
  EmptyState,
  StatCards,
  TrendChart,
} from "./dashboard-widgets";
import { findNavItem, roleHref } from "./navigation";
import { PageHeader } from "./page-header";

/** Dashboard panel id → the page that holds its full module. */
const panelLinks: Record<DemoRole, Record<string, string>> = {
  "super-admin": {
    schools: "schools",
    subscriptions: "subscriptions",
    activity: "analytics",
  },
  "school-admin": {
    announcements: "announcements",
    marketing: "marketing",
  },
  teacher: {
    schedule: "timetable",
    classes: "classes",
    assignments: "assignments",
    doubts: "doubt-board",
    assessments: "assessments",
    announcements: "announcements",
  },
  student: {
    schedule: "timetable",
    homework: "assignments",
    quizzes: "quizzes",
    announcements: "announcements",
    "assignment-results": "progress",
  },
  parent: {
    children: "children",
    exams: "assessments",
    announcements: "announcements",
    "assignment-results": "performance",
  },
};

const quickActions: Record<DemoRole, string[]> = {
  "super-admin": ["schools", "analytics", "subscriptions", "branding"],
  "school-admin": ["announcements", "students", "timetable", "attendance"],
  teacher: ["attendance", "assignments", "doubt-board", "ai-tools"],
  student: ["assignments", "doubt-board", "daily-quiz", "progress"],
  parent: ["homework", "attendance", "performance", "messages"],
};

export function RoleOverview() {
  const { role, profile, data, records, actor, scopeKey } = useDemo();
  const doubtState = useDoubtState();
  const panels: DemoPanel[] = data.panels
    .filter((panel) => panel.id !== "school-context")
    .map((panel) =>
      panel.id === "doubts"
        ? {
            ...panel,
            title: "Top unanswered doubts",
            rows: doubtsFor(doubtState, records, actor)
              .filter((item) => item.status === "Open")
              .map((item) => ({
                title: item.text,
                detail:
                  subjectName(records, item.subject) +
                  " · " +
                  sectionLabel(records, item.section),
                meta:
                  item.voteCount +
                  (item.voteCount === 1 ? " upvote" : " upvotes"),
              })),
          }
        : panel,
    );
  const link = (id: string) =>
    panelLinks[role][id] ? roleHref(role, panelLinks[role][id]) : undefined;
  const [first, ...rest] = panels;

  return (
    <>
      <PageHeader
        title={profile.label + " dashboard"}
        description={profile.focus}
      />
      {role === "parent" && !data.child && (
        <EmptyState>
          No children are linked to this parent in the selected school.
        </EmptyState>
      )}
      <StatCards stats={data.stats} />
      <div className="dashboard-grid feature-grid">
        <TrendChart key={scopeKey} chart={data.chart} sample />
        {first && <DataTable panel={first} href={link(first.id)} limit={5} />}
      </div>
      <section className="quick-actions" aria-labelledby="quick-title">
        <h2 id="quick-title">Quick actions</h2>
        <div className="action-grid">
          {quickActions[role].map((slug) => {
            const entry = findNavItem(role, slug);
            if (!entry) return null;
            const Icon = entry.icon;
            return (
              <Link
                key={slug}
                href={roleHref(role, slug)}
                className="action-card"
              >
                <span className="stat-icon tint-0">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{entry.description}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
      <div className="dashboard-grid">
        {rest.map((panel) => (
          <DataTable
            key={panel.id}
            panel={panel}
            href={link(panel.id)}
            limit={4}
          />
        ))}
      </div>
      {data.courses.length > 0 && (
        <section className="course-section" aria-labelledby="course-title">
          <div className="section-heading-row">
            <h2 id="course-title">Course progress</h2>
            <span className="pill pill-preview">Sample data</span>
          </div>
          <div className="course-grid">
            {data.courses.map(({ title, progress }) => (
              <Card key={title} className="dash-card">
                <div className="course-heading">
                  <h3>{title}</h3>
                  <strong>{progress}%</strong>
                </div>
                <progress
                  aria-label={title + " progress"}
                  value={progress}
                  max={100}
                />
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

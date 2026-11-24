"use client";

import {
  Building2,
  ChartColumn,
  CircleCheckBig,
  CreditCard,
  Palette,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useAcademicState } from "@/services/academic-store";
import { useAuditState } from "@/services/audit-store";
import { useBrandingState } from "@/services/branding-store";
import { useFeeState } from "@/services/fee-store";
import {
  ColumnChart,
  Donut,
  LineChart,
  ProgressList,
  type DonutSegment,
} from "./charts";
import {
  DashboardIntro,
  DashRow,
  KpiGrid,
  Panel,
  QuickActions,
  RowList,
} from "./kit";
import { demoSeries, greetingFor, relativeDay } from "./metrics";
import type { DashboardSources } from "./use-dashboard";

const number = new Intl.NumberFormat("en-IN");

export function SuperAdminDashboard({
  sources,
}: {
  sources: DashboardSources;
}) {
  const { schools, now, today, href } = sources;
  const academic = useAcademicState().schools;
  const fees = useFeeState().schools;
  const branding = useBrandingState().schools;
  const audit = useAuditState().entries;

  const active = schools.filter((item) => item.status === "Active");
  const trial = schools.filter((item) => item.status === "Trial");
  const students = schools.reduce((sum, item) => sum + item.students, 0);
  const teachers = schools.reduce((sum, item) => sum + item.teachers, 0);
  const attendance = students
    ? Math.round(
        (10 *
          schools.reduce(
            (sum, item) => sum + item.attendance * item.students,
            0,
          )) /
          students,
      ) / 10
    : undefined;

  // Onboarding: the setup steps each school has completed in the platform.
  const onboarding = schools.map((school) => {
    const records = academic[school.id];
    const brand = branding[school.id];
    const steps = [
      ["School code and branding", !!brand?.code && !!brand?.displayName],
      ["Logo uploaded", !!brand?.logo],
      [
        "Active academic year",
        !!records?.years.some((item) => item.status === "Active"),
      ],
      [
        "Students enrolled",
        !!records?.enrollments.some((item) => item.status === "Enrolled"),
      ],
      ["Fee structure", !!fees[school.id]?.structure.length],
    ] as const;
    const done = steps.filter(([, ok]) => ok).length;
    const missing = steps.find(([, ok]) => !ok)?.[0];
    return {
      label: school.name,
      value: Math.round((100 * done) / steps.length),
      detail:
        done === steps.length
          ? "Fully set up"
          : done + " of " + steps.length + " steps · next: " + missing,
    };
  });

  const plans = [...new Set(schools.map((item) => item.plan))];
  const tones: DonutSegment["tone"][] = ["c1", "c2", "c3", "muted"];
  const planSegments: DonutSegment[] = plans.map((plan, index) => ({
    label: plan,
    value: schools.filter((item) => item.plan === plan).length,
    tone: tones[index % tones.length],
  }));

  const activity = [...audit]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)
    .map((entry) => ({
      key: entry.id,
      title: entry.action,
      detail:
        (schools.find((item) => item.id === entry.school)?.name ?? "Platform") +
        " · " +
        entry.actorName,
      meta: relativeDay(entry.at.slice(0, 10), today),
    }));

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          <>
            {active.length} of {schools.length} schools are live
            {trial.length
              ? ", " +
                trial.length +
                " on trial (" +
                trial.map((item) => item.name).join(", ") +
                ")"
              : ""}
            .
          </>
        }
        aside={
          <QuickActions
            actions={[
              ...sources.action("schools", "Schools", Building2),
              ...sources.action("subscriptions", "Subscriptions", CreditCard),
              ...sources.action("branding", "Branding", Palette),
              ...sources.action("analytics", "Analytics", ChartColumn),
            ]}
          />
        }
      />
      <KpiGrid
        items={[
          {
            label: "Registered schools",
            value: String(schools.length),
            hint: trial.length
              ? trial.length + " on trial"
              : "All on a paid plan",
            icon: Building2,
            href: href("schools"),
          },
          {
            label: "Active schools",
            value: String(active.length),
            hint:
              Math.round((100 * active.length) / Math.max(1, schools.length)) +
              "% of registered schools",
            icon: CircleCheckBig,
            ring: Math.round(
              (100 * active.length) / Math.max(1, schools.length),
            ),
            href: href("subscriptions"),
          },
          {
            label: "Total users",
            value: number.format(students + teachers),
            hint:
              number.format(students) +
              " students · " +
              number.format(teachers) +
              " teachers",
            icon: Users,
            href: href("analytics"),
          },
          {
            label: "Avg attendance",
            value: attendance === undefined ? "—" : attendance + "%",
            hint: "Weighted by students",
            icon: UserRoundCheck,
            ring: attendance,
            href: href("analytics"),
          },
        ]}
      />
      <DashRow layout="wide-left" label="Platform overview">
        <Panel
          title="Schools by size"
          subtitle="Enrolled students per school"
          href={href("analytics")}
          hrefLabel="Analytics"
        >
          <ColumnChart
            label="Students per school"
            unit=""
            items={schools.map((item) => ({
              label: item.name,
              value: item.students,
              note: item.attendance + "% attendance",
            }))}
          />
        </Panel>
        <Panel
          title="Subscriptions"
          subtitle="Schools on each plan"
          href={href("subscriptions")}
        >
          <Donut
            label="Schools by plan"
            center={String(schools.length)}
            caption="schools"
            segments={planSegments}
          />
        </Panel>
      </DashRow>
      <DashRow layout="halves" label="Growth and health">
        <Panel
          title="Platform growth"
          subtitle="Schools on the platform each month"
          href={href("analytics")}
          demo
        >
          <LineChart
            points={demoSeries(sources.data.chart)}
            unit=""
            max={Math.max(4, ...sources.data.chart.values) + 1}
            label="Schools on the platform by month"
          />
        </Panel>
        <Panel
          title="Attendance by school"
          subtitle="Platform health · target 92%"
          href={href("analytics")}
        >
          <ColumnChart
            label="Attendance by school"
            threshold={92}
            items={schools.map((item) => ({
              label: item.name,
              value: item.attendance,
            }))}
          />
        </Panel>
      </DashRow>
      <DashRow layout="halves" label="Onboarding and activity">
        <Panel
          title="School onboarding"
          subtitle="Setup steps completed"
          href={href("branding")}
          hrefLabel="Set up"
        >
          <ProgressList items={onboarding} threshold={60} />
        </Panel>
        <Panel title="Recent platform activity" subtitle="From the audit log">
          <RowList rows={activity} empty="No recent activity." />
        </Panel>
      </DashRow>
    </>
  );
}

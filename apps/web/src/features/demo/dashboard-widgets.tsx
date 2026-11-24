"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/common/count-up";
import type { DemoChart, DemoPanel, DemoStat } from "@/types/demo";

const statIcons = {
  students: Users,
  teachers: GraduationCap,
  classes: LayoutGrid,
  attendance: Activity,
  tasks: ClipboardList,
  schools: Building2,
  calendar: CalendarDays,
};

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="empty-state">
      <Inbox size={18} aria-hidden="true" />
      {children}
    </p>
  );
}

/** Reads "92%" as 92; anything else is not a percentage. */
export function percentOf(value: string) {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

/** A small circular gauge for a 0–100 value. */
export function Ring({
  value,
  label,
  size = 46,
  stroke = 5,
  tone,
  showValue = true,
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  /** "auto" colours by health; omit for the theme colour. */
  tone?: "auto";
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const health =
    tone === "auto" ? (pct >= 85 ? "good" : pct >= 70 ? "fair" : "low") : "";
  return (
    <svg
      className={"gauge" + (health ? " gauge-" + health : "")}
      width={size}
      height={size}
      viewBox={"0 0 " + size + " " + size}
      role="img"
      aria-label={label + " " + Math.round(pct) + "%"}
    >
      <circle
        className="gauge-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
      />
      <circle
        className="gauge-value"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
      />
      {showValue && (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
          {Math.round(pct)}
        </text>
      )}
    </svg>
  );
}

export function StatCards({
  stats,
  compact = false,
  glance = false,
}: {
  stats: DemoStat[];
  /** Smaller single-row cards for list pages. */
  compact?: boolean;
  /** Dashboard KPIs: slim cards, percentages drawn as rings. */
  glance?: boolean;
}) {
  if (glance)
    return (
      <div className="stat-grid glance-stats">
        {stats.map((stat, index) => {
          const Icon = statIcons[stat.icon];
          const pct = percentOf(stat.value);
          return (
            <Card
              className="stat-card glance-stat"
              key={stat.label}
              title={stat.note}
            >
              {pct === undefined ? (
                <span className={"stat-icon tint-" + (index % 4)}>
                  <Icon size={17} aria-hidden="true" />
                </span>
              ) : (
                <Ring
                  value={pct}
                  label={stat.label}
                  tone="auto"
                  size={40}
                  showValue={false}
                />
              )}
              <div>
                <strong>
                  <CountUp value={stat.value} />
                </strong>
                <span className="stat-label">{stat.label}</span>
              </div>
            </Card>
          );
        })}
      </div>
    );
  return (
    <div className={compact ? "stat-grid stat-grid-compact" : "stat-grid"}>
      {stats.map((stat, index) => {
        const Icon = statIcons[stat.icon];
        return (
          <Card className="stat-card" key={stat.label}>
            <span className={"stat-icon tint-" + (index % 4)}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <div>
              <div className="stat-label">{stat.label}</div>
              <strong>
                <CountUp value={stat.value} />
              </strong>
              <span className="stat-note">{stat.note}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function TrendChart({
  chart,
  sample = false,
}: {
  chart: DemoChart;
  sample?: boolean;
}) {
  const [period, setPeriod] = useState(6);
  const [selection, setSelection] = useState<number>();
  const start = Math.max(0, chart.values.length - period);
  const active =
    selection !== undefined && selection >= start
      ? selection
      : chart.values.length - 1;
  const max = chart.unit === "%" ? 100 : Math.max(1, ...chart.values);
  const label = (value: number) => value + chart.unit;
  const heading = (
    <div>
      <h2>
        {chart.title}
        {sample && <span className="pill pill-preview">Sample data</span>}
      </h2>
      <p>{chart.description}</p>
    </div>
  );
  if (!chart.values.length)
    return (
      <Card className="dash-card trend-card">
        <div className="widget-header">{heading}</div>
        <EmptyState>No chart data yet.</EmptyState>
      </Card>
    );
  return (
    <Card className="dash-card trend-card">
      <div className="widget-header">
        {heading}
        <div className="segmented" aria-label="Chart period">
          {[3, 6].map((months) => (
            <button
              key={months}
              type="button"
              aria-pressed={period === months}
              onClick={() => {
                setPeriod(months);
                setSelection(undefined);
              }}
            >
              {months} mo
            </button>
          ))}
        </div>
      </div>
      <div className="chart-value" aria-live="polite">
        <strong>{label(chart.values[active])}</strong>
        <span>{chart.labels[active]}</span>
      </div>
      <div className="chart-grid" aria-label={chart.title}>
        {chart.values.slice(start).map((value, index) => {
          const position = start + index;
          return (
            <div className="chart-column" key={chart.labels[position]}>
              <div className="bar-track">
                <button
                  type="button"
                  className="chart-bar"
                  aria-label={chart.labels[position] + " " + label(value)}
                  aria-pressed={active === position}
                  onClick={() => setSelection(position)}
                  style={{ height: Math.max(5, (value / max) * 100) + "%" }}
                />
              </div>
              <span>{chart.labels[position]}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function DataTable({
  panel,
  href,
  limit,
  dense = false,
}: {
  panel: DemoPanel;
  href?: string;
  limit?: number;
  /** Dashboard style: count badge, one-line rows. */
  dense?: boolean;
}) {
  const rows = limit ? panel.rows.slice(0, limit) : panel.rows;
  return (
    <Card className={"dash-card data-card" + (dense ? " data-card-dense" : "")}>
      <div className="widget-header">
        <div>
          <h2>
            {panel.title}
            {dense && <span className="count-badge">{panel.rows.length}</span>}
          </h2>
          {panel.description && !dense && <p>{panel.description}</p>}
        </div>
        {href && (
          <Link className="view-all" href={href}>
            View all
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {rows.length ? (
        <table aria-label={panel.title} className="data-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.title + row.detail}>
                <th scope="row">
                  <span>{row.title}</span>
                  <small>{row.detail}</small>
                </th>
                <td>
                  {row.meta && <span className="row-meta">{row.meta}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState>No items to show.</EmptyState>
      )}
    </Card>
  );
}

/** A compact horizontal bar for live percentages. */
export function Meter({
  value,
  label,
}: {
  value: number | undefined;
  label: string;
}) {
  return (
    <span className="meter" role="img" aria-label={label}>
      <span style={{ width: (value ?? 0) + "%" }} />
    </span>
  );
}

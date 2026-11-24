"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  MapPin,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { CountUp } from "@/components/common/count-up";
import { Ring, Sparkline } from "./charts";
import type { TodaySession } from "./metrics";

/**
 * Reusable dashboard building blocks. A role dashboard is a composition of
 * these: an intro, up to four KPI cards, a primary row, a secondary row and
 * contextual quick actions. Colours come from the role theme tokens.
 */

/* ---------- Layout ---------- */

export function Dashboard({ children }: { children: ReactNode }) {
  return <div className="db">{children}</div>;
}

/** A responsive row; `layout` picks the column ratio on wide screens. */
export function DashRow({
  layout = "halves",
  children,
  label,
}: {
  layout?: "halves" | "wide-left" | "wide-right" | "thirds";
  children: ReactNode;
  label?: string;
}) {
  return (
    <section className={"db-row db-row-" + layout} aria-label={label}>
      {children}
    </section>
  );
}

/* ---------- Intro ---------- */

export function DashboardIntro({
  greeting,
  date,
  context,
  aside,
}: {
  greeting: ReactNode;
  date?: Date;
  /** One sentence answering "what is happening today?". */
  context?: ReactNode;
  /** Filters, child profile or school chip on the right. */
  aside?: ReactNode;
}) {
  return (
    <header className="db-intro">
      <div className="db-intro-copy">
        <p className="db-eyebrow">
          <CalendarDays size={14} aria-hidden="true" />
          {date
            ? date.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : " "}
        </p>
        <h1>{greeting}</h1>
        {context && <p className="db-context">{context}</p>}
      </div>
      {aside && <div className="db-intro-aside">{aside}</div>}
    </header>
  );
}

/* ---------- KPI cards ---------- */

export type Kpi = {
  label: string;
  value: string;
  /** Short supporting line: what the number means or what to do. */
  hint?: string;
  href?: string;
  icon: LucideIcon;
  /** Draws a ring for a 0–100 figure. */
  ring?: number;
  /** Draws a sparkline from recent values. */
  trend?: number[];
  /** "attention" only when the figure genuinely needs action. */
  tone?: "default" | "attention" | "good";
};

export function KpiGrid({ items }: { items: Kpi[] }) {
  // Anti-clutter rule: never more than four primary KPIs.
  return (
    <div className="db-kpis" role="list">
      {items.slice(0, 4).map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  ring,
  trend,
  tone,
}: Kpi) {
  const body = (
    <>
      <span className="db-kpi-top">
        <span className="db-kpi-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="db-kpi-label">{label}</span>
        {href && (
          <ArrowUpRight className="db-kpi-go" size={15} aria-hidden="true" />
        )}
      </span>
      <span className="db-kpi-main">
        <strong className="db-kpi-value">
          <CountUp value={value} />
        </strong>
        {ring !== undefined ? (
          <Ring value={ring} label={label} />
        ) : trend ? (
          <Sparkline values={trend} />
        ) : null}
      </span>
      {hint && <span className="db-kpi-hint">{hint}</span>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="db-kpi"
      data-tilt
      data-tone={tone}
      role="listitem"
      aria-label={label + ": " + value + (hint ? ". " + hint : "")}
    >
      {body}
    </Link>
  ) : (
    <div className="db-kpi" data-tilt data-tone={tone} role="listitem">
      {body}
    </div>
  );
}

/* ---------- Panels ---------- */

export function Panel({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  action,
  children,
  className = "",
  demo = false,
}: {
  title: string;
  /** Marks a chart that shows the app's demo series, not live records. */
  demo?: boolean;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"db-panel " + className}>
      <div className="db-panel-head">
        <div>
          <h2>
            {title}
            {demo && <span className="db-demo">Demo data</span>}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
        {href && (
          <Link className="db-link" href={href}>
            {hrefLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export type Row = {
  key?: string;
  title: string;
  detail?: string;
  meta?: string;
  /** Colours the marker and meta; reserve "danger" / "warn" for real urgency. */
  tone?: "default" | "warn" | "danger" | "good" | "accent";
  href?: string;
  /** A leading token such as a date block or initials. */
  lead?: ReactNode;
};

/** A short list (max five rows). Everything beyond lives behind "View all". */
export function RowList({
  rows,
  empty,
  limit = 5,
}: {
  rows: Row[];
  empty: ReactNode;
  limit?: number;
}) {
  if (!rows.length) return <DashEmpty>{empty}</DashEmpty>;
  return (
    <ul className="db-rows">
      {rows.slice(0, Math.min(limit, 5)).map((row) => {
        const inner = (
          <>
            {row.lead ?? <i className="db-dot" aria-hidden="true" />}
            <span className="db-item-copy">
              <span className="db-item-title">{row.title}</span>
              {row.detail && <small>{row.detail}</small>}
            </span>
            {row.meta && <span className="db-item-meta">{row.meta}</span>}
          </>
        );
        return (
          <li key={row.key ?? row.title + row.detail} data-tone={row.tone}>
            {row.href ? (
              <Link href={row.href} className="db-item">
                {inner}
              </Link>
            ) : (
              <div className="db-item">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A compact calendar-style date token for list rows. */
export function DateToken({ date }: { date: string }) {
  const value = new Date(date + "T00:00:00");
  return (
    <span className="db-date" aria-hidden="true">
      <small>{value.toLocaleDateString("en-IN", { month: "short" })}</small>
      <strong>{value.getDate()}</strong>
    </span>
  );
}

/** A slim banner, shown only for a genuinely urgent, current issue. */
export function DashAlert({
  children,
  href,
  action,
}: {
  children: ReactNode;
  href: string;
  action: string;
}) {
  return (
    <div className="db-alert" role="alert">
      <TriangleAlert size={16} aria-hidden="true" />
      <span>{children}</span>
      <Link href={href} className="db-link">
        {action}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function DashEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="db-empty">
      <CircleCheck size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/* ---------- Today's timetable ---------- */

export function Timeline({
  sessions,
  empty,
  showSection = true,
  hrefFor,
}: {
  sessions: TodaySession[];
  empty: ReactNode;
  showSection?: boolean;
  hrefFor?: (session: TodaySession) => string | undefined;
}) {
  if (!sessions.length) return <DashEmpty>{empty}</DashEmpty>;
  return (
    <ol className="db-timeline">
      {sessions.map((session) => {
        const href = hrefFor?.(session);
        const inner = (
          <>
            <span className="db-time">
              <strong>{session.start}</strong>
              <small>{session.end}</small>
            </span>
            <span className="db-slot-copy">
              <span className="db-item-title">{session.subject}</span>
              <small>
                {showSection ? session.sectionLabel + " · " : ""}
                <MapPin size={11} aria-hidden="true" /> {session.room}
              </small>
            </span>
            {(session.state === "now" || session.state === "next") && (
              <span className="db-badge" data-state={session.state}>
                <i className="db-live" aria-hidden="true" />
                {session.state === "now" ? "In progress" : "Up next"}
              </span>
            )}
            {session.state === "done" && <span className="db-done">Done</span>}
          </>
        );
        return (
          <li key={session.id} data-state={session.state}>
            {href ? (
              <Link href={href} className="db-slot">
                {inner}
              </Link>
            ) : (
              <div className="db-slot">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Quick actions ---------- */

export type QuickAction = { label: string; href: string; icon: LucideIcon };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (!actions.length) return null;
  return (
    <nav className="db-actions" aria-label="Quick actions">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link key={label} href={href} className="db-action">
          <Icon size={15} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Segmented filter ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="db-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Loading ---------- */

/** Mirrors the dashboard layout while time-based data hydrates. */
export function DashboardSkeleton() {
  return (
    <div className="db" aria-busy="true" aria-label="Loading dashboard">
      <div className="db-intro">
        <div className="db-intro-copy">
          <span className="db-skel" style={{ width: "11rem", height: 12 }} />
          <span className="db-skel" style={{ width: "16rem", height: 26 }} />
          <span className="db-skel" style={{ width: "22rem", height: 12 }} />
        </div>
      </div>
      <div className="db-kpis">
        {[0, 1, 2, 3].map((key) => (
          <span key={key} className="db-skel db-skel-card" />
        ))}
      </div>
      <div className="db-row db-row-wide-left">
        <span className="db-skel db-skel-panel" />
        <span className="db-skel db-skel-panel" />
      </div>
    </div>
  );
}

"use client";

import { useId, useState } from "react";

/**
 * Minimal, dependency-free charts for the dashboards. They read the role
 * theme tokens (--t-*, --tint*) from CSS, so every profile gets its own
 * colours without any chart code knowing about roles.
 */

export type ChartPoint = { label: string; value: number; note?: string };

/* ---------- Line chart (trends) ---------- */

export function LineChart({
  points,
  unit = "%",
  max,
  label,
  height = 150,
}: {
  points: ChartPoint[];
  unit?: string;
  /** Top of the scale; 100 for percentages, otherwise the data maximum. */
  max?: number;
  label: string;
  height?: number;
}) {
  const [active, setActive] = useState<number>();
  const gradient = useId();
  const top =
    max ??
    (unit === "%" ? 100 : Math.max(1, ...points.map((p) => p.value)) * 1.15);
  const x = (index: number) =>
    points.length === 1 ? 50 : 4 + (92 * index) / (points.length - 1);
  const y = (value: number) => 92 - (84 * Math.min(value, top)) / top;
  const line = points
    .map(
      (point, index) => (index ? "L" : "M") + x(index) + " " + y(point.value),
    )
    .join(" ");
  const area =
    points.length > 1
      ? line + " L" + x(points.length - 1) + " 100 L" + x(0) + " 100 Z"
      : "";
  const shown = active ?? points.length - 1;
  return (
    <figure className="db-line" aria-label={label}>
      <div className="db-line-plot" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--db-c1)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--db-c1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((tick) => (
            <line
              key={tick}
              className="db-line-grid"
              x1="0"
              x2="100"
              y1={y((tick / 100) * top)}
              y2={y((tick / 100) * top)}
            />
          ))}
          {area && <path d={area} fill={"url(#" + gradient + ")"} />}
          <path className="db-line-path" d={line} />
        </svg>
        {points.map((point, index) => (
          <button
            key={point.label + index}
            type="button"
            className="db-line-dot"
            data-active={index === shown || undefined}
            style={{ left: x(index) + "%", top: y(point.value) + "%" }}
            aria-label={point.label + ": " + point.value + unit}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onMouseLeave={() => setActive(undefined)}
            onBlur={() => setActive(undefined)}
          />
        ))}
        {points[shown] && (
          <span
            className="db-tip"
            role="status"
            style={{
              left: Math.min(88, Math.max(12, x(shown))) + "%",
              top: y(points[shown].value) + "%",
            }}
          >
            <strong>
              {points[shown].value}
              {unit}
            </strong>
            {points[shown].label}
            {points[shown].note ? " · " + points[shown].note : ""}
          </span>
        )}
      </div>
      <div className="db-axis" aria-hidden="true">
        {points.map((point, index) => (
          <span key={point.label + index} style={{ left: x(index) + "%" }}>
            {point.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ---------- Column chart (comparisons) ---------- */

export function ColumnChart({
  items,
  unit = "%",
  max,
  label,
  /** Values below this get the attention colour. */
  threshold,
  format,
}: {
  items: ChartPoint[];
  unit?: string;
  max?: number;
  label: string;
  threshold?: number;
  /** Formats each value label, e.g. compact rupees. */
  format?: (value: number) => string;
}) {
  const show = (value: number) =>
    format ? format(value) : value.toLocaleString("en-IN") + unit;
  const [active, setActive] = useState<number>();
  const top =
    max ?? (unit === "%" ? 100 : Math.max(1, ...items.map((i) => i.value)));
  return (
    <figure className="db-columns" aria-label={label}>
      {items.map((item, index) => (
        <div className="db-column" key={item.label + index}>
          <span
            className="db-column-value"
            data-active={active === index || undefined}
          >
            {show(item.value)}
          </span>
          <div className="db-column-track">
            <button
              type="button"
              className="db-column-bar"
              data-low={
                threshold !== undefined && item.value < threshold
                  ? true
                  : undefined
              }
              style={{ height: Math.max(4, (100 * item.value) / top) + "%" }}
              aria-label={
                item.label +
                ": " +
                show(item.value) +
                (item.note ? ", " + item.note : "")
              }
              title={item.note}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onMouseLeave={() => setActive(undefined)}
              onBlur={() => setActive(undefined)}
            />
          </div>
          <span className="db-column-label" title={item.label}>
            {item.label}
          </span>
        </div>
      ))}
    </figure>
  );
}

/* ---------- Donut (breakdowns) ---------- */

export type DonutSegment = {
  label: string;
  value: number;
  /** Formatted value for the legend; defaults to the number. */
  display?: string;
  tone: "c1" | "c2" | "c3" | "warn" | "danger" | "muted";
};

export function Donut({
  segments,
  center,
  caption,
  label,
  size = 132,
}: {
  segments: DonutSegment[];
  center: string;
  caption?: string;
  label: string;
  size?: number;
}) {
  const [active, setActive] = useState<number>();
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const focus = active === undefined ? undefined : segments[active];
  return (
    <div className="db-donut">
      <div className="db-donut-ring" style={{ width: size, height: size }}>
        <svg
          viewBox={"0 0 " + size + " " + size}
          role="img"
          aria-label={
            label +
            ": " +
            segments
              .map((item) => item.label + " " + (item.display ?? item.value))
              .join(", ")
          }
        >
          <circle
            className="db-donut-track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
          />
          {total > 0 &&
            segments.map((item, index) => {
              const length = (item.value / total) * circumference;
              const gap =
                segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;
              const dash = (
                <circle
                  key={item.label}
                  className={"db-donut-seg tone-" + item.tone}
                  data-dim={
                    active !== undefined && active !== index ? true : undefined
                  }
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={stroke}
                  strokeDasharray={
                    Math.max(0, length - gap) + " " + circumference
                  }
                  strokeDashoffset={-offset}
                  transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
                />
              );
              offset += length;
              return item.value > 0 ? dash : null;
            })}
        </svg>
        <span className="db-donut-center" aria-hidden="true">
          <strong>{focus ? (focus.display ?? focus.value) : center}</strong>
          <small>{focus ? focus.label : caption}</small>
        </span>
      </div>
      <ul className="db-legend">
        {segments.map((item, index) => (
          <li
            key={item.label}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(undefined)}
          >
            <i className={"tone-" + item.tone} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{item.display ?? item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Progress bars (completion) ---------- */

export type ProgressItem = {
  label: string;
  /** 0–100, or undefined when nothing is recorded yet. */
  value: number | undefined;
  detail?: string;
  href?: string;
};

export function ProgressList({
  items,
  threshold,
}: {
  items: ProgressItem[];
  /** Values below this get the attention colour. */
  threshold?: number;
}) {
  return (
    <ul className="db-progress">
      {items.map((item) => (
        <li key={item.label}>
          <div className="db-progress-head">
            <span>{item.label}</span>
            <strong>{item.value === undefined ? "—" : item.value + "%"}</strong>
          </div>
          <span
            className="db-bar"
            role="progressbar"
            aria-label={item.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.value ?? 0}
            data-low={
              threshold !== undefined &&
              item.value !== undefined &&
              item.value < threshold
                ? true
                : undefined
            }
          >
            <span style={{ width: (item.value ?? 0) + "%" }} />
          </span>
          {item.detail && <small>{item.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Sparkline (inside KPI cards) ---------- */

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map(
      (value, index) =>
        (100 * index) / (values.length - 1) +
        "," +
        (26 - (22 * (value - min)) / span),
    )
    .join(" ");
  return (
    <svg
      className="db-spark"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}

/* ---------- Ring (single percentage) ---------- */

export function Ring({
  value,
  label,
  size = 40,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const stroke = 4.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg
      className="db-ring"
      width={size}
      height={size}
      viewBox={"0 0 " + size + " " + size}
      role="img"
      aria-label={label + " " + pct + "%"}
    >
      <circle
        className="db-ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
      />
      <circle
        className="db-ring-value"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        transform={"rotate(-90 " + size / 2 + " " + size / 2 + ")"}
      />
    </svg>
  );
}

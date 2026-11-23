"use client";

import { useEffect, useState } from "react";

// Splits "₹1,24,500", "92%", "4.6 / 5" into prefix, number and suffix.
const NUMBER = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;

function parse(value: string) {
  const match = NUMBER.exec(value);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  const target = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  // Keep the original grouping style (Indian lakh grouping vs. western).
  const locale = /\d,\d\d,\d{3}/.test(raw) ? "en-IN" : "en-US";
  const grouped = raw.includes(",");
  return { prefix, suffix, target, decimals, locale, grouped };
}

/**
 * Animates the leading number of a display value from 0 up to its final value.
 * Non-numeric values render unchanged. Screen readers only get the final value.
 */
export function CountUp({
  value,
  duration = 1100,
}: {
  value: string;
  duration?: number;
}) {
  const parsed = parse(value);
  const [progress, setProgress] = useState(parsed ? 0 : 1);

  useEffect(() => {
    if (!parsed) return;
    // Reduced motion: the first frame jumps straight to the final value.
    const length = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : duration;
    let frame = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = length ? Math.min(1, (now - start) / length) : 1;
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Re-run only when the displayed value actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  if (!parsed || progress >= 1) return <>{value}</>;

  const current = parsed.target * progress;
  const number = current.toLocaleString(parsed.locale, {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });
  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="count-up">
        {parsed.prefix}
        {number}
        {parsed.suffix}
      </span>
    </>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Cards that lean toward the pointer in 3D. Kept to compact, clickable-looking
 * surfaces — large tables and forms stay still so they remain easy to read.
 */
const TILT_SELECTOR = [
  ".stat-card",
  ".action-card",
  ".role-card",
  ".marketing-card",
  ".marketing-role",
  ".course-grid > .dash-card",
  ".preview-frame",
  "[data-tilt]",
].join(",");

const MAX_TILT = 7; // degrees
const FRAME_TILT = 3; // the big hero preview moves less

/**
 * Global, render-less motion helper. Uses one delegated pointer listener and
 * writes CSS custom properties (--rx, --ry, --gx, --gy) that motion.css turns
 * into a 3D tilt with a moving light glare. Disabled for touch devices and for
 * people who prefer reduced motion.
 */
export function MotionLayer() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reduced.matches) return;

    let active: HTMLElement | null = null;
    let activeLimit = MAX_TILT;
    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const reset = (element: HTMLElement) => {
      element.style.removeProperty("--rx");
      element.style.removeProperty("--ry");
      element.removeAttribute("data-tilting");
    };

    const apply = () => {
      frame = 0;
      if (!active || !lastEvent) return;
      const rect = active.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (lastEvent.clientX - rect.left) / rect.width; // 0..1
      const y = (lastEvent.clientY - rect.top) / rect.height;
      const limit = active.classList.contains("preview-frame")
        ? FRAME_TILT
        : activeLimit;
      active.style.setProperty(
        "--ry",
        ((x - 0.5) * 2 * limit).toFixed(2) + "deg",
      );
      active.style.setProperty(
        "--rx",
        ((0.5 - y) * 2 * limit).toFixed(2) + "deg",
      );
      active.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      active.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    };

    const onMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        TILT_SELECTOR,
      );
      if (target !== active) {
        if (active) reset(active);
        active = target ?? null;
        if (active) {
          active.setAttribute("data-tilting", "");
          // Role themes set --tilt-max (playful for students, subtle for parents).
          const themed = parseFloat(
            getComputedStyle(active).getPropertyValue("--tilt-max"),
          );
          activeLimit = Number.isFinite(themed) ? themed : MAX_TILT;
        }
      }
      lastEvent = event;
      if (active && !frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      if (active) reset(active);
      active = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      if (active) reset(active);
    };
  }, []);

  return null;
}

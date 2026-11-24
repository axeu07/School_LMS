"use client";

import { localCalendarDate } from "@/services/assignment-model";
import { useCommunicationState } from "@/services/communication-store";
import { useFeeState } from "@/services/fee-store";
import { useLeaveSchool } from "@/services/leave-store";
import { useLearningState, useNow } from "@/services/learning-store";
import type { LucideIcon } from "lucide-react";
import { findNavItem, roleHref } from "../navigation";
import { useDemo } from "../demo-context";

/**
 * Everything a role dashboard reads, from the same stores the modules use.
 * `now` is undefined until the client clock is available (no hydration
 * mismatch), so dashboards render a skeleton until then.
 */
export function useDashboardSources() {
  const demo = useDemo();
  const learningState = useLearningState();
  const comm = useCommunicationState();
  const fees = useFeeState().schools[demo.actor.school];
  const leave = useLeaveSchool(demo.actor.school);
  const now = useNow(60_000);
  return {
    ...demo,
    learningState,
    learning: learningState.schools[demo.actor.school],
    comm,
    fees,
    leave,
    now,
    today: now ? localCalendarDate(now) : undefined,
    href: (slug = "") => roleHref(demo.role, slug),
    /** A quick action, or nothing when the role has no such page. */
    action: (slug: string, label: string, icon: LucideIcon) =>
      findNavItem(demo.role, slug)
        ? [{ label, href: roleHref(demo.role, slug), icon }]
        : [],
    firstName: demo.data.person.name.split(" ")[0],
  };
}

export type DashboardSources = ReturnType<typeof useDashboardSources> & {
  now: Date;
  today: string;
};

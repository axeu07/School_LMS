"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { DemoRole } from "@/types/demo";
import { ChatAssistant } from "./chat-assistant";
import { DemoProvider, useDemo } from "./demo-context";
import { DashboardHeader, Sidebar } from "./dashboard-navigation";
import { EmptyState } from "./dashboard-widgets";
import { sidebarPreferenceKey, usePreference } from "./preferences";
import { syncReminders } from "@/services/calendar-model";
import { updateCommunicationState } from "@/services/communication-store";
import { setAuditActor } from "@/services/audit-store";
import { useSchoolBranding } from "@/services/branding-store";
import { brandStyle } from "../brand/school-brand";
import { SessionGuard } from "./session-guard";
import { preschool } from "@/features/preschool/config";
import { UrgentBanner } from "@/features/preschool/emergency";

/** Persistent layout: stays mounted while nested role routes change. */
export function RoleShell({
  role,
  children,
}: {
  role: DemoRole;
  children: ReactNode;
}) {
  return (
    <DemoProvider
      role={role}
      fallback={
        <main className="route-message">
          <EmptyState>This demo workspace is unavailable.</EmptyState>
        </main>
      }
    >
      <Shell role={role}>{children}</Shell>
    </DemoProvider>
  );
}

function Shell({ role, children }: { role: DemoRole; children: ReactNode }) {
  const { schoolId, scopeKey, records, data, stage } = useDemo();
  const branding = useSchoolBranding(schoolId);
  const personName = data.person.name;
  // Every saved change is attributed to whoever is using this workspace.
  useEffect(() => {
    setAuditActor({ role, name: personName });
  }, [role, personName]);
  // Upcoming exam/PTM reminders are generated when the demo opens (or the
  // school changes) — there is no background scheduler in the browser demo.
  useEffect(() => {
    if (role === "super-admin") return;
    updateCommunicationState((state) =>
      syncReminders(state, records, schoolId, new Date()),
    );
  }, [role, schoolId, records]);
  const [collapsedPreference, setCollapsed] = usePreference(
    sidebarPreferenceKey,
    "false",
  );
  const collapsed = collapsedPreference === "true";
  const menu = useRef<HTMLDialogElement>(null);
  return (
    <div
      className="app-shell"
      data-role={role}
      data-stage={stage}
      data-school={schoolId}
      data-theme={
        preschool.enabled && role !== "super-admin" ? "oak-ivy" : undefined
      }
      data-collapsed={collapsed ? "true" : undefined}
      style={role === "super-admin" ? undefined : brandStyle(branding)}
    >
      <SessionGuard role={role} school={schoolId} />
      <a className="skip-link" href="#main-content">
        Skip to page content
      </a>
      <aside className="app-sidebar">
        <Sidebar
          role={role}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(String(!collapsed))}
        />
      </aside>
      <div className="dashboard-stage">
        <DashboardHeader onOpenMenu={() => menu.current?.showModal()} />
        {preschool.enabled && <UrgentBanner />}
        <main
          id="main-content"
          className="dashboard-main"
          tabIndex={-1}
          key={scopeKey}
        >
          {children}
        </main>
      </div>
      <dialog
        ref={menu}
        className="mobile-dialog"
        aria-label="Navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) menu.current?.close();
        }}
      >
        <button
          className="icon-button dialog-close"
          type="button"
          aria-label="Close navigation"
          onClick={() => menu.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <Sidebar role={role} onNavigate={() => menu.current?.close()} />
      </dialog>
      {(!preschool.enabled || preschool.showAssistant) && (
        <ChatAssistant key={scopeKey} />
      )}
    </div>
  );
}

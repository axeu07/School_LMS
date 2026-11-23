"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { DemoRole } from "@/types/demo";
import { DemoProvider, useDemo } from "./demo-context";
import { DashboardHeader, Sidebar } from "./dashboard-navigation";
import { EmptyState } from "./dashboard-widgets";
import { sidebarPreferenceKey, usePreference } from "./preferences";

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
  const { schoolId, scopeKey } = useDemo();
  const [collapsedPreference, setCollapsed] = usePreference(
    sidebarPreferenceKey,
    "false",
  );
  const collapsed = collapsedPreference === "true";
  const menu = useRef<HTMLDialogElement>(null);
  return (
    <div
      className="app-shell"
      data-school={schoolId}
      data-collapsed={collapsed ? "true" : undefined}
    >
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
    </div>
  );
}

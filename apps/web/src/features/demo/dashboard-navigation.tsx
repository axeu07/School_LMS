"use client";

import { useRef, useState, type FocusEvent, type MouseEvent } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/common/brand";
import type { DemoRole, DemoRow } from "@/types/demo";
import { useDemo } from "./demo-context";
import { DemoBanner, PersonIcon, SchoolSelector, roleIcons } from "./demo-ui";
import { EmptyState } from "./dashboard-widgets";
import { findNavItem, navItems, navigation, roleHref } from "./navigation";

function useActiveSlug(role: DemoRole) {
  const pathname = usePathname();
  const base = roleHref(role);
  if (pathname === base) return "";
  return pathname.startsWith(base + "/")
    ? pathname.slice(base.length + 1).split("/")[0]
    : undefined;
}

export function Sidebar({
  role,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  role: DemoRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { data, profile } = useDemo();
  const active = useActiveSlug(role);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<{ label: string; top: number }>();
  const RoleIcon = roleIcons[role];
  const showTip = (
    label: string,
    event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>,
  ) => {
    if (!collapsed) return;
    const box = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: Math.round(box.top + box.height / 2) });
  };

  return (
    <div className="sidebar-inner">
      <div className="sidebar-top">
        <Brand />
        {onToggleCollapse && (
          <button
            type="button"
            className="icon-button collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => {
              setTooltip(undefined);
              onToggleCollapse();
            }}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <nav
        className="sidebar-nav"
        aria-label={profile.label + " navigation"}
        onScroll={() => setTooltip(undefined)}
      >
        {navigation[role].map((group) => {
          const id = "nav-" + role + "-" + group.label.replace(/\W+/g, "-");
          const open = collapsed || !closedGroups[group.label];
          const single = group.items.length === 1;
          return (
            <div className="nav-group" key={group.label}>
              {!single &&
                (collapsed ? (
                  <hr className="nav-divider" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    className="nav-group-toggle"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() =>
                      setClosedGroups((groups) => ({
                        ...groups,
                        [group.label]: open,
                      }))
                    }
                  >
                    {group.label}
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                ))}
              <ul id={id} hidden={!open}>
                {group.items.map((entry) => {
                  const Icon = entry.icon;
                  const label =
                    entry.title +
                    (entry.status === "preview" ? " (preview)" : "");
                  return (
                    <li key={entry.slug}>
                      <Link
                        href={roleHref(role, entry.slug)}
                        className="nav-link"
                        aria-current={
                          active === entry.slug ? "page" : undefined
                        }
                        aria-label={collapsed ? label : undefined}
                        onClick={onNavigate}
                        onMouseEnter={(event) => showTip(label, event)}
                        onMouseLeave={() => setTooltip(undefined)}
                        onFocus={(event) => showTip(label, event)}
                        onBlur={() => setTooltip(undefined)}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span className="nav-label">{entry.title}</span>
                        {entry.status === "preview" && (
                          <span className="nav-badge" aria-hidden="true">
                            Preview
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-person">
          <span className="person-avatar">
            <RoleIcon size={17} aria-hidden="true" />
          </span>
          <span className="nav-label">
            <strong>{data.person.name}</strong>
            <small>{profile.label}</small>
          </span>
        </div>
        <Link
          href="/demo/select-profile"
          className="nav-link"
          aria-label={collapsed ? "Switch demo role" : undefined}
          onMouseEnter={(event) => showTip("Switch demo role", event)}
          onMouseLeave={() => setTooltip(undefined)}
          onFocus={(event) => showTip("Switch demo role", event)}
          onBlur={() => setTooltip(undefined)}
        >
          <UsersRound size={18} aria-hidden="true" />
          <span className="nav-label">Switch Demo Role</span>
        </Link>
      </div>
      {collapsed && tooltip && (
        <span
          className="nav-tooltip"
          aria-hidden="true"
          style={{ top: tooltip.top }}
        >
          {tooltip.label}
        </span>
      )}
    </div>
  );
}

function Notifications({ rows, href }: { rows: DemoRow[]; href?: string }) {
  const [read, setRead] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null);
  return (
    <details className="popover" ref={panel}>
      <summary className="icon-button" aria-label="Notifications">
        <Bell size={19} aria-hidden="true" />
        {rows.length > 0 && !read && (
          <span className="unread-dot" aria-label="Unread" />
        )}
      </summary>
      <div className="popover-panel">
        <div className="popover-title">
          <h2>Notifications</h2>
          {rows.length > 0 && !read && (
            <button
              type="button"
              className="text-button"
              onClick={() => setRead(true)}
            >
              Mark as read
            </button>
          )}
        </div>
        {rows.length ? (
          <ul className="popover-list">
            {rows.map((row) => (
              <li key={row.title}>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No notifications.</EmptyState>
        )}
        {href && (
          <Link
            className="view-all popover-footer"
            href={href}
            onClick={() => panel.current?.removeAttribute("open")}
          >
            View all
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </details>
  );
}

export function DashboardHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const {
    role,
    profile,
    data,
    school,
    schools,
    scopeKey,
    setSchool,
    setChild,
  } = useDemo();
  const searchDialog = useRef<HTMLDialogElement>(null);
  const profileMenu = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const results = navItems(role).filter((entry) =>
    (entry.title + " " + entry.description + " " + entry.group)
      .toLowerCase()
      .includes(term),
  );
  const notificationsHref = findNavItem(role, "announcements")
    ? roleHref(role, "announcements")
    : roleHref(role, "schools");
  const initials = data.person.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <header className="dashboard-header">
      <button
        className="icon-button mobile-menu"
        type="button"
        aria-label="Open navigation"
        onClick={onOpenMenu}
      >
        <Menu size={21} aria-hidden="true" />
      </button>
      <button
        className="search-trigger"
        type="button"
        aria-label="Search pages"
        onClick={() => {
          setQuery("");
          searchDialog.current?.showModal();
        }}
      >
        <Search size={18} aria-hidden="true" />
        <span>Search pages</span>
      </button>
      <div className="header-actions">
        <div className="context-controls">
          {role !== "super-admin" && (
            <SchoolSelector
              school={school}
              schools={schools}
              onChange={setSchool}
            />
          )}
          {role === "parent" && data.child && (
            <label className="school-selector child-selector">
              <span className="sr-only">Linked child</span>
              <select
                value={data.child.id}
                onChange={(event) => setChild(event.target.value)}
              >
                {data.children.map(({ id, name }) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
          )}
        </div>
        <Notifications
          key={scopeKey}
          rows={data.notifications}
          href={notificationsHref}
        />
        <details className="popover" ref={profileMenu}>
          <summary className="profile-trigger" aria-label="Profile menu">
            <span className="person-avatar">{initials}</span>
            <span className="profile-name">
              <strong>{data.person.name}</strong>
              <small>{profile.label}</small>
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="popover-panel profile-panel">
            <p className="popover-title">{data.person.name}</p>
            <DemoBanner />
            <Link
              href="/demo/select-profile"
              onClick={() => profileMenu.current?.removeAttribute("open")}
            >
              <PersonIcon />
              Switch Demo Role
            </Link>
            <Link href="/">
              <LogOut size={17} aria-hidden="true" />
              Logout Demo
            </Link>
          </div>
        </details>
      </div>
      <dialog
        ref={searchDialog}
        className="search-dialog"
        aria-labelledby="search-title"
      >
        <div className="dialog-heading">
          <h2 id="search-title">Go to a page</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close search"
            onClick={() => searchDialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search pages</span>
          <input
            placeholder={"Search " + profile.label + " pages"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {results.length ? (
          <ul className="popover-list search-results">
            {results.map((entry) => {
              const Icon = entry.icon;
              return (
                <li key={entry.slug}>
                  <Link
                    href={roleHref(role, entry.slug)}
                    onClick={() => searchDialog.current?.close()}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>
                      <strong>{entry.title}</strong>
                      <span>
                        {entry.group} · {entry.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No matching pages.</EmptyState>
        )}
      </dialog>
    </header>
  );
}

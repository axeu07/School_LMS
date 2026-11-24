"use client";

import { useRef, useState, type FocusEvent, type MouseEvent } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LogIn,
  LogOut,
  ShieldCheck,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/common/brand";
import { SchoolBrand } from "../brand/school-brand";
import { signOutTo, useWorkspaceSession } from "./session-guard";
import type { DemoRole, DemoRow } from "@/types/demo";
import { useDemo } from "./demo-context";
import { DemoBanner, PersonIcon, SchoolSelector, roleIcons } from "./demo-ui";
import { EmptyState } from "./dashboard-widgets";
import { findNavItem, navItems, navigation, roleHref } from "./navigation";
import { formatDateTime } from "./format";
import { leaveSlug } from "./leave/leave-widgets";
import {
  leaveSchool,
  markNotificationsRead,
  notificationsFor,
} from "@/services/leave-model";
import { updateLeaveState, useLeaveState } from "@/services/leave-store";
import { readNotifications } from "@/services/communication-model";
import { localDateTime } from "@/services/learning-model";
import {
  updateCommunicationState,
  useCommunicationState,
} from "@/services/communication-store";
import { notificationsFor as appNotificationsFor } from "@/services/notification-model";

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
  const { data, profile, schoolId } = useDemo();
  const session = useWorkspaceSession(role, schoolId);
  const router = useRouter();
  const active = useActiveSlug(role);
  // Accordion: only one group is open at a time. By default that is the group
  // holding the current page; a header click overrides it until the user
  // navigates again, at which point the new page's group takes over.
  const activeGroup = navigation[role].find((group) =>
    group.items.some((entry) => entry.slug === active),
  )?.label;
  const [choice, setChoice] = useState<{
    active: string | undefined;
    group: string | null;
  }>();
  const openGroup =
    choice && choice.active === active ? choice.group : (activeGroup ?? null);
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
        {role === "super-admin" ? (
          <Brand />
        ) : (
          <SchoolBrand school={schoolId} href={roleHref(role)} />
        )}
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
          const single = group.items.length === 1;
          const open = collapsed || single || openGroup === group.label;
          const holdsActive = activeGroup === group.label;
          return (
            <div
              className="nav-group"
              key={group.label}
              data-open={open ? "true" : undefined}
              data-single={single ? "true" : undefined}
            >
              {!single &&
                (collapsed ? (
                  <hr className="nav-divider" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    className="nav-group-toggle"
                    aria-expanded={open}
                    aria-controls={id}
                    data-has-active={holdsActive ? "true" : undefined}
                    onClick={() =>
                      setChoice({ active, group: open ? null : group.label })
                    }
                  >
                    <span>{group.label}</span>
                    {!open && (
                      <span className="nav-group-count" aria-hidden="true">
                        {group.items.length}
                      </span>
                    )}
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                ))}
              <div className="nav-group-panel" inert={!open}>
                <ul id={id}>
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
          <button
            type="button"
            className="sidebar-signout"
            aria-label="Sign out"
            title={collapsed ? undefined : "Sign out"}
            onMouseEnter={(event) => showTip("Sign out", event)}
            onMouseLeave={() => setTooltip(undefined)}
            onFocus={(event) => showTip("Sign out", event)}
            onBlur={() => setTooltip(undefined)}
            onClick={() =>
              session
                ? signOutTo(router, session, "signedOut")
                : router.push("/")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
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
  const { role, records, actor, setChild } = useDemo();
  const [read, setRead] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const leave = leaveSchool(useLeaveState(), actor.school);
  const notices = notificationsFor(leave, records, actor).slice(0, 8);
  const updates = appNotificationsFor(
    useCommunicationState().schools[actor.school]?.notifications ?? [],
    actor,
  );
  const unreadUpdates = updates.filter((item) => !item.readAt).length;
  const unreadNotices =
    notices.filter((item) => !item.read).length + unreadUpdates;
  const slug = leaveSlug[role];
  const unread = unreadNotices > 0 || (rows.length > 0 && !read);
  const close = () => panel.current?.removeAttribute("open");
  return (
    <details className="popover" ref={panel}>
      <summary
        className="icon-button"
        aria-label={
          "Notifications" +
          (unreadNotices ? ", " + unreadNotices + " unread" : "")
        }
      >
        <Bell size={19} aria-hidden="true" />
        {unreadNotices > 0 ? (
          <span className="unread-count" aria-hidden="true">
            {unreadNotices > 9 ? "9+" : unreadNotices}
          </span>
        ) : (
          unread && <span className="unread-dot" aria-label="Unread" />
        )}
      </summary>
      <div className="popover-panel">
        <div className="popover-title">
          <h2>Notifications</h2>
          {unread && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setRead(true);
                updateLeaveState((state) =>
                  markNotificationsRead(state, records, actor, "all"),
                );
                updateCommunicationState((state) =>
                  readNotifications(state, actor, "all", new Date()),
                );
              }}
            >
              Mark as read
            </button>
          )}
        </div>
        {updates.length > 0 && (
          <ul
            className="popover-list app-notices"
            aria-label="Calendar, PTM and message updates"
          >
            {updates.slice(0, 8).map((item) => (
              <li key={item.id} className={item.readAt ? "" : "is-unread"}>
                <Link
                  href={item.href}
                  onClick={() => {
                    updateCommunicationState((state) =>
                      readNotifications(state, actor, item.id, new Date()),
                    );
                    close();
                  }}
                >
                  <strong>
                    {item.title}
                    {item.count > 1 && " (" + item.count + " new)"}
                  </strong>
                  <span>{item.body}</span>
                  <small suppressHydrationWarning>
                    {formatDateTime(localDateTime(new Date(item.createdAt)))}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {notices.length > 0 && slug && (
          <ul
            className="popover-list leave-notices"
            aria-label="Leave and attendance alerts"
          >
            {notices.map((item) => (
              <li
                key={item.id}
                className={
                  (item.read ? "" : "is-unread ") +
                  (item.kind === "absence"
                    ? item.state === "Active"
                      ? "is-alert"
                      : "is-resolved"
                    : "")
                }
              >
                <Link
                  href={roleHref(role, slug)}
                  onClick={() => {
                    if (role === "parent" && item.student)
                      setChild(item.student);
                    updateLeaveState((state) =>
                      markNotificationsRead(state, records, actor, [item.id]),
                    );
                    close();
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>{formatDateTime(item.created)}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
          !notices.length &&
          !updates.length && <EmptyState>No notifications.</EmptyState>
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
    schoolId,
    setSchool,
    setChild,
  } = useDemo();
  const session = useWorkspaceSession(role, schoolId);
  const router = useRouter();
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
          {role !== "super-admin" && !session && (
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
            {session ? (
              <p className="session-pill">
                <ShieldCheck size={14} aria-hidden="true" />
                Signed in ·{" "}
                {session.method === "otp" ? "phone OTP" : "password"}
              </p>
            ) : (
              <DemoBanner />
            )}
            {!session && (
              <Link
                href={
                  "/login/" + (role === "super-admin" ? "platform" : schoolId)
                }
              >
                <LogIn size={17} aria-hidden="true" />
                Sign in
              </Link>
            )}
            <Link
              href="/demo/select-profile"
              onClick={() => profileMenu.current?.removeAttribute("open")}
            >
              <PersonIcon />
              Switch Demo Role
            </Link>
            {session ? (
              <button
                type="button"
                onClick={() => signOutTo(router, session, "signedOut")}
              >
                <LogOut size={17} aria-hidden="true" />
                Sign out
              </button>
            ) : (
              <Link href="/">
                <LogOut size={17} aria-hidden="true" />
                Leave demo
              </Link>
            )}
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

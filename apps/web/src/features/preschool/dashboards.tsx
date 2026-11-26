"use client";

import {
  BookOpen,
  BusFront,
  DoorOpen,
  GraduationCap,
  IndianRupee,
  KeyRound,
  MessageSquareText,
  NotebookText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smile,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { calendarEntries } from "@/services/calendar-model";
import { feeTotals, invoicesFor } from "@/services/fee-model";
import { formatRupees } from "@/services/fee-store";
import Link from "next/link";
import {
  addDays,
  broadcastFamilies,
  broadcastsFor,
  childrenFor,
  dayStatus,
  diaryFor,
  healthOf,
  riderOf,
  visibleDiaries,
} from "@/services/preschool-model";
import { usePreschoolSchool } from "@/services/preschool-store";
import { livePosition, stopStatus } from "@/services/transport-sim";
import { ColumnChart } from "@/features/demo/dashboard/charts";
import {
  DashAlert,
  DashboardIntro,
  DashRow,
  DateToken,
  KpiGrid,
  Panel,
  QuickActions,
  RowList,
  type Row,
} from "@/features/demo/dashboard/kit";
import { greetingFor, relativeDay } from "@/features/demo/dashboard/metrics";
import type { DashboardSources } from "@/features/demo/dashboard/use-dashboard";
import { formatDate } from "@/features/demo/format";
import { moodOf } from "./daily-diary";
import { TransportMap } from "./transport";
import { friendlyTime } from "./ui";

function upcomingEvents(sources: DashboardSources): Row[] {
  const { comm, learningState, records, actor, leave, today, href } = sources;
  return calendarEntries(comm, learningState, records, actor, leave)
    .filter(
      (item) =>
        item.status === "Published" &&
        item.endDate >= today &&
        (item.source === "event" || item.source === "exam"),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((item) => ({
      key: item.key,
      title: item.title,
      detail: item.description || "School event",
      meta:
        item.startDate < today ? "Ongoing" : relativeDay(item.startDate, today),
      lead: <DateToken date={item.startDate} />,
      href: href("calendar"),
    }));
}

/* ========================================================================
   Parent: "how is my child today?"
   ======================================================================== */

export function PreschoolParentDashboard({
  sources,
}: {
  sources: DashboardSources;
}) {
  const { records, actor, data, today, now, href, fees } = sources;
  const school = usePreschoolSchool(sources.schoolId);
  const child = data.child;
  const actions = (
    <QuickActions
      actions={[
        ...sources.action("daily-diary", "Today's diary", NotebookText),
        ...sources.action("pickup", "Pickup pass", KeyRound),
        ...sources.action("transport", "Track bus", BusFront),
        ...sources.action("messages", "Message teacher", MessageSquareText),
      ]}
    />
  );
  if (!child)
    return (
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context="No children are linked to your account yet. Please contact the school office."
        aside={actions}
      />
    );
  const first = child.name.split(" ")[0];
  const status = dayStatus(school, child.id, today);
  const diary = visibleDiaries(school, records, actor).find(
    (item) => item.student === child.id && item.date === today,
  );
  const ride = riderOf(school, child.id);
  const live = ride
    ? livePosition(ride.vehicle, ride.route, now.getTime())
    : undefined;
  const bus =
    ride && live ? stopStatus(ride.route, ride.stop, live, first) : undefined;
  const invoices = invoicesFor(fees, records, actor);
  const totals = feeTotals(fees, invoices, today);
  const health = healthOf(school, child.id);
  const incidents = school.incidents.filter(
    (item) =>
      item.student === child.id && item.status === "Awaiting acknowledgement",
  );
  const pass = school.passes.find(
    (item) =>
      item.student === child.id &&
      item.date === today &&
      item.status === "Active",
  );
  const alerts = broadcastsFor(school, records, actor).filter(
    (item) => item.active && !item.acks.includes(actor.person),
  );
  const section = childrenFor(records, actor).find(
    (item) => item.id === child.id,
  );

  const todayRows: Row[] = [
    ...(pass
      ? [
          {
            key: "pass",
            title: pass.name + " is picking up " + first,
            detail:
              "Pickup pass · around " +
              friendlyTime(pass.time) +
              " · OTP " +
              pass.otp,
            tone: "accent" as const,
            href: href("pickup"),
          },
        ]
      : []),
    ...health.medicines
      .filter((item) => item.until >= today)
      .map((item) => ({
        key: item.id,
        title: item.name + " at " + friendlyTime(item.time),
        detail: item.dose + " · given by the class teacher",
        href: href("health"),
      })),
    ...incidents.map((item) => ({
      key: item.id,
      title: item.kind + " report needs your acknowledgement",
      detail: item.description,
      tone: "warn" as const,
      href: href("health"),
    })),
  ];

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          status.state === "In school"
            ? first +
              " checked in at " +
              friendlyTime(status.in!.time) +
              " and is safely at school."
            : status.state === "Picked up"
              ? first +
                " was picked up at " +
                friendlyTime(status.out!.time) +
                " by " +
                status.out!.person +
                "."
              : first + " hasn't checked in yet today."
        }
        aside={
          <>
            <div className="db-child">
              <span className="db-avatar" aria-hidden="true">
                {child.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="db-child-copy">
                <strong>{child.name}</strong>
                <small>{section?.sectionLabel ?? "No class"}</small>
              </span>
              {data.children
                .filter((item) => item.id !== child.id)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="db-child-switch"
                    onClick={() => sources.setChild(item.id)}
                  >
                    Switch to {item.name.split(" ")[0]}
                  </button>
                ))}
            </div>
            {actions}
          </>
        }
      />
      {incidents[0] && (
        <DashAlert href={href("health")} action="Read report">
          {incidents[0].kind} report from {formatDate(incidents[0].date)} is
          waiting for your acknowledgement.
        </DashAlert>
      )}
      <KpiGrid
        items={[
          {
            label: "At school today",
            value: status.in ? friendlyTime(status.in.time) : "—",
            hint:
              status.state === "Picked up"
                ? "Left " + friendlyTime(status.out!.time)
                : status.state === "In school"
                  ? "Checked in · " +
                    (status.in!.method === "School bus"
                      ? "by bus"
                      : status.in!.person)
                  : "Not arrived yet",
            icon: status.state === "Not arrived" ? DoorOpen : ShieldCheck,
            href: href("pickup"),
            tone: status.state === "In school" ? "good" : undefined,
          },
          {
            label: "Mood today",
            value: diary
              ? moodOf(diary.mood).emoji + " " + moodOf(diary.mood).label
              : "—",
            hint: diary
              ? "Lunch: " + diary.meals.lunch + " eaten"
              : "Diary arrives by 2:30 pm",
            icon: Smile,
            href: href("daily-diary"),
          },
          {
            label: "School bus",
            value: bus
              ? bus.minutes
                ? bus.minutes + " min"
                : live!.phase
              : "—",
            hint: bus
              ? bus.title + " · " + ride!.vehicle.number
              : "Parent drop-off",
            icon: BusFront,
            href: href("transport"),
            tone: bus?.tone === "warn" ? "attention" : undefined,
          },
          {
            label: "Fees due",
            value: formatRupees(totals.outstanding),
            hint: totals.outstanding
              ? totals.overdue
                ? "Overdue — pay now"
                : "Pay online"
              : "All paid",
            icon: IndianRupee,
            href: href("fees"),
            tone:
              totals.overdue > 0
                ? "attention"
                : totals.outstanding
                  ? undefined
                  : "good",
          },
        ]}
      />
      <DashRow layout="wide-left" label="Today">
        <Panel
          title={first + "'s day"}
          subtitle={
            diary
              ? "From " + diary.author
              : "Today's diary hasn't been sent yet"
          }
          href={href("daily-diary")}
          hrefLabel="Open diary"
        >
          {diary ? (
            <div className="pk-dash-diary">
              <span className="pk-dash-mood" aria-hidden="true">
                {moodOf(diary.mood).emoji}
              </span>
              <ul>
                <li>
                  <strong>Meals</strong> Breakfast{" "}
                  {diary.meals.breakfast.toLowerCase()}, lunch{" "}
                  {diary.meals.lunch.toLowerCase()}, snack{" "}
                  {diary.meals.snack.toLowerCase()}
                </li>
                <li>
                  <strong>Nap</strong>{" "}
                  {diary.napStart
                    ? friendlyTime(diary.napStart) +
                      " – " +
                      friendlyTime(diary.napEnd)
                    : "No nap"}
                </li>
                <li>
                  <strong>Activities</strong> {diary.activities.join(", ")}
                </li>
              </ul>
              {diary.note && <blockquote>“{diary.note}”</blockquote>}
            </div>
          ) : (
            <RowList
              rows={todayRows}
              limit={4}
              empty={
                "Nothing needs your attention. " +
                first +
                "'s diary arrives this afternoon."
              }
            />
          )}
        </Panel>
        {ride && live ? (
          <Panel
            title="Bus live"
            subtitle={ride.vehicle.label + " · " + ride.route.name}
            href={href("transport")}
            hrefLabel="Track"
          >
            <TransportMap
              routes={[ride.route]}
              vehicles={[{ vehicle: ride.vehicle, live }]}
              focus={ride.vehicle.id}
              childStop={{
                route: ride.route.id,
                stop: ride.stop.id,
                name: first + "'s stop",
              }}
              label={"Live position of " + first + "'s bus"}
            />
          </Panel>
        ) : (
          <Panel title="Coming up" href={href("calendar")}>
            <RowList
              rows={upcomingEvents(sources)}
              limit={4}
              empty="Nothing scheduled."
            />
          </Panel>
        )}
      </DashRow>
      <DashRow layout="thirds" label="More">
        <Panel title="Needs attention" href={href("health")}>
          <RowList
            rows={[
              ...alerts.map((item) => ({
                key: item.id,
                title: item.title,
                detail: "Urgent alert · tap Got it",
                tone: "danger" as const,
                href: href("emergency"),
              })),
              ...(diary ? todayRows : []),
            ]}
            limit={4}
            empty="All clear for today."
          />
        </Panel>
        <Panel title="Health snapshot" href={href("health")}>
          <RowList
            rows={[
              {
                key: "blood",
                title: "Blood group " + health.bloodGroup,
                detail: health.doctor.name
                  ? "Doctor: " + health.doctor.name
                  : "Add your doctor's details",
              },
              ...health.allergies.map((item) => ({
                key: item.id,
                title: item.name + " allergy",
                detail: item.severity + " · " + item.action,
                tone:
                  item.severity === "Severe"
                    ? ("danger" as const)
                    : ("warn" as const),
              })),
            ]}
            limit={3}
            empty="No health notes."
          />
        </Panel>
        <Panel title="Coming up" href={href("calendar")}>
          <RowList
            rows={upcomingEvents(sources)}
            limit={3}
            empty="Nothing scheduled."
          />
        </Panel>
      </DashRow>
    </>
  );
}

/* ========================================================================
   Teacher: "who is here, and what do I owe parents today?"
   ======================================================================== */

export function PreschoolTeacherDashboard({
  sources,
}: {
  sources: DashboardSources;
}) {
  const { records, actor, today, now, href } = sources;
  const school = usePreschoolSchool(sources.schoolId);
  const children = childrenFor(records, actor);
  const statuses = children.map((child) => ({
    child,
    status: dayStatus(school, child.id, today),
    diary: diaryFor(school, child.id, today),
    health: healthOf(school, child.id),
  }));
  const present = statuses.filter((row) => row.status.state !== "Not arrived");
  const inSchool = statuses.filter((row) => row.status.state === "In school");
  const sent = statuses.filter((row) => row.diary?.status === "Sent").length;
  const passes = school.passes.filter(
    (item) =>
      item.date === today &&
      item.status === "Active" &&
      children.some((c) => c.id === item.student),
  );
  const allergies = statuses.flatMap((row) =>
    row.health.allergies.map((allergy) => ({ child: row.child, allergy })),
  );
  const medicines = statuses
    .flatMap((row) =>
      row.health.medicines
        .filter((item) => item.until >= today)
        .map((medicine) => ({ child: row.child, medicine })),
    )
    .sort((a, b) => a.medicine.time.localeCompare(b.medicine.time));
  const nameOf = (id: string) =>
    children.find((c) => c.id === id)?.name ?? "Child";

  return (
    <>
      <DashboardIntro
        greeting={greetingFor(now) + ", " + sources.firstName}
        date={now}
        context={
          present.length +
          " of " +
          children.length +
          " children are in today. " +
          (children.length - sent) +
          " diaries still to send."
        }
        aside={
          <QuickActions
            actions={[
              ...sources.action("pickup", "Gate board", DoorOpen),
              ...sources.action("daily-diary", "Write diaries", NotebookText),
              ...sources.action("attendance", "Attendance", UserRoundCheck),
              ...sources.action("emergency", "Send alert", Siren),
            ]}
          />
        }
      />
      <KpiGrid
        items={[
          {
            label: "Checked in",
            value: present.length + "/" + children.length,
            hint: inSchool.length + " in school now",
            icon: ShieldCheck,
            ring: children.length
              ? Math.round((present.length / children.length) * 100)
              : 0,
            href: href("pickup"),
          },
          {
            label: "Diaries sent",
            value: sent + "/" + children.length,
            hint: sent === children.length ? "All sent" : "Send by 2:30 pm",
            icon: NotebookText,
            ring: children.length
              ? Math.round((sent / children.length) * 100)
              : 0,
            href: href("daily-diary"),
            tone: sent < children.length ? "attention" : "good",
          },
          {
            label: "Pickup passes",
            value: String(passes.length),
            hint: passes[0]
              ? passes[0].name +
                " for " +
                nameOf(passes[0].student).split(" ")[0]
              : "None today",
            icon: KeyRound,
            href: href("pickup"),
          },
          {
            label: "Allergy alerts",
            value: String(allergies.length),
            hint:
              allergies.filter((row) => row.allergy.severity === "Severe")
                .length + " severe",
            icon: ShieldAlert,
            href: href("health"),
            tone: allergies.some((row) => row.allergy.severity === "Severe")
              ? "attention"
              : undefined,
          },
        ]}
      />
      <DashRow layout="wide-left" label="Today">
        <Panel
          title="Class today"
          subtitle="Arrival, mood and diary for each child"
          href={href("pickup")}
          hrefLabel="Gate board"
        >
          <ul className="pk-dash-roster">
            {statuses.map(({ child, status, diary, health }) => (
              <li key={child.id} data-state={status.state}>
                <span className="pk-dash-roster-name">
                  <strong>{child.name}</strong>
                  <small>{child.sectionLabel}</small>
                </span>
                <span className="pk-dash-roster-meta">
                  {health.allergies.length > 0 && (
                    <ShieldAlert
                      size={14}
                      className="pk-flag"
                      aria-label="Allergy"
                    />
                  )}
                  {diary && (
                    <span aria-hidden="true">{moodOf(diary.mood).emoji}</span>
                  )}
                  <span className="pk-dash-state">
                    {status.state === "In school"
                      ? "In · " + friendlyTime(status.in!.time)
                      : status.state === "Picked up"
                        ? "Left · " + friendlyTime(status.out!.time)
                        : "Not arrived"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Medicines & pickups" href={href("health")}>
          <RowList
            rows={[
              ...medicines.map(({ child, medicine }) => ({
                key: medicine.id,
                title:
                  friendlyTime(medicine.time) +
                  " · " +
                  child.name.split(" ")[0],
                detail: medicine.name + " " + medicine.dose,
                tone: "accent" as const,
              })),
              ...passes.map((pass) => ({
                key: pass.id,
                title:
                  pass.name + " collects " + nameOf(pass.student).split(" ")[0],
                detail:
                  "Pass · around " +
                  friendlyTime(pass.time) +
                  " · verify OTP or QR",
                href: href("pickup"),
              })),
            ]}
            limit={5}
            empty="No medicines or special pickups today."
          />
        </Panel>
      </DashRow>
      <DashRow layout="halves" label="More">
        <Panel title="Allergy alerts" href={href("health")}>
          <RowList
            rows={allergies.map(({ child, allergy }) => ({
              key: child.id + allergy.id,
              title: child.name + " · " + allergy.name,
              detail: allergy.action,
              tone:
                allergy.severity === "Severe"
                  ? ("danger" as const)
                  : ("warn" as const),
            }))}
            limit={4}
            empty="No allergies in your classes."
          />
        </Panel>
        <Panel title="Coming up" href={href("calendar")}>
          <RowList
            rows={upcomingEvents(sources)}
            limit={4}
            empty="Nothing scheduled."
          />
        </Panel>
      </DashRow>
    </>
  );
}

/* ========================================================================
   School office: "School overview"
   ======================================================================== */

export function PreschoolAdminDashboard({
  sources,
}: {
  sources: DashboardSources;
}) {
  const { records, actor, today, now, href } = sources;
  const school = usePreschoolSchool(sources.schoolId);
  const children = childrenFor(records, actor);
  const sections = records.sections.filter((item) => item.status === "Active");
  const staff = records.teachers.filter((item) => item.status === "Active");
  const present = children.filter(
    (child) => dayStatus(school, child.id, today).state !== "Not arrived",
  ).length;
  const sent = children.filter(
    (child) => diaryFor(school, child.id, today)?.status === "Sent",
  ).length;

  // Weekly attendance this month, from the gate log (falls back to marks).
  const monthDays = [...new Set(school.gate.map((item) => item.date))]
    .filter(
      (date) =>
        date.slice(0, 7) === today.slice(0, 7) || date >= addDays(today, -27),
    )
    .sort();
  const weeks = [0, 1, 2, 3].map((index) => {
    const end = addDays(today, -7 * (3 - index));
    const start = addDays(end, -6);
    const days = monthDays.filter((date) => date >= start && date <= end);
    const rate = days.length
      ? Math.round(
          (days.reduce(
            (sum, date) =>
              sum +
              children.filter((child) => dayStatus(school, child.id, date).in)
                .length,
            0,
          ) /
            (days.length * Math.max(1, children.length))) *
            100,
        )
      : undefined;
    return { label: "W" + (index + 1), value: rate };
  });
  const demoWeeks = [91, 94, 93, 96];
  const usingDemo = weeks.filter((week) => week.value !== undefined).length < 2;
  const chart = weeks.map((week, index) => ({
    label: week.label,
    value: usingDemo ? demoWeeks[index] : (week.value ?? 0),
  }));

  const active = school.broadcasts.filter((item) => item.active);
  const incidents = school.incidents.filter(
    (item) => item.status === "Awaiting acknowledgement",
  );
  const pending = school.pickupPeople.filter(
    (item) => item.status === "Pending approval",
  );
  const fleet = school.vehicles.map((vehicle) => {
    const route = school.routes.find((item) => item.id === vehicle.route)!;
    return {
      vehicle,
      route,
      live: livePosition(vehicle, route, now.getTime()),
    };
  });
  const fees = sources.fees;
  const totals = feeTotals(fees, invoicesFor(fees, records, actor), today);

  return (
    <>
      <DashboardIntro
        greeting="School overview"
        date={now}
        context={
          present +
          " of " +
          children.length +
          " children are in today · " +
          sent +
          " diaries sent · " +
          fleet.filter((item) => item.live.moving).length +
          " vehicles on the road."
        }
        aside={
          <QuickActions
            actions={[
              ...sources.action("emergency", "Send alert", Siren),
              ...sources.action("transport", "Track vehicle", BusFront),
              ...sources.action("pickup", "Gate log", DoorOpen),
              ...sources.action("fees", "Fees", IndianRupee),
            ]}
          />
        }
      />
      {active[0] && (
        <DashAlert href={href("emergency")} action="View alert">
          Active alert: {active[0].title} · seen by {active[0].acks.length} of{" "}
          {broadcastFamilies(records, active[0].audience).length} families
        </DashAlert>
      )}
      <div className="pk-overview-stats">
        <OverviewStat
          icon={UsersRound}
          value={children.length}
          label="Children"
          href={href("students")}
        />
        <OverviewStat
          icon={BookOpen}
          value={sections.length}
          label="Classes"
          href={href("classes")}
        />
        <OverviewStat
          icon={GraduationCap}
          value={staff.length}
          label="Staff"
          href={href("teachers")}
        />
        <OverviewStat
          icon={ShieldCheck}
          value={present}
          label="In today"
          href={href("pickup")}
        />
      </div>
      <DashRow layout="wide-left" label="Attendance and events">
        <Panel
          title="Attendance rate"
          subtitle="Last four weeks, from gate check-ins"
          demo={usingDemo}
          href={href("attendance")}
        >
          <ColumnChart
            items={chart}
            label="Weekly attendance rate"
            max={100}
            threshold={75}
          />
        </Panel>
        <Panel title="Upcoming events" href={href("calendar")}>
          <RowList
            rows={upcomingEvents(sources)}
            limit={4}
            empty="Nothing scheduled."
          />
        </Panel>
      </DashRow>
      <DashRow layout="thirds" label="Care and safety">
        <Panel title="Fleet" href={href("transport")} hrefLabel="Track">
          <RowList
            rows={fleet.map(({ vehicle, route, live }) => ({
              key: vehicle.id,
              title: vehicle.number,
              detail: vehicle.label + " · " + route.name,
              meta:
                vehicle.status === "Maintenance"
                  ? "Workshop"
                  : live.moving
                    ? live.speedKmh + " km/h"
                    : live.phase,
              tone:
                vehicle.status === "Maintenance"
                  ? ("warn" as const)
                  : live.moving
                    ? ("good" as const)
                    : undefined,
              href: href("transport"),
            }))}
            empty="No vehicles."
          />
        </Panel>
        <Panel title="Needs action" href={href("pickup")}>
          <RowList
            rows={[
              ...pending.map((item) => ({
                key: item.id,
                title: "Approve " + item.name + " for pickup",
                detail: item.relation + " · added by a parent",
                tone: "warn" as const,
                href: href("pickup"),
              })),
              ...incidents.map((item) => ({
                key: item.id,
                title: item.kind + " report awaiting parent",
                detail: formatDate(item.date) + " · " + item.description,
                href: href("health"),
              })),
              {
                key: "diaries",
                title: sent + "/" + children.length + " diaries sent today",
                detail: "Teachers send them by 2:30 pm",
                tone:
                  sent < children.length
                    ? ("accent" as const)
                    : ("good" as const),
                href: href("daily-diary"),
              },
            ]}
            limit={4}
            empty="Nothing needs action."
          />
        </Panel>
        <Panel title="Fees" href={href("fees")}>
          <RowList
            rows={[
              {
                key: "collected",
                title: formatRupees(totals.collected) + " collected",
                detail: "This academic year",
                tone: "good",
              },
              {
                key: "outstanding",
                title: formatRupees(totals.outstanding) + " outstanding",
                detail: totals.overdue
                  ? formatRupees(totals.overdue) + " overdue"
                  : "Nothing overdue",
                tone: totals.overdue ? "warn" : undefined,
              },
            ]}
            empty="No fees."
          />
        </Panel>
      </DashRow>
    </>
  );
}

function OverviewStat({
  icon: Icon,
  value,
  label,
  href,
}: {
  icon: typeof UsersRound;
  value: number;
  label: string;
  href: string;
}) {
  return (
    <Link className="pk-overview-stat" href={href}>
      <span className="pk-overview-icon">
        <Icon size={26} aria-hidden="true" />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </Link>
  );
}

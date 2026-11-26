"use client";

import { useState, type FormEvent } from "react";
import {
  BellRing,
  BusFront,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Route as RouteIcon,
  Search,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  assignRider,
  findVehicle,
  riderOf,
  setVehicleStatus,
  trackableVehicles,
  type BusRoute,
  type Vehicle,
} from "@/services/preschool-model";
import { updatePreschoolState } from "@/services/preschool-store";
import {
  livePosition,
  minutesTo,
  pingMs,
  speedUp,
  stopStatus,
  type LivePosition,
} from "@/services/transport-sim";
import { oakIvyLogo } from "@/services/oak-ivy-logo";
import { usePreference } from "@/features/demo/preferences";
import { FormDialog, type FormConfig } from "@/features/demo/form-dialog";
import {
  Avatar,
  Card,
  Empty,
  Note,
  Pill,
  Ready,
  Stat,
  friendlyTime,
  usePreschool,
  type Preschool,
} from "./ui";

export function TransportPage() {
  const p = usePreschool(1_000);
  return (
    <Ready now={p.now}>
      {p.role === "parent" ? (
        <ParentTransport p={p} />
      ) : (
        <FleetTracking p={p} />
      )}
      {p.toast.element}
    </Ready>
  );
}

const tel = (phone: string) => "tel:" + phone.replace(/\s/g, "");

function phaseTone(live: LivePosition) {
  return live.phase === "To school" || live.phase === "Drop-off run"
    ? "good"
    : "muted";
}

function secondsAgo(now: Date, live: LivePosition) {
  return Math.max(0, Math.round((now.getTime() - live.pingedAt) / 1000));
}

/* ========================================================================
   The map
   ======================================================================== */

const roads = [
  "M88 2 L77 11 L64 20 L55 28 L50 33 L44 39 L38 52 L34 70",
  "M100 41 L86 38 L71 35 L57 33.5 L50 33",
  "M0 55 L9 52 L23 46 L37 42 L44 39",
  "M44 39 L58 52 L72 70",
  "M30 70 L60 62 L100 55",
  "M3 68 L20 58 L38 52",
  "M64 20 L74 26 L86 38",
];
const roadLabels = [
  { text: "Rajpur Rd", x: 72, y: 12.5, angle: -35 },
  { text: "Sahastradhara Rd", x: 80, y: 41.2, angle: 9 },
  { text: "Chakrata Rd", x: 14, y: 53.2, angle: -22 },
  { text: "EC Rd", x: 55, y: 53, angle: 43 },
  { text: "Haridwar Rd", x: 78, y: 62.5, angle: -10 },
];

export type MapVehicle = { vehicle: Vehicle; live: LivePosition };

export function TransportMap({
  routes,
  vehicles,
  focus,
  childStop,
  onSelect,
  label,
}: {
  routes: BusRoute[];
  vehicles: MapVehicle[];
  focus?: string;
  childStop?: { route: string; stop: string; name: string };
  onSelect?: (id: string) => void;
  label: string;
}) {
  const focusRoute = vehicles.find((item) => item.vehicle.id === focus)?.vehicle
    .route;
  const school = routes[0]?.path[routes[0].path.length - 1] ?? { x: 50, y: 33 };
  return (
    <figure className="pk-map">
      <svg viewBox="0 0 100 70" role="img" aria-label={label}>
        <rect width="100" height="70" className="pk-map-land" />
        <path
          className="pk-map-hills"
          d="M0 0 H100 V6 C86 10 74 4 60 7 C46 10 30 3 14 8 C8 10 3 9 0 10 Z"
        />
        <ellipse className="pk-map-park" cx="14" cy="31" rx="10" ry="6.5" />
        <text className="pk-map-area" x="14" y="31.8">
          FRI campus
        </text>
        <ellipse className="pk-map-park" cx="45" cy="47" rx="4" ry="2.6" />
        <text className="pk-map-area" x="45" y="51.6">
          Gandhi Park
        </text>
        <path
          className="pk-map-river"
          d="M61 0 C58 14 67 24 63 38 S70 58 75 70"
        />
        <path
          className="pk-map-river"
          d="M30 0 C33 18 28 30 33 44 S30 60 26 70"
        />
        {roads.map((d) => (
          <g key={d}>
            <path className="pk-map-road-edge" d={d} />
            <path className="pk-map-road" d={d} />
          </g>
        ))}
        {roadLabels.map((item) => (
          <text
            key={item.text}
            className="pk-map-road-label"
            transform={`translate(${item.x} ${item.y}) rotate(${item.angle})`}
          >
            {item.text}
          </text>
        ))}
        {routes.map((route) => (
          <polyline
            key={route.id}
            className="pk-map-route"
            data-focus={!focusRoute || focusRoute === route.id ? "" : undefined}
            points={route.path
              .map((point) => point.x + "," + point.y)
              .join(" ")}
          />
        ))}
        {routes.flatMap((route) =>
          route.stops.map((stop) => {
            const mine =
              childStop?.route === route.id && childStop.stop === stop.id;
            const dim = focusRoute && focusRoute !== route.id;
            return (
              <g
                key={route.id + stop.id}
                className="pk-map-stop"
                data-mine={mine ? "" : undefined}
                data-dim={dim ? "" : undefined}
              >
                {mine && (
                  <circle
                    cx={stop.x}
                    cy={stop.y}
                    r="3.2"
                    className="pk-map-stop-halo"
                  />
                )}
                <circle cx={stop.x} cy={stop.y} r={mine ? 1.7 : 1.15} />
                <text x={stop.x} y={stop.y - 2.4}>
                  {mine ? childStop!.name : stop.name}
                </text>
              </g>
            );
          }),
        )}
        <g className="pk-map-school">
          <image
            href={oakIvyLogo}
            x={school.x - 3.2}
            y={school.y - 3.2}
            width="6.4"
            height="6.4"
          />
          <text x={school.x} y={school.y + 5.6}>
            Oak and Ivy
          </text>
        </g>
        {vehicles.map(({ vehicle, live }) => {
          const focused = vehicle.id === focus;
          const dim = focus && !focused;
          return (
            <g
              key={vehicle.id}
              className="pk-map-vehicle"
              data-focus={focused ? "" : undefined}
              data-dim={dim ? "" : undefined}
              data-moving={live.moving ? "" : undefined}
              style={{
                transform: `translate(${live.x}px, ${live.y}px)`,
                transition: `transform ${pingMs / 1000}s linear`,
              }}
              onClick={onSelect ? () => onSelect(vehicle.id) : undefined}
              role={onSelect ? "button" : undefined}
              aria-label={onSelect ? "Track " + vehicle.number : undefined}
            >
              {live.moving && <circle r="4" className="pk-map-pulse" />}
              <circle r="2.5" className="pk-map-vehicle-dot" />
              <path
                className="pk-map-vehicle-glyph"
                d="M-1.2 -1.1 h2.4 a0.4 0.4 0 0 1 0.4 0.4 v1.4 h-3.2 v-1.4 a0.4 0.4 0 0 1 0.4 -0.4 z M-1 0.9 a0.35 0.35 0 1 0 0.01 0 M1 0.9 a0.35 0.35 0 1 0 0.01 0"
              />
              <g className="pk-map-tag" transform="translate(0 -4.6)">
                <rect x="-6.2" y="-1.9" width="12.4" height="3.4" rx="1.7" />
                <text y="0.55">{vehicle.number.slice(-7)}</text>
              </g>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <Radio size={12} aria-hidden="true" /> Simulated GPS · the demo replays
        each trip at {speedUp}× speed
      </figcaption>
    </figure>
  );
}

/* ========================================================================
   Parent
   ======================================================================== */

function ParentTransport({ p }: { p: Preschool }) {
  const child = p.data.child;
  const [approach, setApproach] = usePreference(
    "school-lms-bus-alert-approach",
    "on",
  );
  const [board, setBoard] = usePreference("school-lms-bus-alert-board", "on");
  if (!child) return <Empty>No children are linked to your account.</Empty>;
  const first = child.name.split(" ")[0];
  const ride = riderOf(p.school, child.id);
  if (!ride)
    return (
      <Card icon={BusFront} title="Not using school transport">
        <Empty>
          {first} isn&apos;t on a school bus or van route. To start, contact the
          transport desk on 94120 33871.
        </Empty>
      </Card>
    );
  const { vehicle, route, stop } = ride;
  const live = livePosition(vehicle, route, p.now!.getTime());
  const status = stopStatus(route, stop, live, first);
  const trips = p.school.trips.filter(
    (item) => item.student === child.id && item.date === p.today,
  );
  const runStops =
    live.phase === "Drop-off run" ? [...route.stops].reverse() : route.stops;
  const runTime = (stopId: string) =>
    live.phase === "Drop-off run"
      ? minutesTo(route, "Drop-off run", stopId)
      : minutesTo(route, "To school", stopId);
  const done = (stopId: string) =>
    (live.moving && runTime(stopId) <= live.progress * route.minutes) ||
    (live.phase === "At school" && live.progress === 1);

  return (
    <div className="pk-stack">
      <div className="pk-track">
        <TransportMap
          routes={[route]}
          vehicles={[{ vehicle, live }]}
          focus={vehicle.id}
          childStop={{
            route: route.id,
            stop: stop.id,
            name: first + "'s stop",
          }}
          label={vehicle.label + " on the " + route.name + " route"}
        />
        <aside className="pk-track-side">
          <section className="pk-eta" data-tone={status.tone}>
            <small>
              <Navigation size={13} aria-hidden="true" /> {vehicle.label} ·{" "}
              {live.phase}
            </small>
            <strong>{status.title}</strong>
            <p>{status.detail}</p>
          </section>
          <dl className="pk-track-facts">
            <div>
              <dt>Vehicle</dt>
              <dd>{vehicle.number}</dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{live.moving ? live.speedKmh + " km/h" : "Parked"}</dd>
            </div>
            <div>
              <dt>Next stop</dt>
              <dd>
                {live.next
                  ? live.next.stop.name + " · " + live.next.minutes + " min"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Last GPS update</dt>
              <dd>{secondsAgo(p.now!, live)} s ago</dd>
            </div>
          </dl>
          <ul className="pk-crew">
            <li>
              <Avatar name={vehicle.driver} size={36} />
              <span>
                <strong>{vehicle.driver}</strong>
                <small>Driver</small>
              </span>
              <a
                className="icon-button"
                href={tel(vehicle.driverPhone)}
                aria-label={"Call " + vehicle.driver}
              >
                <Phone size={16} aria-hidden="true" />
              </a>
            </li>
            <li>
              <Avatar name={vehicle.attendant} size={36} />
              <span>
                <strong>{vehicle.attendant}</strong>
                <small>Attendant (travels with the children)</small>
              </span>
              <a
                className="icon-button"
                href={tel(vehicle.attendantPhone)}
                aria-label={"Call " + vehicle.attendant}
              >
                <Phone size={16} aria-hidden="true" />
              </a>
            </li>
          </ul>
        </aside>
      </div>

      <div className="pk-columns">
        <Card
          icon={RouteIcon}
          title={route.name + " route"}
          subtitle={"Pickup and drop times at each stop."}
        >
          <ol className="pk-stops">
            {runStops.map((item) => (
              <li
                key={item.id}
                data-mine={item.id === stop.id ? "" : undefined}
                data-done={done(item.id) ? "" : undefined}
              >
                <span className="pk-stop-dot" aria-hidden="true" />
                <span>
                  <strong>
                    {item.name}
                    {item.id === stop.id && (
                      <Pill tone="accent">{first}&apos;s stop</Pill>
                    )}
                  </strong>
                  <small>
                    Pickup {friendlyTime(item.am)} · Drop{" "}
                    {friendlyTime(item.pm)}
                  </small>
                </span>
              </li>
            ))}
            <li data-school="">
              <span className="pk-stop-dot" aria-hidden="true" />
              <span>
                <strong>Oak and Ivy</strong>
                <small>Arrives about 8:35 am · leaves 1:15 pm</small>
              </span>
            </li>
          </ol>
        </Card>
        <div className="pk-stack">
          <Card icon={Clock} title="Today's trip">
            {trips.length ? (
              <ul className="pk-list pk-list-compact">
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <span className="pk-time-badge">
                      {friendlyTime(trip.time)}
                    </span>
                    <span>
                      <strong>{trip.kind}</strong>
                      <small>{trip.stop}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{first} didn&apos;t take the bus this morning.</Empty>
            )}
          </Card>
          <Card icon={BellRing} title="Bus alerts">
            <label className="pk-toggle">
              <input
                type="checkbox"
                checked={approach === "on"}
                onChange={(event) =>
                  setApproach(event.target.checked ? "on" : "off")
                }
              />
              <span>
                <strong>Bus is 5 minutes away</strong>
                <small>So you can be at the stop in time.</small>
              </span>
            </label>
            <label className="pk-toggle">
              <input
                type="checkbox"
                checked={board === "on"}
                onChange={(event) =>
                  setBoard(event.target.checked ? "on" : "off")
                }
              />
              <span>
                <strong>Boarded and dropped</strong>
                <small>
                  When the attendant scans {first} on and off the bus.
                </small>
              </span>
            </label>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   Teacher & office: track any vehicle
   ======================================================================== */

function FleetTracking({ p }: { p: Preschool }) {
  const vehicles = trackableVehicles(p.school, p.records, p.actor);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string>();
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormConfig>();
  const nowMs = p.now!.getTime();
  const fleet = vehicles.map((vehicle) => {
    const route = p.school.routes.find((item) => item.id === vehicle.route)!;
    return { vehicle, route, live: livePosition(vehicle, route, nowMs) };
  });
  const selected = fleet.find((item) => item.vehicle.id === focus);
  const ridersOf = (id: string) =>
    p.school.riders
      .filter((item) => item.vehicle === id)
      .map((rider) => ({
        rider,
        child: p.children.find((child) => child.id === rider.student),
        stop: p.school.routes
          .flatMap((route) => route.stops)
          .find((stop) => stop.id === rider.stop),
      }))
      .filter((row) => row.child);
  const moving = fleet.filter((item) => item.live.moving).length;
  const riders = p.school.riders.filter((rider) =>
    p.children.some((child) => child.id === rider.student),
  ).length;

  function track(event: FormEvent) {
    event.preventDefault();
    const found = findVehicle(p.school, query);
    if (!found) {
      setError("No vehicle with number “" + query.trim() + "”.");
      return;
    }
    setError("");
    setFocus(found.id);
    setQuery(found.number);
  }

  return (
    <div className="pk-stack">
      <form className="pk-track-search" onSubmit={track} role="search">
        <label>
          <span className="sr-only">Vehicle number</span>
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            list="pk-vehicle-numbers"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Track by vehicle number, e.g. UK 07 PA 4521"
          />
          <datalist id="pk-vehicle-numbers">
            {vehicles.map((item) => (
              <option key={item.id} value={item.number}>
                {item.label}
              </option>
            ))}
          </datalist>
        </label>
        <button type="submit" className="button button-primary">
          <LocateFixed size={16} aria-hidden="true" /> Track
        </button>
        {focus && (
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setFocus(undefined);
              setQuery("");
            }}
          >
            Show all
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <div className="pk-stats">
        <Stat
          icon={BusFront}
          label="Vehicles"
          value={vehicles.length}
          hint={moving + " on the road now"}
        />
        <Stat
          icon={UsersRound}
          label="Children using transport"
          value={riders}
        />
        <Stat icon={RouteIcon} label="Routes" value={p.school.routes.length} />
        <Stat
          icon={Wrench}
          label="In the workshop"
          value={
            vehicles.filter((item) => item.status === "Maintenance").length
          }
        />
      </div>

      <div className="pk-track">
        <TransportMap
          routes={p.school.routes}
          vehicles={fleet}
          focus={focus}
          onSelect={(id) => {
            setFocus(id);
            setQuery(vehicles.find((item) => item.id === id)?.number ?? "");
            setError("");
          }}
          label="Live positions of every school vehicle"
        />
        <aside className="pk-track-side">
          {selected ? (
            <>
              <section className="pk-eta" data-tone={phaseTone(selected.live)}>
                <small>
                  <Navigation size={13} aria-hidden="true" />{" "}
                  {selected.vehicle.label} · {selected.route.name}
                </small>
                <strong>{selected.vehicle.number}</strong>
                <p>
                  {selected.live.phase}
                  {selected.live.next &&
                    " · next stop " +
                      selected.live.next.stop.name +
                      " in " +
                      selected.live.next.minutes +
                      " min"}
                </p>
              </section>
              <dl className="pk-track-facts">
                <div>
                  <dt>Speed</dt>
                  <dd>
                    {selected.live.moving
                      ? selected.live.speedKmh + " km/h"
                      : "Parked"}
                  </dd>
                </div>
                <div>
                  <dt>GPS tracker</dt>
                  <dd>{selected.vehicle.tracker}</dd>
                </div>
                <div>
                  <dt>Last update</dt>
                  <dd>{secondsAgo(p.now!, selected.live)} s ago</dd>
                </div>
                <div>
                  <dt>Seats</dt>
                  <dd>
                    {ridersOf(selected.vehicle.id).length} /{" "}
                    {selected.vehicle.capacity}
                  </dd>
                </div>
              </dl>
              <ul className="pk-crew">
                <li>
                  <Avatar name={selected.vehicle.driver} size={34} />
                  <span>
                    <strong>{selected.vehicle.driver}</strong>
                    <small>Driver · {selected.vehicle.driverPhone}</small>
                  </span>
                  <a
                    className="icon-button"
                    href={tel(selected.vehicle.driverPhone)}
                    aria-label={"Call " + selected.vehicle.driver}
                  >
                    <Phone size={16} aria-hidden="true" />
                  </a>
                </li>
                {selected.vehicle.attendantPhone && (
                  <li>
                    <Avatar name={selected.vehicle.attendant} size={34} />
                    <span>
                      <strong>{selected.vehicle.attendant}</strong>
                      <small>
                        Attendant · {selected.vehicle.attendantPhone}
                      </small>
                    </span>
                    <a
                      className="icon-button"
                      href={tel(selected.vehicle.attendantPhone)}
                      aria-label={"Call " + selected.vehicle.attendant}
                    >
                      <Phone size={16} aria-hidden="true" />
                    </a>
                  </li>
                )}
              </ul>
              <h3 className="pk-subhead">Children on this vehicle</h3>
              {ridersOf(selected.vehicle.id).length ? (
                <ul className="pk-list pk-list-compact">
                  {ridersOf(selected.vehicle.id).map(({ child, stop }) => (
                    <li key={child!.id}>
                      <Avatar name={child!.name} size={28} />
                      <span>
                        <strong>{child!.name}</strong>
                        <small>
                          {stop?.name} · {child!.sectionLabel}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No children assigned.</Empty>
              )}
              {p.role === "school-admin" && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() =>
                    p.act(
                      (state) =>
                        setVehicleStatus(
                          state,
                          p.actor,
                          selected.vehicle.id,
                          selected.vehicle.status === "Active"
                            ? "Maintenance"
                            : "Active",
                        ),
                      selected.vehicle.status === "Active"
                        ? "Vehicle marked as in the workshop."
                        : "Vehicle back in service.",
                    )
                  }
                >
                  <Wrench size={15} aria-hidden="true" />
                  {selected.vehicle.status === "Active"
                    ? "Send to workshop"
                    : "Back in service"}
                </button>
              )}
            </>
          ) : (
            <>
              <h3 className="pk-subhead">Fleet</h3>
              <ul className="pk-fleet">
                {fleet.map(({ vehicle, route, live }) => (
                  <li key={vehicle.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFocus(vehicle.id);
                        setQuery(vehicle.number);
                      }}
                    >
                      <span
                        className="pk-fleet-icon"
                        data-moving={live.moving ? "" : undefined}
                      >
                        <BusFront size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{vehicle.number}</strong>
                        <small>
                          {vehicle.label} · {route.name}
                        </small>
                      </span>
                      <Pill
                        tone={
                          vehicle.status === "Maintenance"
                            ? "warn"
                            : phaseTone(live)
                        }
                      >
                        {vehicle.status === "Maintenance"
                          ? "Workshop"
                          : live.moving
                            ? live.speedKmh + " km/h"
                            : live.phase}
                      </Pill>
                    </button>
                  </li>
                ))}
              </ul>
              <Note>Select a vehicle on the map or search by its number.</Note>
            </>
          )}
        </aside>
      </div>

      {p.role === "school-admin" && (
        <Card
          icon={MapPin}
          title="Transport assignments"
          subtitle="Which vehicle and stop each child uses."
        >
          <div className="table-scroll">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Child</th>
                  <th>Vehicle</th>
                  <th>Stop</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.children.map((child) => {
                  const ride = riderOf(p.school, child.id);
                  return (
                    <tr key={child.id}>
                      <td>
                        <span className="pk-cell-person">
                          <Avatar name={child.name} size={30} />
                          <span>
                            <strong>{child.name}</strong>
                            <small>{child.sectionLabel}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        {ride ? (
                          ride.vehicle.label + " · " + ride.vehicle.number
                        ) : (
                          <span className="pk-muted">Parent drop-off</span>
                        )}
                      </td>
                      <td>
                        {ride
                          ? ride.stop.name + " · " + friendlyTime(ride.stop.am)
                          : "—"}
                      </td>
                      <td className="pk-cell-action">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setForm({
                              title: "Transport for " + child.name,
                              submitLabel: "Save",
                              fields: [
                                {
                                  name: "stop",
                                  label: "Vehicle and stop",
                                  type: "select",
                                  options: [
                                    {
                                      value: "none",
                                      label:
                                        "No school transport (parent drop-off)",
                                    },
                                    ...p.school.vehicles
                                      .filter(
                                        (item) => item.status === "Active",
                                      )
                                      .flatMap((vehicle) => {
                                        const route = p.school.routes.find(
                                          (r) => r.id === vehicle.route,
                                        );
                                        return (route?.stops ?? []).map(
                                          (stop) => ({
                                            value: vehicle.id + "|" + stop.id,
                                            label:
                                              stop.name +
                                              " · pickup " +
                                              friendlyTime(stop.am),
                                            group:
                                              vehicle.label +
                                              " · " +
                                              vehicle.number,
                                          }),
                                        );
                                      }),
                                  ],
                                },
                              ],
                              values: {
                                stop: ride
                                  ? ride.vehicle.id + "|" + ride.stop.id
                                  : "none",
                              },
                              onSubmit: (data) => {
                                const [vehicle, stop] = String(
                                  data.get("stop"),
                                ).split("|");
                                updatePreschoolState((state) =>
                                  assignRider(
                                    state,
                                    p.records,
                                    p.actor,
                                    child.id,
                                    vehicle === "none" ? "" : vehicle,
                                    stop ?? "",
                                  ),
                                );
                                p.toast.show(
                                  "Transport updated for " + child.name + ".",
                                );
                              },
                            })
                          }
                        >
                          Change
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {p.role === "teacher" && (
        <Note>
          Teachers can track every vehicle. Transport assignments are managed by
          the school office.
        </Note>
      )}
      <FormDialog config={form} onClose={() => setForm(undefined)} />
      <span className="sr-only" aria-live="polite">
        {selected ? selected.vehicle.number + " " + selected.live.phase : ""}
      </span>
    </div>
  );
}

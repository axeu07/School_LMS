import type { BusRoute, RouteStop, Vehicle } from "./preschool-model";

/**
 * Simulated GPS for the demo. A real deployment reads positions from the GPS
 * tracker fitted in each vehicle; here every vehicle replays its route at
 * `speedUp` times real speed, so the map is always moving: morning run to
 * school, a short stop, the afternoon run back, and a short stop again.
 */
export const speedUp = 10;
/** Map units to kilometres (the map is about 30 km across). */
const kmPerUnit = 0.3;
/** Real milliseconds the vehicle waits at each end of the route. */
const dwellMs = 20_000;
/** The tracker reports a new position this often. */
export const pingMs = 5_000;

export type Phase = "To school" | "At school" | "Drop-off run" | "At last stop";
export type LivePosition = {
  x: number;
  y: number;
  /** Direction of travel in degrees, 0 = east. */
  heading: number;
  phase: Phase;
  moving: boolean;
  speedKmh: number;
  /** Next stop on this run, if any. */
  next?: { stop: RouteStop; minutes: number };
  /** Distance travelled on this run, 0–1. */
  progress: number;
  /** When the tracker last reported (ms timestamp). */
  pingedAt: number;
};

type Point = { x: number; y: number; stop?: string };

function lengths(points: Point[]) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return cumulative;
}

/** The route as driven on a run: towards school in the morning, away after. */
export function runPath(route: BusRoute, phase: Phase): Point[] {
  return phase === "Drop-off run" ? [...route.path].reverse() : route.path;
}

function pointAt(points: Point[], cumulative: number[], distance: number) {
  const total = cumulative[cumulative.length - 1];
  const d = Math.max(0, Math.min(total, distance));
  let index = cumulative.findIndex((value) => value >= d);
  if (index <= 0) index = 1;
  const a = points[index - 1];
  const b = points[index];
  const span = cumulative[index] - cumulative[index - 1] || 1;
  const t = (d - cumulative[index - 1]) / span;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    heading: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

/** A stable per-vehicle offset so vehicles are spread along their runs. */
function offsetFor(vehicle: Vehicle) {
  let hash = 0;
  for (const char of vehicle.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 240_000;
}

export function tripMs(route: BusRoute) {
  return (route.minutes * 60_000) / speedUp;
}

export function livePosition(
  vehicle: Vehicle,
  route: BusRoute,
  nowMs: number,
): LivePosition {
  // Positions only change when the tracker pings.
  const pingedAt = Math.floor(nowMs / pingMs) * pingMs;
  const run = tripMs(route);
  const cycle = 2 * run + 2 * dwellMs;
  const t = (pingedAt + offsetFor(vehicle)) % cycle;
  const school = route.path[route.path.length - 1];
  const first = route.path[0];

  if (vehicle.status === "Maintenance")
    return {
      // Parked at the depot, just south-west of school.
      x: school.x - 7,
      y: school.y + 9,
      heading: 0,
      phase: "At school",
      moving: false,
      speedKmh: 0,
      progress: 0,
      pingedAt,
    };

  let phase: Phase;
  let elapsed = 0;
  if (t < run) {
    phase = "To school";
    elapsed = t;
  } else if (t < run + dwellMs) phase = "At school";
  else if (t < 2 * run + dwellMs) {
    phase = "Drop-off run";
    elapsed = t - run - dwellMs;
  } else phase = "At last stop";

  if (phase === "At school" || phase === "At last stop") {
    const at = phase === "At school" ? school : first;
    return {
      x: at.x,
      y: at.y,
      heading: 0,
      phase,
      moving: false,
      speedKmh: 0,
      progress: phase === "At school" ? 1 : 0,
      pingedAt,
    };
  }

  const points = runPath(route, phase);
  const cumulative = lengths(points);
  const total = cumulative[cumulative.length - 1];
  const progress = elapsed / run;
  const distance = progress * total;
  const at = pointAt(points, cumulative, distance);
  const average = (total * kmPerUnit) / (route.minutes / 60);
  // A little variation so the speed reads like real traffic.
  const speedKmh = Math.max(
    8,
    Math.round(average * (1 + 0.35 * Math.sin(pingedAt / 9_000))),
  );
  const upcoming = points
    .map((point, index) => ({ point, distance: cumulative[index] }))
    .find(({ point, distance: d }) => point.stop && d > distance);
  const stop = upcoming
    ? route.stops.find((item) => item.id === upcoming.point.stop)
    : undefined;
  return {
    ...at,
    phase,
    moving: true,
    speedKmh,
    progress,
    pingedAt,
    next:
      stop && upcoming
        ? {
            stop,
            minutes: Math.max(
              1,
              Math.round(
                ((upcoming.distance - distance) / total) * route.minutes,
              ),
            ),
          }
        : undefined,
  };
}

export type StopStatus = {
  title: string;
  detail: string;
  tone: "good" | "accent" | "warn" | "default";
  /** Minutes until the vehicle reaches the child's stop on this run. */
  minutes?: number;
};

/** What a parent needs to know about their child's stop right now. */
export function stopStatus(
  route: BusRoute,
  stop: RouteStop,
  live: LivePosition,
  firstName: string,
): StopStatus {
  const toSchool = minutesTo(route, "To school", stop.id);
  const fromSchool = minutesTo(route, "Drop-off run", stop.id);
  if (live.phase === "At school")
    return {
      title: "At school",
      detail: "The bus is parked at school between runs.",
      tone: "default",
    };
  if (live.phase === "At last stop")
    return {
      title: "Run finished",
      detail: "The bus has finished its drop-off run.",
      tone: "default",
    };
  const at = live.progress * route.minutes;
  const stopAt = live.phase === "To school" ? toSchool : fromSchool;
  const minutes = Math.round(stopAt - at);
  if (live.phase === "To school")
    return minutes > 0
      ? {
          title:
            minutes <= 5
              ? "Arriving in " + minutes + " min"
              : minutes + " min away",
          detail:
            "Pickup at " +
            stop.name +
            (minutes <= 5 ? ". Please be at the stop." : "."),
          tone: minutes <= 5 ? "warn" : "accent",
          minutes,
        }
      : {
          title: firstName + " is on board",
          detail:
            "Reaching school in about " +
            Math.max(1, Math.round(route.minutes - at)) +
            " min.",
          tone: "good",
        };
  return minutes > 0
    ? {
        title:
          minutes <= 5
            ? "Drop in " + minutes + " min"
            : "Drop-off in " + minutes + " min",
        detail:
          firstName +
          " is on board. Drop at " +
          stop.name +
          (minutes <= 5 ? ". Please be at the stop." : "."),
        tone: minutes <= 5 ? "warn" : "accent",
        minutes,
      }
    : {
        title: "Dropped at " + stop.name,
        detail: "Handed over to the person on the pickup list.",
        tone: "good",
      };
}

/** Minutes from the start of a run until the vehicle reaches a stop. */
export function minutesTo(route: BusRoute, phase: Phase, stopId: string) {
  const points = runPath(route, phase);
  const cumulative = lengths(points);
  const total = cumulative[cumulative.length - 1] || 1;
  const index = points.findIndex((point) => point.stop === stopId);
  return index < 0 ? 0 : (cumulative[index] / total) * route.minutes;
}

/**
 * vehicles.ts — real-time goods-vehicle tracking: the feed contract, a
 * production-ready scaffold for a live GPS feed, and a demo simulation.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * The app consumes vehicle positions only through the `VehicleFeed` interface.
 * Swapping the demo feed for a real telematics feed is therefore a one-line
 * change in main.ts — nothing in the map/UI layer needs to know the source.
 *
 *   interface VehicleFeed {
 *     start(): void;                 // begin emitting
 *     stop(): void;                  // stop + release resources
 *     subscribe(cb): () => void;     // receive position batches; returns unsub
 *   }
 *
 * The position payload (`VehiclePosition` in types.ts) mirrors a typical
 * AVL/telematics record (id, plate, lat/lng, heading, speed, status, …).
 *
 * // TODO (PRODUCTION): connect your real GPS source via `createLiveFeed`
 * // below — e.g. a WebSocket/MQTT stream or a polled REST endpoint from your
 * // telematics provider (Geotab, Samsara, Traccar, a custom GPS tracker, …).
 * // Map each incoming record to VehiclePosition and emit it. For accurate
 * // placement, also map-match positions to a licensed road network (the
 * // bundled freight roads are a simplified overview only — see README).
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { OverlayCollection, VehiclePosition } from "../types";

export interface VehicleFeed {
  start(): void;
  stop(): void;
  subscribe(cb: (vehicles: VehiclePosition[]) => void): () => void;
}

/** Whether this feed is simulated (drives the "DEMO" badge in the UI). */
export interface FeedInfo {
  isDemo: boolean;
  label: string;
}

// ── Production scaffold ──────────────────────────────────────────────────────

export interface LiveFeedConfig {
  /** e.g. "wss://gps.example.com/stream" or "https://api.example.com/positions". */
  url: string;
  /** Polling interval (ms) for REST feeds; ignored for sockets. */
  pollMs?: number;
  /** Auth token / headers as needed by your provider. */
  token?: string;
}

/**
 * Production live feed — intentionally a documented stub in the default build.
 * Wire it to your telematics source and emit VehiclePosition batches to the
 * subscriber. Left inert (logs a warning) so the default build ships no demo
 * data masquerading as real tracking.
 */
export function createLiveFeed(config: LiveFeedConfig): VehicleFeed {
  const subs = new Set<(v: VehiclePosition[]) => void>();
  return {
    start() {
      // TODO: open the WebSocket / start polling `config.url`, parse provider
      // records into VehiclePosition, and call `emit(positions)` on each batch:
      //   const ws = new WebSocket(config.url);
      //   ws.onmessage = (e) => emit(JSON.parse(e.data).map(toVehiclePosition));
      // For now this feed emits nothing.
      // eslint-disable-next-line no-console
      console.warn(
        `[vehicles] Live feed not configured (url=${config.url}). ` +
          `Implement createLiveFeed in src/data/vehicles.ts to stream real positions.`
      );
    },
    stop() {
      /* close socket / clear poll timer here */
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

// ── Demo simulation ──────────────────────────────────────────────────────────

interface DemoTruck {
  base: Omit<VehiclePosition, "lng" | "lat" | "heading" | "speedKmh" | "updatedAt">;
  line: PreppedLine;
  /** Distance travelled along the line, km. */
  dist: number;
  /** +1 forward, -1 reverse (bounces at the ends). */
  dir: 1 | -1;
  /** Cruising speed, km/h. */
  cruiseKmh: number;
}

interface PreppedLine {
  coords: [number, number][];
  /** Cumulative distance to the start of each vertex, km. */
  cum: number[];
  totalKm: number;
  ref: string;
}

const SIM_SPEEDUP = 120; // accelerate the demo so movement is clearly visible

const CARGO = ["Maize", "Fuel", "Cement", "Tobacco", "Containers", "Fertiliser"];

/**
 * Build a demo feed that drives a handful of trucks along the freight roads.
 * Clearly synthetic — for showcasing the tracking capability only.
 */
export function createDemoFeed(roads: OverlayCollection): VehicleFeed {
  const lines = prepLines(roads);
  const subs = new Set<(v: VehiclePosition[]) => void>();
  let timer: number | undefined;
  let last = 0;

  const trucks: DemoTruck[] = lines.length
    ? buildTrucks(lines)
    : [];

  function emit(): void {
    const now = Date.now();
    const out: VehiclePosition[] = trucks.map((t) => {
      const at = posAtDistance(t.line, t.dist);
      const moving = t.base.status === "moving";
      return {
        ...t.base,
        lng: at.lng,
        lat: at.lat,
        heading: t.dir === 1 ? at.heading : (at.heading + 180) % 360,
        speedKmh: moving ? Math.round(t.cruiseKmh) : 0,
        road: t.line.ref,
        updatedAt: now,
      };
    });
    subs.forEach((cb) => cb(out));
  }

  function tick(): void {
    const now = Date.now();
    const dtH = (last ? (now - last) : 0) / 3_600_000; // hours since last tick
    last = now;
    for (const t of trucks) {
      if (t.base.status !== "moving") continue;
      t.dist += t.dir * t.cruiseKmh * SIM_SPEEDUP * dtH;
      if (t.dist >= t.line.totalKm) {
        t.dist = t.line.totalKm;
        t.dir = -1;
      } else if (t.dist <= 0) {
        t.dist = 0;
        t.dir = 1;
      }
    }
    emit();
  }

  return {
    start() {
      if (timer !== undefined) return;
      last = Date.now();
      emit(); // immediate first paint
      timer = window.setInterval(tick, 250);
    },
    stop() {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

export const DEMO_FEED_INFO: FeedInfo = { isDemo: true, label: "Simulated demo" };

// ── geometry helpers (self-contained; no turf at runtime) ────────────────────

function buildTrucks(lines: PreppedLine[]): DemoTruck[] {
  // Spread a few trucks across the available corridors at varied start points.
  const specs: Array<{ status: VehiclePosition["status"]; speed: number; start: number }> = [
    { status: "moving", speed: 72, start: 0.1 },
    { status: "moving", speed: 64, start: 0.45 },
    { status: "moving", speed: 80, start: 0.7 },
    { status: "loading", speed: 0, start: 0.25 },
    { status: "moving", speed: 58, start: 0.85 },
  ];
  return specs.map((s, i) => {
    const line = lines[i % lines.length];
    return {
      base: {
        id: `demo-${i + 1}`,
        plate: `MW ${1000 + i * 137} ${String.fromCharCode(65 + i)}`,
        status: s.status,
        cargo: CARGO[i % CARGO.length],
      },
      line,
      dist: line.totalKm * s.start,
      dir: i % 2 === 0 ? 1 : -1,
      cruiseKmh: s.speed,
    };
  });
}

function prepLines(roads: OverlayCollection): PreppedLine[] {
  const out: PreppedLine[] = [];
  for (const f of roads.features) {
    if (f.geometry.type !== "LineString") continue;
    const coords = f.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    if (coords.length < 2) continue;
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
      cum[i] = cum[i - 1] + haversineKm(coords[i - 1], coords[i]);
    }
    out.push({
      coords,
      cum,
      totalKm: cum[cum.length - 1],
      ref: (f.properties.ref as string) ?? (f.properties.name as string) ?? "road",
    });
  }
  return out;
}

function posAtDistance(
  line: PreppedLine,
  dist: number
): { lng: number; lat: number; heading: number } {
  const d = Math.max(0, Math.min(dist, line.totalKm));
  // Find the segment [i-1, i] containing distance d.
  let i = 1;
  while (i < line.cum.length && line.cum[i] < d) i++;
  const a = line.coords[i - 1];
  const b = line.coords[Math.min(i, line.coords.length - 1)];
  const segLen = line.cum[Math.min(i, line.cum.length - 1)] - line.cum[i - 1] || 1;
  const t = (d - line.cum[i - 1]) / segLen;
  return {
    lng: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    heading: bearingDeg(a, b),
  };
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const toRad = (d: number): number => (d * Math.PI) / 180;
const toDeg = (r: number): number => (r * 180) / Math.PI;

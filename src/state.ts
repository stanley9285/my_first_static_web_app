/**
 * state.ts — single app state store with URL-hash persistence.
 *
 * State (active style, terrain on/off, overlay visibility, active tab, camera,
 * selection) is mirrored to the URL hash so a browser refresh — or sharing the
 * link — restores exactly what the user was looking at.
 *
 * Hash format (compact, human-readable):
 *   #style=streets&terrain=1&on=regions,districts&tab=regions
 *    &z=7.1&c=34.31,-13.25&b=0&p=0&sel=districts:42...
 */

import type { AppState, OverlayId } from "./types";
import { OVERLAYS, MALAWI_HOME } from "./config/overlays";
import { DEFAULT_STYLE_ID, getStyle } from "./config/basemap";

type Listener = (s: AppState) => void;

const OVERLAY_IDS = OVERLAYS.map((o) => o.id);

function defaultState(): AppState {
  const visible = {} as Record<OverlayId, boolean>;
  for (const o of OVERLAYS) visible[o.id] = o.defaultVisible;
  return {
    style: DEFAULT_STYLE_ID,
    terrain: false,
    visible,
    activeTab: "regions",
    center: MALAWI_HOME.center,
    zoom: MALAWI_HOME.zoom,
    bearing: MALAWI_HOME.bearing,
    pitch: MALAWI_HOME.pitch,
    selected: null,
  };
}

function isOverlayId(v: string): v is OverlayId {
  return (OVERLAY_IDS as string[]).includes(v);
}

function parseHash(): Partial<AppState> {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return {};
  const p = new URLSearchParams(raw);
  const out: Partial<AppState> = {};

  const style = p.get("style");
  if (style && getStyle(style).id === style) out.style = style;

  if (p.has("terrain")) out.terrain = p.get("terrain") === "1";

  if (p.has("on")) {
    const on = new Set(
      (p.get("on") ?? "").split(",").filter(Boolean).filter(isOverlayId)
    );
    const visible = {} as Record<OverlayId, boolean>;
    for (const id of OVERLAY_IDS) visible[id] = on.has(id);
    out.visible = visible;
  }

  const tab = p.get("tab");
  if (tab && isOverlayId(tab)) out.activeTab = tab;

  const z = Number(p.get("z"));
  if (Number.isFinite(z)) out.zoom = z;

  const c = (p.get("c") ?? "").split(",").map(Number);
  if (c.length === 2 && c.every(Number.isFinite)) out.center = [c[0], c[1]];

  const b = Number(p.get("b"));
  if (Number.isFinite(b)) out.bearing = b;
  const pitch = Number(p.get("p"));
  if (Number.isFinite(pitch)) out.pitch = pitch;

  const sel = p.get("sel");
  out.selected = sel && sel.length ? sel : null;

  return out;
}

function serialize(s: AppState): string {
  const on = OVERLAY_IDS.filter((id) => s.visible[id]).join(",");
  const p = new URLSearchParams();
  p.set("style", s.style);
  p.set("terrain", s.terrain ? "1" : "0");
  p.set("on", on);
  p.set("tab", s.activeTab);
  p.set("z", s.zoom.toFixed(2));
  p.set("c", `${s.center[0].toFixed(4)},${s.center[1].toFixed(4)}`);
  p.set("b", Math.round(s.bearing).toString());
  p.set("p", Math.round(s.pitch).toString());
  if (s.selected) p.set("sel", s.selected);
  return p.toString();
}

class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private writeTimer: number | undefined;

  constructor() {
    this.state = { ...defaultState(), ...parseHash() };
  }

  get(): Readonly<AppState> {
    return this.state;
  }

  /** Merge a partial update, notify listeners, debounce the hash write. */
  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
    this.scheduleWrite();
  }

  /** Camera updates are frequent; persist them without notifying UI listeners. */
  setCameraQuiet(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.scheduleWrite();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private scheduleWrite(): void {
    window.clearTimeout(this.writeTimer);
    this.writeTimer = window.setTimeout(() => {
      const hash = "#" + serialize(this.state);
      // replaceState avoids polluting browser history on every pan.
      history.replaceState(null, "", hash);
    }, 250);
  }
}

export const store = new Store();

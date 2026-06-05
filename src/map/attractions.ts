/**
 * attractions.ts (map) — animated pulsing pins for tourist attractions.
 *
 * Uses maplibregl.Marker with a custom HTML element so the pin can pulse via
 * CSS (GL layers can't animate per-feature like this). Markers are attached to
 * the map (not the style), so they survive basemap/style swaps without re-adding.
 * Clicking a pin notifies the app, which flies in and opens the info card.
 */

import maplibregl, { type Map as MLMap, Marker } from "maplibre-gl";
import type { Attraction } from "../types";

/** Emoji + accent colour per attraction category (drives the pin look). */
const CATEGORY: Record<Attraction["category"], { icon: string; color: string }> = {
  "national-park": { icon: "🦁", color: "#2e8b3d" },
  reserve: { icon: "🐘", color: "#2e8b3d" },
  mountain: { icon: "⛰️", color: "#8c5a2b" },
  plateau: { icon: "🌄", color: "#b07d3c" },
  lake: { icon: "🛶", color: "#1f78b4" },
  beach: { icon: "🏖️", color: "#e6a817" },
  island: { icon: "🏝️", color: "#13a3a3" },
  waterfall: { icon: "💦", color: "#2aa1c0" },
  cultural: { icon: "🏛️", color: "#8a4fff" },
  lodge: { icon: "🛏️", color: "#e8682c" },
  landmark: { icon: "📍", color: "#d7263d" },
};

export function categoryMeta(cat: Attraction["category"]) {
  return CATEGORY[cat] ?? CATEGORY.landmark;
}

export class AttractionsLayer {
  private map: MLMap;
  private onSelect: (a: Attraction) => void;
  private markers: Marker[] = [];
  private items: Attraction[] = [];
  private visible = true;
  private added = false;

  constructor(map: MLMap, onSelect: (a: Attraction) => void) {
    this.map = map;
    this.onSelect = onSelect;
  }

  setItems(items: Attraction[]): void {
    this.clear();
    this.items = items;
    for (const a of items) this.markers.push(this.makeMarker(a));
    if (this.visible) this.addAll();
  }

  private makeMarker(a: Attraction): Marker {
    const meta = categoryMeta(a.category);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "attraction-pin";
    el.style.setProperty("--pin-color", meta.color);
    el.setAttribute("aria-label", `${a.name} — open details`);
    el.title = a.name;
    el.innerHTML = `
      <span class="pin-pulse" aria-hidden="true"></span>
      <span class="pin-dot" aria-hidden="true"><span class="pin-icon">${meta.icon}</span></span>
    `;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onSelect(a);
    });
    return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([
      a.lng,
      a.lat,
    ]);
  }

  private addAll(): void {
    if (this.added) return;
    for (const m of this.markers) m.addTo(this.map);
    this.added = true;
  }

  private removeAll(): void {
    for (const m of this.markers) m.remove();
    this.added = false;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (on) this.addAll();
    else this.removeAll();
  }

  clear(): void {
    this.removeAll();
    this.markers = [];
    this.items = [];
  }

  get count(): number {
    return this.items.length;
  }
}

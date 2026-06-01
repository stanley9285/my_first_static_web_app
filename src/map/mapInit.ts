/**
 * mapInit.ts — create and configure the MapLibre GL map.
 *
 * We use MapLibre GL JS (BSD-2-Clause). We deliberately do NOT use Mapbox GL
 * JS v2+, whose licence ties usage to Mapbox's paid service — that would bake a
 * commercial dependency into the product. MapLibre is the commercial-safe fork.
 */

import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { getStyle } from "../config/basemap";
import { MALAWI_HOME } from "../config/overlays";
import { store } from "../state";

export function createMap(container: HTMLElement): MLMap {
  const s = store.get();

  const map = new maplibregl.Map({
    container,
    style: getStyle(s.style).style,
    center: s.center,
    zoom: s.zoom,
    bearing: s.bearing,
    pitch: s.pitch,
    // maxPitch high enough for terrain; minZoom keeps the whole country usable.
    maxPitch: 75,
    minZoom: 3,
    maxZoom: 18,
    attributionControl: false, // we add a customised, always-open one below
    hash: false, // we manage our own richer URL hash in state.ts
    // Keep Malawi roughly in view; generous padding so pan still feels free.
    maxBounds: [
      [26.0, -22.0],
      [42.0, -4.0],
    ],
  });

  // ── Commercial-readiness: attribution is a LICENCE REQUIREMENT, not polish.
  // Always visible (not collapsed) and seeded with the basemap/OSM credit.
  map.addControl(
    new maplibregl.AttributionControl({
      compact: false,
      customAttribution: [
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
      ],
    }),
    "bottom-right"
  );

  // Navigation (zoom + compass), scale, and geolocation — all keyboard-usable.
  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    "bottom-right"
  );
  map.addControl(
    new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
    "bottom-left"
  );

  // Keyboard accessibility: make the canvas focusable + describe it.
  const canvas = map.getCanvas();
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("aria-label", "Map canvas — use arrow keys to pan, +/- to zoom");

  return map;
}

/** Fit the full-country home view. */
export function flyHome(map: MLMap): void {
  map.fitBounds(
    [
      [MALAWI_HOME.bounds[0], MALAWI_HOME.bounds[1]],
      [MALAWI_HOME.bounds[2], MALAWI_HOME.bounds[3]],
    ],
    { padding: 40, bearing: 0, pitch: 0, duration: 900 }
  );
}

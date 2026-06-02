/**
 * overlays.ts — renders the boundary overlays and wires their interactions.
 *
 * For each overlay we add: a GeoJSON source, a semi-transparent fill layer (so
 * the basemap shows through), and an outline layer. Hover is driven by feature
 * state (highlight + name tooltip); click flies to the feature's bounds, marks
 * it selected, and notifies the app so the detail card can open.
 *
 * The loaded GeoJSON is cached in-memory so every layer can be re-created after
 * a basemap style swap (which wipes user-added sources/layers).
 */

import maplibregl, {
  type Map as MLMap,
  type MapGeoJSONFeature,
  type LngLatBoundsLike,
  Popup,
} from "maplibre-gl";

import type { OverlayCollection, OverlayId, BBox } from "../types";
import {
  OVERLAYS,
  getOverlay,
  LANDFORM_COLORS,
  LANDFORM_DEFAULT_COLOR,
  ROAD_COLORS,
  ROAD_DEFAULT_COLOR,
} from "../config/overlays";
import { loadOverlay } from "../data/loader";

export interface SelectedFeatureInfo {
  overlay: OverlayId;
  id: string | number;
  name: string;
  region?: string;
  district?: string;
  /** Landform-specific fields (populated only for the point overlay). */
  featureType?: string;
  elevation?: number;
  description?: string;
  /** Road-specific fields (populated only for the line overlay). */
  ref?: string;
  corridor?: string;
  from?: string;
  to?: string;
  surface?: string;
  lengthKm?: number;
  /** [lng, lat] of a point feature — used for the GPS / directions actions. */
  coord?: [number, number];
}

interface OverlayCallbacks {
  onSelect: (info: SelectedFeatureInfo) => void;
  /** Reports load success/failure so the UI can show counts or errors. */
  onLoadStatus: (id: OverlayId, status: { ok: boolean; count?: number; error?: string }) => void;
}

const srcId = (id: OverlayId) => `ov-${id}-src`;
const fillId = (id: OverlayId) => `ov-${id}-fill`;
const lineId = (id: OverlayId) => `ov-${id}-line`;
const circleId = (id: OverlayId) => `ov-${id}-circle`;
const labelId = (id: OverlayId) => `ov-${id}-label`;
const roadCasingId = (id: OverlayId) => `ov-${id}-rcasing`;
const roadLineId = (id: OverlayId) => `ov-${id}-rline`;
const roadLabelId = (id: OverlayId) => `ov-${id}-rlabel`;

/** All layer ids that could exist for an overlay, for visibility toggling. */
const allLayerIds = (id: OverlayId): string[] => [
  fillId(id),
  lineId(id),
  circleId(id),
  labelId(id),
  roadCasingId(id),
  roadLineId(id),
  roadLabelId(id),
];

/** The single layer used for hover/click, per render kind. */
function interactiveLayerId(o: { id: OverlayId; kind?: string }): string {
  if (o.kind === "point") return circleId(o.id);
  if (o.kind === "line") return roadLineId(o.id);
  return fillId(o.id);
}

/** `match` expression mapping a property value → colour, with fallback. */
function colorByProp(
  prop: string,
  table: Record<string, string>,
  fallback: string
): maplibregl.ExpressionSpecification {
  const stops: string[] = [];
  for (const [k, v] of Object.entries(table)) stops.push(k, v);
  return [
    "match",
    ["get", prop],
    ...stops,
    fallback,
  ] as unknown as maplibregl.ExpressionSpecification;
}

export class OverlayManager {
  private map: MLMap;
  private cb: OverlayCallbacks;
  private cache = new Map<OverlayId, OverlayCollection>();
  private visible: Record<OverlayId, boolean>;
  private selected: { overlay: OverlayId; id: string | number } | null = null;
  private hovered: { overlay: OverlayId; id: string | number } | null = null;
  private tooltip: Popup;
  /** Layer-scoped event handlers persist across style swaps; wire them once. */
  private eventsWired = false;

  constructor(map: MLMap, visible: Record<OverlayId, boolean>, cb: OverlayCallbacks) {
    this.map = map;
    this.cb = cb;
    this.visible = { ...visible };
    this.tooltip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 8,
      className: "ov-tooltip",
    });
  }

  /** Fetch every overlay's GeoJSON (graceful per-layer failure). */
  async loadAll(): Promise<void> {
    await Promise.all(
      OVERLAYS.map(async (o) => {
        const res = await loadOverlay(o.id);
        if (res.ok) {
          this.cache.set(o.id, res.data);
          this.cb.onLoadStatus(o.id, { ok: true, count: res.count });
        } else {
          this.cb.onLoadStatus(o.id, { ok: false, error: res.error });
        }
      })
    );
  }

  getData(id: OverlayId): OverlayCollection | undefined {
    return this.cache.get(id);
  }

  /** (Re)create all sources + layers on the current style, then wire events. */
  addAllToMap(): void {
    for (const o of OVERLAYS) this.addOne(o.id);
    this.wireEvents();
    this.applyAllVisibility();
    this.reapplySelection();
  }

  private addOne(id: OverlayId): void {
    const data = this.cache.get(id);
    if (!data) return; // failed to load → simply no layer (graceful)
    const cfg = getOverlay(id);

    if (!this.map.getSource(srcId(id))) {
      this.map.addSource(srcId(id), { type: "geojson", data });
    }

    if (cfg.kind === "point") {
      this.addPointLayers(id);
      return;
    }
    if (cfg.kind === "line") {
      this.addLineLayers(id);
      return;
    }

    if (!this.map.getLayer(fillId(id))) {
      this.map.addLayer({
        id: fillId(id),
        type: "fill",
        source: srcId(id),
        layout: { visibility: this.visible[id] ? "visible" : "none" },
        paint: {
          "fill-color": cfg.color,
          // Brighten on hover / selection via feature-state.
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            Math.min(cfg.fillOpacity + 0.28, 0.6),
            ["boolean", ["feature-state", "hover"], false],
            Math.min(cfg.fillOpacity + 0.16, 0.5),
            cfg.fillOpacity,
          ],
        },
      });
    }

    if (!this.map.getLayer(lineId(id))) {
      this.map.addLayer({
        id: lineId(id),
        type: "line",
        source: srcId(id),
        layout: { visibility: this.visible[id] ? "visible" : "none" },
        paint: {
          "line-color": cfg.color,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            ["boolean", ["feature-state", "hover"], false],
            2,
            1,
          ],
        },
      });
    }
  }

  /** Coloured circle markers + always-on name labels for a point overlay. */
  private addPointLayers(id: OverlayId): void {
    const vis = this.visible[id] ? "visible" : "none";
    const color = colorByProp("featureType", LANDFORM_COLORS, LANDFORM_DEFAULT_COLOR);

    if (!this.map.getLayer(circleId(id))) {
      this.map.addLayer({
        id: circleId(id),
        type: "circle",
        source: srcId(id),
        layout: { visibility: vis },
        paint: {
          "circle-color": color,
          // Grow on hover / selection via feature-state.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", ["boolean", ["feature-state", "selected"], false], 6, 4],
            11,
            ["case", ["boolean", ["feature-state", "selected"], false], 10, 7],
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            ["boolean", ["feature-state", "hover"], false],
            2.5,
            1.5,
          ],
          "circle-opacity": 0.95,
        },
      });
    }

    if (!this.map.getLayer(labelId(id))) {
      this.map.addLayer({
        id: labelId(id),
        type: "symbol",
        source: srcId(id),
        layout: {
          visibility: vis,
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 11, 14],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
          // Let MapLibre hide colliding labels at low zoom, revealing more as
          // the user zooms in — keeps the country view uncluttered.
          "text-optional": true,
          "text-padding": 4,
        },
        paint: {
          "text-color": "#2a2f3a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
          "text-halo-blur": 0.4,
        },
      });
    }
  }

  /** White casing + coloured line + along-line ref labels for a road overlay. */
  private addLineLayers(id: OverlayId): void {
    const vis = this.visible[id] ? "visible" : "none";
    const color = colorByProp("roadClass", ROAD_COLORS, ROAD_DEFAULT_COLOR);
    // Width grows with zoom; selection/hover add emphasis.
    const lineWidth: maplibregl.ExpressionSpecification = [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      ["case", ["boolean", ["feature-state", "selected"], false], 4, 2],
      11,
      [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        9,
        ["boolean", ["feature-state", "hover"], false],
        7,
        5,
      ],
    ] as unknown as maplibregl.ExpressionSpecification;

    if (!this.map.getLayer(roadCasingId(id))) {
      this.map.addLayer({
        id: roadCasingId(id),
        type: "line",
        source: srcId(id),
        layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.9,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            4,
            11,
            9,
          ],
        },
      });
    }

    if (!this.map.getLayer(roadLineId(id))) {
      this.map.addLayer({
        id: roadLineId(id),
        type: "line",
        source: srcId(id),
        layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": lineWidth },
      });
    }

    if (!this.map.getLayer(roadLabelId(id))) {
      this.map.addLayer({
        id: roadLabelId(id),
        type: "symbol",
        source: srcId(id),
        layout: {
          visibility: vis,
          "symbol-placement": "line",
          "text-field": ["get", "ref"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 11, 14],
          "text-font": ["Noto Sans Regular"],
          "text-padding": 2,
          "symbol-spacing": 220,
        },
        paint: {
          "text-color": "#7a0a16",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.8,
        },
      });
    }
  }

  private wireEvents(): void {
    if (this.eventsWired) return;
    this.eventsWired = true;
    for (const o of OVERLAYS) {
      // Interact via the circle (points), the road line (roads), or the fill.
      const layer = interactiveLayerId(o);
      // Delegated handlers are safe to register before the layer exists; they
      // simply match nothing until the layer is (re)added.

      this.map.on("mousemove", layer, (e) => {
        if (!e.features?.length) return;
        this.map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        this.setHover(o.id, f.id ?? 0);
        const name = (f.properties?.name as string) ?? "";
        this.tooltip.setLngLat(e.lngLat).setHTML(escapeHtml(name)).addTo(this.map);
      });

      this.map.on("mouseleave", layer, () => {
        this.map.getCanvas().style.cursor = "";
        this.clearHover();
        this.tooltip.remove();
      });

      this.map.on("click", layer, (e) => {
        if (!e.features?.length) return;
        this.handleClick(o.id, e.features[0]);
      });
    }
  }

  private handleClick(overlay: OverlayId, f: MapGeoJSONFeature): void {
    const id = f.id ?? 0;
    this.select(overlay, id);
    const p = f.properties ?? {};
    this.cb.onSelect(infoFromProps(overlay, id, p, f.geometry));

    if (getOverlay(overlay).kind === "point") {
      const coord = pointCoord(f.geometry);
      if (coord) this.flyToPoint(coord);
      return;
    }
    const bbox = this.featureBBox(overlay, id, p.bbox as BBox | string | undefined);
    if (bbox) this.flyToBBox(bbox);
  }

  /** Resolve a feature's bbox from its props (string or array) with fallback. */
  private featureBBox(
    overlay: OverlayId,
    id: string | number,
    raw: BBox | string | undefined
  ): BBox | null {
    if (Array.isArray(raw) && raw.length === 4) return raw as BBox;
    if (typeof raw === "string") {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 4) return arr as BBox;
      } catch {
        /* ignore */
      }
    }
    // Fallback: compute from geometry if bbox wasn't baked in.
    const data = this.cache.get(overlay);
    const feat = data?.features.find((f) => f.id === id);
    if (feat) return computeBBox(feat.geometry);
    return null;
  }

  flyToBBox(b: BBox): void {
    const bounds: LngLatBoundsLike = [
      [b[0], b[1]],
      [b[2], b[3]],
    ];
    this.map.fitBounds(bounds, { padding: 60, duration: 900, maxZoom: 11 });
  }

  /** Centre on a single point (landforms) at a sensible reveal zoom. */
  flyToPoint(coord: [number, number]): void {
    this.map.flyTo({
      center: coord,
      zoom: Math.max(this.map.getZoom(), 9),
      duration: 900,
    });
  }

  // ── visibility ───────────────────────────────────────────────────────────
  setVisibility(id: OverlayId, on: boolean): void {
    this.visible[id] = on;
    const v = on ? "visible" : "none";
    // Toggle whichever layers exist for this overlay (polygon/point/line set).
    for (const lid of allLayerIds(id)) {
      if (this.map.getLayer(lid)) this.map.setLayoutProperty(lid, "visibility", v);
    }
  }

  private applyAllVisibility(): void {
    for (const o of OVERLAYS) this.setVisibility(o.id, this.visible[o.id]);
  }

  // ── hover / selection feature-state ────────────────────────────────────────
  private setHover(overlay: OverlayId, id: string | number): void {
    if (this.hovered && (this.hovered.overlay !== overlay || this.hovered.id !== id)) {
      this.clearHover();
    }
    this.hovered = { overlay, id };
    this.map.setFeatureState({ source: srcId(overlay), id }, { hover: true });
  }

  private clearHover(): void {
    if (!this.hovered) return;
    this.map.setFeatureState(
      { source: srcId(this.hovered.overlay), id: this.hovered.id },
      { hover: false }
    );
    this.hovered = null;
  }

  /** Programmatic select (also used to restore selection from the URL hash). */
  select(overlay: OverlayId, id: string | number): void {
    this.clearSelection();
    this.selected = { overlay, id };
    if (this.map.getSource(srcId(overlay))) {
      this.map.setFeatureState({ source: srcId(overlay), id }, { selected: true });
    }
  }

  clearSelection(): void {
    if (!this.selected) return;
    if (this.map.getSource(srcId(this.selected.overlay))) {
      this.map.setFeatureState(
        { source: srcId(this.selected.overlay), id: this.selected.id },
        { selected: false }
      );
    }
    this.selected = null;
  }

  private reapplySelection(): void {
    if (this.selected) {
      const { overlay, id } = this.selected;
      if (this.map.getSource(srcId(overlay))) {
        this.map.setFeatureState({ source: srcId(overlay), id }, { selected: true });
      }
    }
  }

  /** Look up a feature's display info without selecting or flying. */
  getInfo(overlay: OverlayId, id: string | number): SelectedFeatureInfo | null {
    const feat = this.findFeature(overlay, id);
    if (!feat) return null;
    return infoFromProps(
      overlay,
      feat.id!,
      feat.properties as unknown as Record<string, unknown>,
      feat.geometry
    );
  }

  /** Select + fly to a feature by overlay/id (also used by the sidebar list). */
  selectAndFly(overlay: OverlayId, id: string | number): SelectedFeatureInfo | null {
    const feat = this.findFeature(overlay, id);
    if (!feat) return null;
    this.select(overlay, feat.id!);
    const info = infoFromProps(
      overlay,
      feat.id!,
      feat.properties as unknown as Record<string, unknown>,
      feat.geometry
    );

    if (getOverlay(overlay).kind === "point") {
      const coord = pointCoord(feat.geometry);
      if (coord) this.flyToPoint(coord);
    } else {
      const bbox = feat.properties.bbox ?? computeBBox(feat.geometry);
      if (bbox) this.flyToBBox(bbox);
    }
    return info;
  }

  private findFeature(overlay: OverlayId, id: string | number) {
    const data = this.cache.get(overlay);
    return data?.features.find((f) => String(f.id) === String(id));
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build SelectedFeatureInfo from a feature's properties (string-safe). */
function infoFromProps(
  overlay: OverlayId,
  id: string | number,
  p: Record<string, unknown> | null,
  geom?: GeoJSON.Geometry
): SelectedFeatureInfo {
  const props = p ?? {};
  const num = (v: unknown): number | undefined =>
    typeof v === "number" ? v : typeof v === "string" && v !== "" && !isNaN(+v) ? +v : undefined;
  return {
    overlay,
    id,
    name: (props.name as string) ?? "Unknown",
    region: props.region as string | undefined,
    district: props.district as string | undefined,
    featureType: props.featureType as string | undefined,
    elevation: num(props.elevation),
    description: props.description as string | undefined,
    ref: props.ref as string | undefined,
    corridor: props.corridor as string | undefined,
    from: props.from as string | undefined,
    to: props.to as string | undefined,
    surface: props.surface as string | undefined,
    lengthKm: num(props.lengthKm),
    coord: geom ? pointCoord(geom) ?? undefined : undefined,
  };
}

/** First coordinate of a Point/MultiPoint geometry, or null. */
function pointCoord(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === "Point") {
    const [x, y] = geom.coordinates;
    return [x, y];
  }
  if (geom.type === "MultiPoint" && geom.coordinates.length) {
    const [x, y] = geom.coordinates[0];
    return [x, y];
  }
  return null;
}

function computeBBox(geom: GeoJSON.Geometry): BBox | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const visit = (coords: unknown): void => {
    if (typeof coords === "number") return;
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [x, y] = coords as number[];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };
  if ("coordinates" in geom) visit(geom.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

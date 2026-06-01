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
import { OVERLAYS, getOverlay } from "../config/overlays";
import { loadOverlay } from "../data/loader";

export interface SelectedFeatureInfo {
  overlay: OverlayId;
  id: string | number;
  name: string;
  region?: string;
  district?: string;
}

interface OverlayCallbacks {
  onSelect: (info: SelectedFeatureInfo) => void;
  /** Reports load success/failure so the UI can show counts or errors. */
  onLoadStatus: (id: OverlayId, status: { ok: boolean; count?: number; error?: string }) => void;
}

const srcId = (id: OverlayId) => `ov-${id}-src`;
const fillId = (id: OverlayId) => `ov-${id}-fill`;
const lineId = (id: OverlayId) => `ov-${id}-line`;

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

  private wireEvents(): void {
    if (this.eventsWired) return;
    this.eventsWired = true;
    for (const o of OVERLAYS) {
      const layer = fillId(o.id);
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
    this.cb.onSelect({
      overlay,
      id,
      name: (p.name as string) ?? "Unknown",
      region: p.region as string | undefined,
      district: p.district as string | undefined,
    });
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

  // ── visibility ───────────────────────────────────────────────────────────
  setVisibility(id: OverlayId, on: boolean): void {
    this.visible[id] = on;
    const v = on ? "visible" : "none";
    if (this.map.getLayer(fillId(id))) this.map.setLayoutProperty(fillId(id), "visibility", v);
    if (this.map.getLayer(lineId(id))) this.map.setLayoutProperty(lineId(id), "visibility", v);
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
    const data = this.cache.get(overlay);
    const feat = data?.features.find((f) => String(f.id) === String(id));
    if (!feat) return null;
    const p = feat.properties;
    return {
      overlay,
      id: feat.id!,
      name: p.name,
      region: p.region,
      district: p.district,
    };
  }

  /** Select + fly to a feature by overlay/id (used when restoring from hash). */
  selectAndFly(overlay: OverlayId, id: string | number): SelectedFeatureInfo | null {
    const data = this.cache.get(overlay);
    const feat = data?.features.find((f) => String(f.id) === String(id));
    if (!feat) return null;
    this.select(overlay, feat.id!);
    const p = feat.properties;
    const info: SelectedFeatureInfo = {
      overlay,
      id: feat.id!,
      name: p.name,
      region: p.region,
      district: p.district,
    };
    const bbox = p.bbox ?? computeBBox(feat.geometry);
    if (bbox) this.flyToBBox(bbox);
    return info;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
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

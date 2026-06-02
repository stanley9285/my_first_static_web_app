/**
 * vehicles.ts (map) — renders tracked goods vehicles supplied by a VehicleFeed.
 *
 * Each vehicle is drawn as a status-coloured dot with a heading arrow on top
 * and a plate label. Clicking a vehicle opens its detail card. The layers and
 * the (canvas-generated) arrow icon are re-created after a basemap style swap.
 */

import maplibregl, { type Map as MLMap } from "maplibre-gl";
import type { VehiclePosition } from "../types";

const SRC = "veh-src";
const DOT = "veh-dot";
const ARROW = "veh-arrow";
const PLATE = "veh-plate";
const ARROW_IMG = "veh-arrow-img";

/** Marker colour per operational status. */
const STATUS_COLOR: Record<VehiclePosition["status"], string> = {
  moving: "#1a9850",
  idle: "#f1c40f",
  stopped: "#999999",
  loading: "#3498db",
};

function statusColorExpr(): maplibregl.ExpressionSpecification {
  return [
    "match",
    ["get", "status"],
    "moving",
    STATUS_COLOR.moving,
    "idle",
    STATUS_COLOR.idle,
    "stopped",
    STATUS_COLOR.stopped,
    "loading",
    STATUS_COLOR.loading,
    "#666666",
  ] as unknown as maplibregl.ExpressionSpecification;
}

export class VehicleLayer {
  private map: MLMap;
  private onClick: (v: VehiclePosition) => void;
  private latest: VehiclePosition[] = [];
  private wired = false;
  private visible = true;

  constructor(map: MLMap, onClick: (v: VehiclePosition) => void) {
    this.map = map;
    this.onClick = onClick;
  }

  /** (Re)create the icon, source and layers on the current style. Idempotent. */
  ensure(): void {
    if (!this.map.hasImage(ARROW_IMG)) {
      const img = makeArrowIcon();
      if (img) this.map.addImage(ARROW_IMG, img, { pixelRatio: 2 });
    }
    if (!this.map.getSource(SRC)) {
      this.map.addSource(SRC, { type: "geojson", data: emptyFC() });
    }
    const vis = this.visible ? "visible" : "none";

    if (!this.map.getLayer(DOT)) {
      this.map.addLayer({
        id: DOT,
        type: "circle",
        source: SRC,
        layout: { visibility: vis },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 11, 8],
          "circle-color": statusColorExpr(),
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
    if (!this.map.getLayer(ARROW)) {
      this.map.addLayer({
        id: ARROW,
        type: "symbol",
        source: SRC,
        layout: {
          visibility: vis,
          "icon-image": ARROW_IMG,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 11, 0.6],
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    }
    if (!this.map.getLayer(PLATE)) {
      this.map.addLayer({
        id: PLATE,
        type: "symbol",
        source: SRC,
        layout: {
          visibility: vis,
          "text-field": ["get", "plate"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
          "text-optional": true,
        },
        paint: {
          "text-color": "#1c2230",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
        },
      });
    }

    this.wireEvents();
    // Re-apply the latest data after a style reload.
    if (this.latest.length) this.update(this.latest);
  }

  private wireEvents(): void {
    if (this.wired) return;
    this.wired = true;
    this.map.on("mouseenter", DOT, () => {
      this.map.getCanvas().style.cursor = "pointer";
    });
    this.map.on("mouseleave", DOT, () => {
      this.map.getCanvas().style.cursor = "";
    });
    this.map.on("click", DOT, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      this.onClick(propsToVehicle(f.properties as Record<string, unknown>));
    });
  }

  /** Push the latest positions to the map. */
  update(vehicles: VehiclePosition[]): void {
    this.latest = vehicles;
    const src = this.map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData(toFC(vehicles));
  }

  setVisible(on: boolean): void {
    this.visible = on;
    const vis = on ? "visible" : "none";
    for (const id of [DOT, ARROW, PLATE]) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, "visibility", vis);
    }
  }

  /** Remove all vehicle markers (e.g. when tracking is turned off). */
  clear(): void {
    this.latest = [];
    const src = this.map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData(emptyFC());
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toFC(vehicles: VehiclePosition[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id,
        plate: v.plate,
        heading: v.heading,
        speedKmh: v.speedKmh,
        status: v.status,
        cargo: v.cargo ?? "",
        road: v.road ?? "",
        updatedAt: v.updatedAt,
      },
    })),
  };
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function propsToVehicle(p: Record<string, unknown>): VehiclePosition {
  return {
    id: String(p.id ?? ""),
    plate: String(p.plate ?? ""),
    lng: 0,
    lat: 0,
    heading: Number(p.heading ?? 0),
    speedKmh: Number(p.speedKmh ?? 0),
    status: (p.status as VehiclePosition["status"]) ?? "stopped",
    cargo: (p.cargo as string) || undefined,
    road: (p.road as string) || undefined,
    updatedAt: Number(p.updatedAt ?? Date.now()),
  };
}

/** Draw a white-edged dark chevron pointing "up" (north) as a map icon. */
function makeArrowIcon(): ImageData | null {
  const size = 36;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const c = size / 2;
  ctx.beginPath();
  ctx.moveTo(c, 4); // tip (top = north)
  ctx.lineTo(size - 8, size - 8);
  ctx.lineTo(c, size - 14);
  ctx.lineTo(8, size - 8);
  ctx.closePath();
  ctx.fillStyle = "#1c2230";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

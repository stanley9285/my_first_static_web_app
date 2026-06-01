import type {
  FeatureCollection,
  Feature,
  Polygon,
  MultiPolygon,
} from "geojson";

/** Bounding box as [minX, minY, maxX, maxY] in WGS84 degrees. */
export type BBox = [number, number, number, number];

/** Stable, normalised property schema shared by every overlay feature. */
export interface OverlayFeatureProps {
  /** Stable unique id (geoBoundaries shapeID, OSM relation id, MEC code…). */
  id: string;
  /** Display name. */
  name: string;
  /** Which overlay this feature belongs to. */
  level: "region" | "district" | "constituency";
  /** Parent ADM1 region name (districts & — where known — constituencies). */
  region?: string;
  /** Parent ADM2 district name (constituencies only, where known). */
  district?: string;
  /** Pre-computed bbox so we can fly-to without re-walking geometry. */
  bbox?: BBox;
}

export type OverlayFeature = Feature<Polygon | MultiPolygon, OverlayFeatureProps>;
export type OverlayCollection = FeatureCollection<
  Polygon | MultiPolygon,
  OverlayFeatureProps
>;

/** The three switchable overlay tabs. */
export type OverlayId = "regions" | "districts" | "constituencies";

/** Persisted UI + map state (mirrored to the URL hash). */
export interface AppState {
  /** Active basemap style key (see config/basemap.ts). */
  style: string;
  /** Whether 3D terrain is enabled. */
  terrain: boolean;
  /** Which overlays are currently visible. */
  visible: Record<OverlayId, boolean>;
  /** Which overlay tab is focused in the sidebar. */
  activeTab: OverlayId;
  /** Camera. */
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  /** Selected feature, as `${OverlayId}:${featureId}` or null. */
  selected: string | null;
}
